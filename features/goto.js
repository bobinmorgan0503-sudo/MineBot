const { createNavigationMovements } = require('./navigation')

function createGotoFeature({
  bot,
  GoalBlock,
  Movements,
  logInfo
}) {
  let navigationRunId = 0
  let navigationActive = false
  let stopRequested = false

  function ensurePathfinderReady() {
    return Boolean(
      bot.pathfinder &&
      typeof bot.pathfinder.setMovements === 'function' &&
      typeof bot.pathfinder.goto === 'function'
    )
  }

  function normalizeTargetCoordinates(parts) {
    if (parts.length !== 4) return null

    const values = parts.slice(1).map((value) => Number.parseFloat(value))
    if (values.some((value) => !Number.isFinite(value))) return null

    return {
      x: Math.floor(values[0]),
      y: Math.floor(values[1]),
      z: Math.floor(values[2])
    }
  }

  function stopNavigation({ announceIfIdle = true } = {}) {
    if (!ensurePathfinderReady()) {
      if (announceIfIdle) {
        logInfo('Goto is unavailable because pathfinder is not loaded.')
      }
      return
    }

    if (!navigationActive) {
      if (announceIfIdle) {
        logInfo('No active goto path.')
      }
      return
    }

    stopRequested = true
    navigationActive = false
    navigationRunId += 1
    bot.pathfinder.setGoal(null)

    if (announceIfIdle) {
      logInfo('Goto stopped.')
    }
  }

  function startNavigation(target) {
    if (!ensurePathfinderReady()) {
      logInfo('Goto is unavailable because pathfinder is not loaded.')
      return
    }

    if (!bot.entity) {
      logInfo('Bot is not ready to navigate yet.')
      return
    }

    if (navigationActive) {
      stopNavigation({ announceIfIdle: false })
    }

    navigationRunId += 1
    const runId = navigationRunId
    navigationActive = true
    stopRequested = false

    bot.pathfinder.setMovements(createNavigationMovements({
      bot,
      Movements
    }))
    logInfo(`Navigating to ${target.x}, ${target.y}, ${target.z}.`)

    void (async () => {
      try {
        await bot.pathfinder.goto(new GoalBlock(target.x, target.y, target.z))
        if (navigationRunId !== runId) return
        logInfo(`Reached ${target.x}, ${target.y}, ${target.z}.`)
      } catch (error) {
        if (navigationRunId !== runId) return
        if (!stopRequested) {
          console.error('Goto failed:', error.message)
        }
      } finally {
        if (navigationRunId === runId) {
          navigationActive = false
          stopRequested = false
        }
      }
    })()
  }

  async function handleCommand(message) {
    const trimmed = message.trim()
    const normalized = trimmed.toLowerCase()

    if (normalized === '/goto stop') {
      stopNavigation()
      return true
    }

    if (!normalized.startsWith('/goto')) {
      return false
    }

    const target = normalizeTargetCoordinates(trimmed.split(/\s+/))
    if (!target) {
      logInfo('Usage: /goto <x> <y> <z>')
      logInfo('Usage: /goto stop')
      return true
    }

    startNavigation(target)
    return true
  }

  function getCommandHelp() {
    return [
      'Local command: /goto <x> <y> <z>',
      'Local command: /goto stop'
    ]
  }

  function onDisconnect() {
    navigationActive = false
    stopRequested = false
    navigationRunId += 1
  }

  async function stop() {
    stopNavigation({ announceIfIdle: false })
  }

  return {
    getCommandHelp,
    handleCommand,
    onDisconnect,
    stop
  }
}

module.exports = {
  createGotoFeature
}
