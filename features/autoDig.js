function createAutoDigFeature({
  bot,
  config,
  logInfo,
  sleep
}) {
  let digEnabled = false
  let digRunId = 0
  let autoStartTimer = null
  let actionSequence = 0

  function clearAutoStartTimer() {
    if (!autoStartTimer) return
    clearTimeout(autoStartTimer)
    autoStartTimer = null
  }

  function isDigActive(runId) {
    return digEnabled && digRunId === runId
  }

  function assertDigActive(runId) {
    if (!isDigActive(runId)) {
      throw new Error('Auto dig stopped.')
    }
  }

  function getBlockName(block) {
    if (!block) return ''
    return String(block.displayName || block.name || '').replace(/\s+/g, '')
  }

  function isBlockAllowed(block) {
    if (!block) return false

    const normalizedBlockName = getBlockName(block).toLowerCase()
    const configuredNames = config.blocks.map((name) => String(name).replace(/\s+/g, '').toLowerCase())
    const isListed = configuredNames.includes(normalizedBlockName)

    if (config.listType === 'whitelist') {
      return isListed
    }

    return !isListed
  }

  function getLookAtTarget() {
    if (typeof bot.blockAtCursor !== 'function') return null
    return bot.blockAtCursor(config.lookAtMaxDistance) || null
  }

  function getFixedPositionTargets() {
    const targets = []

    for (const position of config.locations) {
      const block = bot.blockAt(position)
      if (!block) continue
      if (block.name === 'air' || block.boundingBox === 'empty') continue
      if (!isBlockAllowed(block)) continue
      targets.push({ block, position })
    }

    if (config.locationOrder === 'distance' && bot.entity) {
      targets.sort((left, right) => {
        const leftDistance = bot.entity.position.distanceTo(left.position.offset(0.5, 0.5, 0.5))
        const rightDistance = bot.entity.position.distanceTo(right.position.offset(0.5, 0.5, 0.5))
        return leftDistance - rightDistance
      })
    }

    return targets
  }

  function chooseTargetBlocks() {
    const mode = String(config.mode || 'fixedpos').toLowerCase()
    const lookAtTarget = getLookAtTarget()
    const fixedTargets = getFixedPositionTargets()

    if (mode === 'lookat') {
      return lookAtTarget && isBlockAllowed(lookAtTarget)
        ? [{ block: lookAtTarget, position: lookAtTarget.position }]
        : []
    }

    if (mode === 'both') {
      if (!lookAtTarget || !isBlockAllowed(lookAtTarget)) return []
      const matchedTarget = fixedTargets.find((entry) => entry.position.equals(lookAtTarget.position))
      return matchedTarget ? [matchedTarget] : []
    }

    return fixedTargets
  }

  function nextActionSequence() {
    const sequence = actionSequence
    actionSequence += 1
    return sequence
  }

  function sendDigPacket(status, position) {
    if (!bot._client || typeof bot._client.write !== 'function') {
      throw new Error('Protocol client is not ready yet.')
    }

    const payload = {
      status,
      location: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      face: 1,
      sequence: nextActionSequence()
    }

    try {
      bot._client.write('block_dig', payload)
      return
    } catch {
      bot._client.write('player_action', payload)
    }
  }

  async function digBlock(targetPosition, runId) {
    assertDigActive(runId)
    sendDigPacket(0, targetPosition)
    await sleep(50)
    assertDigActive(runId)
    sendDigPacket(2, targetPosition)
    assertDigActive(runId)
  }

  async function autoDigLoop(runId) {
    while (isDigActive(runId)) {
      try {
        const targetBlocks = chooseTargetBlocks()

        if (targetBlocks.length === 0) {
          await sleep(config.idleDelayMs)
          continue
        }

        for (const target of targetBlocks) {
          assertDigActive(runId)
          await digBlock(target.position, runId)
        }

        await sleep(config.idleDelayMs)
      } catch (error) {
        if (!isDigActive(runId)) break
        console.error('Auto dig failed:', error.message)
        await sleep(config.retryDelayMs)
      }
    }

    if (digRunId === runId) {
      digEnabled = false
    }

    logInfo('Auto dig stopped.')
  }

  function startAutoDig() {
    if (!config.enabled) {
      logInfo('Auto dig is disabled in config.')
      return
    }

    if (digEnabled) {
      logInfo('Auto dig is already running.')
      return
    }

    clearAutoStartTimer()
    digEnabled = true
    digRunId += 1
    const runId = digRunId
    logInfo('Auto dig enabled.')

    void (async () => {
      try {
        await autoDigLoop(runId)
      } catch (error) {
        if (isDigActive(runId)) {
          console.error('Failed to start auto dig:', error.message)
        }
        digEnabled = false
      }
    })()
  }

  async function stopAutoDig() {
    clearAutoStartTimer()
    digEnabled = false
    digRunId += 1

    logInfo('Auto dig stopped manually.')
  }

  async function handleCommand(message) {
    const normalized = message.toLowerCase()

    if (normalized === '/dig start') {
      startAutoDig()
      return true
    }

    if (normalized === '/dig stop') {
      await stopAutoDig()
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /dig start',
      'Local command: /dig stop'
    ]
  }

  function onReady() {
    clearAutoStartTimer()

    if (!config.enabled || config.autoStartDelayMs < 0) return

    autoStartTimer = setTimeout(() => {
      autoStartTimer = null
      startAutoDig()
    }, config.autoStartDelayMs)

    logInfo(`Auto dig will start in ${Math.round(config.autoStartDelayMs / 1000)} seconds.`)
  }

  function onDisconnect() {
    clearAutoStartTimer()
    digEnabled = false
    digRunId += 1
  }

  async function stop() {
    await stopAutoDig()
  }

  return {
    getCommandHelp,
    handleCommand,
    onDisconnect,
    onReady,
    stop
  }
}

module.exports = {
  createAutoDigFeature
}
