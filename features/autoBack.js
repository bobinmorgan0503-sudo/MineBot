function createAutoBackFeature({
  bot,
  config,
  logInfo,
  sleep
}) {
  let enabled = false
  let runId = 0
  let pendingDeathRunId = 0
  let waitingForSpawn = false

  function getRespawnDelayMs() {
    const value = Number(config.respawnDelayMs)
    return Number.isFinite(value) && value >= 0 ? value : 500
  }

  function getBackDelayMs() {
    const value = Number(config.backDelayMs)
    return Number.isFinite(value) && value >= 0 ? value : 1500
  }

  function getBackCommand() {
    const command = String(config.backCommand || '/back').trim()
    return command || '/back'
  }

  function isActive(currentRunId) {
    return enabled && pendingDeathRunId === currentRunId
  }

  async function handleDeath(currentRunId) {
    const respawnDelayMs = getRespawnDelayMs()
    if (respawnDelayMs > 0) {
      await sleep(respawnDelayMs)
    }

    if (!isActive(currentRunId)) return

    if (typeof bot.respawn === 'function') {
      bot.respawn()
      waitingForSpawn = true
      logInfo(`Auto back requested respawn in ${respawnDelayMs}ms.`)
      return
    }

    logInfo('Auto back could not respawn because bot.respawn() is unavailable.')
  }

  async function handleSpawnAfterDeath(currentRunId) {
    const backDelayMs = getBackDelayMs()
    if (backDelayMs > 0) {
      await sleep(backDelayMs)
    }

    if (!isActive(currentRunId)) return

    const command = getBackCommand()
    bot.chat(command)
    logInfo(`Auto back sent: ${command}`)
  }

  function onDeath() {
    if (!enabled) return

    runId += 1
    pendingDeathRunId = runId
    waitingForSpawn = false

    logInfo('Auto back detected death.')
    void handleDeath(pendingDeathRunId).catch((error) => {
      if (!isActive(pendingDeathRunId)) return
      console.error('Auto back failed to respawn:', error.message)
    })
  }

  function onSpawn() {
    if (!enabled || !waitingForSpawn) return

    const currentRunId = pendingDeathRunId
    waitingForSpawn = false

    logInfo('Auto back detected respawn.')
    void handleSpawnAfterDeath(currentRunId).catch((error) => {
      if (!isActive(currentRunId)) return
      console.error('Auto back failed to send /back:', error.message)
    })
  }

  function onReady() {
    if (!config.enabled) return
    startAutoBack()
  }

  function startAutoBack() {
    if (enabled) {
      logInfo('Auto back is already enabled.')
      return
    }

    enabled = true
    runId += 1
    pendingDeathRunId = 0
    waitingForSpawn = false
    logInfo(`Auto back enabled. command=${getBackCommand()}.`)
  }

  async function stopAutoBack({ announceIfIdle = true } = {}) {
    if (!enabled) {
      if (announceIfIdle) {
        logInfo('Auto back is already disabled.')
      }
      return
    }

    enabled = false
    runId += 1
    pendingDeathRunId = 0
    waitingForSpawn = false

    if (announceIfIdle) {
      logInfo('Auto back disabled.')
    }
  }

  async function handleCommand(message) {
    const normalized = message.trim().toLowerCase()

    if (normalized === '/autoback start') {
      startAutoBack()
      return true
    }

    if (normalized === '/autoback stop') {
      await stopAutoBack()
      return true
    }

    if (normalized === '/autoback status') {
      if (!enabled) {
        logInfo('Auto back is disabled.')
      } else {
        logInfo(
          `Auto back is enabled. respawnDelay=${getRespawnDelayMs()}ms, backDelay=${getBackDelayMs()}ms, command=${getBackCommand()}.`
        )
      }
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /autoback start',
      'Local command: /autoback stop',
      'Local command: /autoback status'
    ]
  }

  function onDisconnect() {
    runId += 1
    pendingDeathRunId = 0
    waitingForSpawn = false
  }

  async function stop() {
    await stopAutoBack({ announceIfIdle: false })
  }

  return {
    getCommandHelp,
    handleCommand,
    onDeath,
    onDisconnect,
    onSpawn,
    onReady,
    stop
  }
}

module.exports = {
  createAutoBackFeature
}
