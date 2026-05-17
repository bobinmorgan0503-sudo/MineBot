function createNukerFeature({
  bot,
  config,
  logInfo,
  sleep
}) {
  let nukerEnabled = false
  let nukerRunId = 0
  let actionSequence = 0

  function isNukerActive(runId) {
    return nukerEnabled && nukerRunId === runId
  }

  function assertNukerActive(runId) {
    if (!isNukerActive(runId)) {
      throw new Error('Nuker stopped.')
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

  function getHorizontalAxes() {
    const yaw = bot.entity ? bot.entity.yaw : 0
    const normalizedQuarterTurns = Math.round(yaw / (Math.PI / 2))
    const direction = ((normalizedQuarterTurns % 4) + 4) % 4

    if (direction === 0) {
      return {
        forward: { x: 0, z: 1 },
        right: { x: -1, z: 0 }
      }
    }

    if (direction === 1) {
      return {
        forward: { x: -1, z: 0 },
        right: { x: 0, z: -1 }
      }
    }

    if (direction === 2) {
      return {
        forward: { x: 0, z: -1 },
        right: { x: 1, z: 0 }
      }
    }

    return {
      forward: { x: 1, z: 0 },
      right: { x: 0, z: 1 }
    }
  }

  function getTargets() {
    if (!bot.entity || String(config.shape || 'cube').toLowerCase() !== 'cube') {
      return []
    }

    const targets = []
    const center = bot.entity.position.floored()
    const axes = getHorizontalAxes()
    const up = Math.max(0, Number.parseInt(config.up || 0, 10))
    const down = Math.max(0, Number.parseInt(config.down || 0, 10))
    const left = Math.max(0, Number.parseInt(config.left || 0, 10))
    const right = Math.max(0, Number.parseInt(config.right || 0, 10))
    const forward = Math.max(0, Number.parseInt(config.forward || 0, 10))
    const back = Math.max(0, Number.parseInt(config.back || 0, 10))

    for (let vertical = -down; vertical <= up; vertical += 1) {
      for (let sideways = -left; sideways <= right; sideways += 1) {
        for (let depth = -back; depth <= forward; depth += 1) {
          const x = center.x + axes.forward.x * depth + axes.right.x * sideways
          const y = center.y + vertical
          const z = center.z + axes.forward.z * depth + axes.right.z * sideways
          const position = center.offset(x - center.x, y - center.y, z - center.z)
          const block = bot.blockAt(position)

          if (!block) continue
          if (block.name === 'air' || block.boundingBox === 'empty') continue
          if (!isBlockAllowed(block)) continue
          if (config.onlySuitableTools && typeof bot.canDigBlock === 'function' && !bot.canDigBlock(block)) continue

          targets.push({ block, position })
        }
      }
    }

    if (String(config.sortMode || 'closest').toLowerCase() === 'closest' && bot.entity) {
      targets.sort((leftTarget, rightTarget) => {
        const leftDistance = bot.entity.position.distanceTo(leftTarget.position.offset(0.5, 0.5, 0.5))
        const rightDistance = bot.entity.position.distanceTo(rightTarget.position.offset(0.5, 0.5, 0.5))
        return leftDistance - rightDistance
      })
    }

    const limit = Math.max(1, Number.parseInt(config.maxBlocksPerTick || 1, 10))
    return targets.slice(0, limit)
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

  async function prepareTarget(target, runId) {
    assertNukerActive(runId)

    if (config.rotate && typeof bot.lookAt === 'function') {
      await bot.lookAt(target.position.offset(0.5, 0.5, 0.5), true)
      assertNukerActive(runId)
    }

    if (config.interact && typeof bot.activateBlock === 'function') {
      await bot.activateBlock(target.block)
      assertNukerActive(runId)
    }
  }

  async function digBlock(target, runId) {
    await prepareTarget(target, runId)

    if (config.packetMine !== false) {
      sendDigPacket(0, target.position)
      await sleep(50)
      assertNukerActive(runId)
      sendDigPacket(2, target.position)
      assertNukerActive(runId)
      return
    }

    if (typeof bot.dig === 'function') {
      await bot.dig(target.block, true)
      assertNukerActive(runId)
      return
    }

    sendDigPacket(0, target.position)
    await sleep(50)
    assertNukerActive(runId)
    sendDigPacket(2, target.position)
    assertNukerActive(runId)
  }

  async function digTargetsInBatch(targets, runId) {
    if (targets.length === 0) return

    if (config.packetMine === false) {
      for (const target of targets) {
        assertNukerActive(runId)
        await digBlock(target, runId)
      }
      return
    }

    // When packet mining, treat maxBlocksPerTick as a true per-tick batch:
    // send all start-dig packets first, wait one tick, then finish them together.
    for (const target of targets) {
      assertNukerActive(runId)
      await prepareTarget(target, runId)
      sendDigPacket(0, target.position)
    }

    await sleep(50)
    assertNukerActive(runId)

    for (const target of targets) {
      assertNukerActive(runId)
      sendDigPacket(2, target.position)
    }
  }

  async function nukerLoop(runId) {
    while (isNukerActive(runId)) {
      try {
        const targets = getTargets()

        if (targets.length === 0) {
          await sleep(config.idleDelayMs)
          continue
        }

        await digTargetsInBatch(targets, runId)

        await sleep(Math.max(0, Number.parseInt(config.delayMs ?? 0, 10)))
      } catch (error) {
        if (!isNukerActive(runId)) break
        console.error('Nuker failed:', error.message)
        await sleep(config.retryDelayMs)
      }
    }

    if (nukerRunId === runId) {
      nukerEnabled = false
    }

    logInfo('Nuker stopped.')
  }

  function startNuker() {
    if (!config.enabled) {
      logInfo('Nuker is disabled in config.')
      return
    }

    if (nukerEnabled) {
      logInfo('Nuker is already running.')
      return
    }

    nukerEnabled = true
    nukerRunId += 1
    const runId = nukerRunId
    logInfo('Nuker enabled.')

    void (async () => {
      try {
        await nukerLoop(runId)
      } catch (error) {
        if (isNukerActive(runId)) {
          console.error('Failed to start nuker:', error.message)
        }
        nukerEnabled = false
      }
    })()
  }

  async function stopNuker() {
    nukerEnabled = false
    nukerRunId += 1
    logInfo('Nuker stopped manually.')
  }

  async function handleCommand(message) {
    const normalized = message.toLowerCase()

    if (normalized === '/nuker start') {
      startNuker()
      return true
    }

    if (normalized === '/nuker stop') {
      await stopNuker()
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /nuker start',
      'Local command: /nuker stop'
    ]
  }

  function onDisconnect() {
    nukerEnabled = false
    nukerRunId += 1
  }

  async function stop() {
    await stopNuker()
  }

  return {
    getCommandHelp,
    handleCommand,
    onDisconnect,
    stop
  }
}

module.exports = {
  createNukerFeature
}
