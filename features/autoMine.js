const { createNavigationMovements } = require('./navigation')

function createAutoMineFeature({
  bot,
  config,
  GoalGetToBlock,
  Movements,
  logInfo,
  sleep
}) {
  let enabled = false
  let runId = 0
  let autoStartTimer = null
  let activeTargets = new Set()
  let actionSequence = 0

  function clearAutoStartTimer() {
    if (!autoStartTimer) return
    clearTimeout(autoStartTimer)
    autoStartTimer = null
  }

  function normalizeBlockName(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
  }

  function parseTargetNames(rawText) {
    if (!rawText) return []

    return Array.from(new Set(
      String(rawText)
        .split(/[,\s]+/)
        .map((name) => normalizeBlockName(name))
        .filter(Boolean)
    ))
  }

  function getConfiguredTargetNames() {
    const configured = Array.isArray(config.targetBlocks) ? config.targetBlocks : []
    return parseTargetNames(configured.join(' '))
  }

  function getCurrentTargets() {
    return activeTargets.size > 0 ? Array.from(activeTargets) : getConfiguredTargetNames()
  }

  function getTargetNamesSummary(targets) {
    return targets.join(', ')
  }

  function isActive(currentRunId) {
    return enabled && runId === currentRunId
  }

  function assertActive(currentRunId) {
    if (!isActive(currentRunId)) {
      throw new Error('Auto mine stopped.')
    }
  }

  function ensurePathfinderReady() {
    return Boolean(
      bot.pathfinder &&
      typeof bot.pathfinder.setMovements === 'function' &&
      typeof bot.pathfinder.goto === 'function'
    )
  }

  function isBlockGone(block) {
    return !block || block.type === 0 || block.name === 'air'
  }

  function getUnsafeBlocks() {
    const unsafeBlocks = Array.isArray(config.unsafeBlocks) ? config.unsafeBlocks : []
    return new Set(unsafeBlocks.map((name) => normalizeBlockName(name)))
  }

  function isNearUnsafeBlock(block) {
    if (!block || !block.position) return true

    const unsafeBlocks = getUnsafeBlocks()
    if (unsafeBlocks.size === 0) return false

    const offsets = [
      [0, 1, 0],
      [0, -1, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1]
    ]

    for (const [dx, dy, dz] of offsets) {
      const neighbor = bot.blockAt(block.position.offset(dx, dy, dz))
      if (!neighbor) continue
      if (unsafeBlocks.has(normalizeBlockName(neighbor.name))) {
        return true
      }
    }

    return false
  }

  function isMineableBlock(block, targets) {
    if (!block || !block.position || block.name === 'air') return false
    if (!targets.has(normalizeBlockName(block.name))) return false
    if (block.diggable === false) return false
    if (isNearUnsafeBlock(block)) return false
    return true
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

  function findCandidateBlocks() {
    const targetNames = getCurrentTargets()
    const targets = new Set(targetNames)
    if (targets.size === 0) return []

    const searchRange = Number.isFinite(Number(config.searchRange)) ? Number(config.searchRange) : 32
    const searchCount = Number.isFinite(Number(config.searchCount)) ? Number(config.searchCount) : 64

    return bot.findBlocks({
      matching: (block) => Boolean(block && targets.has(normalizeBlockName(block.name))),
      maxDistance: searchRange,
      count: searchCount
    })
      .map((position) => bot.blockAt(position))
      .filter((block) => isMineableBlock(block, targets))
      .sort((left, right) => {
        const leftDistance = bot.entity.position.distanceTo(left.position.offset(0.5, 0.5, 0.5))
        const rightDistance = bot.entity.position.distanceTo(right.position.offset(0.5, 0.5, 0.5))
        return leftDistance - rightDistance
      })
  }

  async function equipBestTool(block) {
    if (!block || !bot.pathfinder || typeof bot.pathfinder.bestHarvestTool !== 'function') return

    const tool = bot.pathfinder.bestHarvestTool(block)
    if (!tool) return
    if (bot.heldItem && bot.heldItem.type === tool.type) return

    await bot.equip(tool, 'hand')
  }

  async function moveToBlock(block, currentRunId) {
    assertActive(currentRunId)

    bot.pathfinder.setMovements(createNavigationMovements({
      bot,
      Movements,
      config: {
        ...config.navigation,
        canDig: true,
        allow1by1towers: false,
        allowParkour: false,
        allowSprinting: false
      }
    }))
    bot.pathfinder.LOSWhenPlacingBlocks = true
    await bot.pathfinder.goto(new GoalGetToBlock(
      block.position.x,
      block.position.y,
      block.position.z
    ))

    assertActive(currentRunId)
  }

  async function digBlock(block, currentRunId) {
    assertActive(currentRunId)

    const liveBlock = bot.blockAt(block.position)
    if (isBlockGone(liveBlock)) {
      return false
    }

    await equipBestTool(liveBlock)
    assertActive(currentRunId)

    try {
      await bot.lookAt(liveBlock.position.offset(0.5, 0.5, 0.5), true)
    } catch {
      // keep digging attempt even if lookAt fails
    }
    assertActive(currentRunId)

    await sleep(50)
    assertActive(currentRunId)

    sendDigPacket(0, liveBlock.position)
    await sleep(50)
    assertActive(currentRunId)
    sendDigPacket(2, liveBlock.position)
    assertActive(currentRunId)

    const collectDelayMs = Number(config.collectDelayMs || 300)
    if (collectDelayMs > 0) {
      await sleep(collectDelayMs)
    }

    return isBlockGone(bot.blockAt(block.position))
  }

  async function tryMineCandidate(block, currentRunId) {
    logInfo(`Auto mine targeting ${block.name} at ${block.position.x}, ${block.position.y}, ${block.position.z}.`)
    await moveToBlock(block, currentRunId)

    const mined = await digBlock(block, currentRunId)
    if (mined) {
      logInfo(`Mined ${block.name} at ${block.position.x}, ${block.position.y}, ${block.position.z}.`)
    } else {
      logInfo(`Skipped ${block.name} at ${block.position.x}, ${block.position.y}, ${block.position.z}.`)
    }

    return mined
  }

  async function autoMineLoop(currentRunId) {
    const idleDelayMs = Number(config.idleDelayMs || 2000)
    const retryDelayMs = Number(config.retryDelayMs || 1000)

    while (isActive(currentRunId)) {
      const candidates = findCandidateBlocks()

      if (candidates.length === 0) {
        logInfo(`No target blocks found within ${Number(config.searchRange || 32)} blocks.`)
        await sleep(idleDelayMs)
        continue
      }

      const candidate = candidates[0]

      try {
        await tryMineCandidate(candidate, currentRunId)
      } catch (error) {
        if (!isActive(currentRunId)) break

        if (error && (error.name === 'GoalChanged' || error.name === 'PathStopped')) {
          break
        }

        logInfo(
          `Skipping ${candidate.name} at ${candidate.position.x}, ${candidate.position.y}, ${candidate.position.z}: ` +
          `${error.message}`
        )
      }

      if (isActive(currentRunId)) {
        await sleep(retryDelayMs)
      }
    }

    if (runId === currentRunId) {
      enabled = false
      activeTargets = new Set()
    }

    logInfo('Auto mine stopped.')
  }

  function startAutoMine(targetNames = []) {
    if (!ensurePathfinderReady()) {
      logInfo('Auto mine is unavailable because pathfinder is not loaded.')
      return
    }

    if (!bot.entity) {
      logInfo('Bot is not ready to mine yet.')
      return
    }

    const normalizedTargets = targetNames.length > 0 ? targetNames : getConfiguredTargetNames()
    if (normalizedTargets.length === 0) {
      logInfo('Auto mine needs at least one target block name.')
      logInfo('Usage: /automine start <block_name> [more_block_names...]')
      return
    }

    if (enabled) {
      logInfo(`Auto mine is already running for ${getTargetNamesSummary(getCurrentTargets())}.`)
      return
    }

    clearAutoStartTimer()
    enabled = true
    activeTargets = new Set(normalizedTargets)
    runId += 1
    const currentRunId = runId

    logInfo(`Auto mine enabled for ${getTargetNamesSummary(normalizedTargets)}.`)
    void autoMineLoop(currentRunId)
  }

  async function stopAutoMine({ announceIfIdle = true } = {}) {
    clearAutoStartTimer()

    if (!enabled) {
      if (announceIfIdle) {
        logInfo('Auto mine is already stopped.')
      }
      return
    }

    enabled = false
    activeTargets = new Set()
    runId += 1

    if (bot.pathfinder) {
      bot.pathfinder.setGoal(null)
    }

    if (announceIfIdle) {
      logInfo('Auto mine stop requested.')
    }
  }

  function parseStartCommand(message) {
    const match = message.match(/^\/(?:automine|mine)\s+start(?:\s+(.+))?$/i)
    if (!match) return null
    return parseTargetNames(match[1] || '')
  }

  async function handleCommand(message) {
    const trimmed = message.trim()
    const normalized = trimmed.toLowerCase()

    if (normalized === '/automine stop' || normalized === '/mine stop') {
      await stopAutoMine()
      return true
    }

    if (normalized === '/automine status' || normalized === '/mine status') {
      if (!enabled) {
        logInfo('Auto mine is stopped.')
      } else {
        logInfo(`Auto mine is running for ${getTargetNamesSummary(getCurrentTargets())}.`)
      }
      return true
    }

    const requestedTargets = parseStartCommand(trimmed)
    if (!requestedTargets) {
      return false
    }

    startAutoMine(requestedTargets)
    return true
  }

  function getCommandHelp() {
    return [
      'Local command: /automine start <block_name> [more_block_names...]',
      'Local command: /automine stop',
      'Local command: /automine status'
    ]
  }

  function onReady() {
    clearAutoStartTimer()

    if (!config.enabled || config.autoStartDelayMs < 0) return

    autoStartTimer = setTimeout(() => {
      autoStartTimer = null
      startAutoMine()
    }, config.autoStartDelayMs)

    logInfo(`Auto mine will auto-start in ${Math.round(config.autoStartDelayMs / 1000)} seconds.`)
  }

  function onDisconnect() {
    clearAutoStartTimer()
    enabled = false
    activeTargets = new Set()
    runId += 1
  }

  async function stop() {
    await stopAutoMine({ announceIfIdle: false })
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
  createAutoMineFeature
}
