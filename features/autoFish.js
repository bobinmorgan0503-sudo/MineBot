function createAutoFishFeature({
  bot,
  config,
  logInfo,
  sleep
}) {
  let enabled = false
  let runId = 0
  let autoStartTimer = null
  let running = false

  function clearAutoStartTimer() {
    if (!autoStartTimer) return
    clearTimeout(autoStartTimer)
    autoStartTimer = null
  }

  function isActive(currentRunId) {
    return enabled && runId === currentRunId
  }

  function findFishingRod() {
    return bot.inventory.items().find((item) => item.name.includes('fishing_rod')) || null
  }

  async function equipFishingRod() {
    const rod = findFishingRod()
    if (!rod) {
      throw new Error('No fishing rod found in inventory.')
    }

    if (!bot.heldItem || bot.heldItem.type !== rod.type) {
      await bot.equip(rod, 'hand')
    }
  }

  function findLikelyOwnBobber() {
    if (!bot.entity) return null

    const maxDistance = Number(config.bobberDistance || 48)
    const entities = Object.values(bot.entities)

    return entities.find((entity) => {
      if (!entity || entity.name !== 'fishing_bobber' || !entity.position) return false
      return bot.entity.position.distanceTo(entity.position) <= maxDistance
    }) || null
  }

  async function reelInIfNeeded() {
    const bobber = findLikelyOwnBobber()
    if (!bobber) return

    await equipFishingRod()
    bot.activateItem()
    await sleep(250)
  }

  async function autoFishLoop(currentRunId) {
    if (running) return
    running = true

    try {
      const startDelayMs = Number(config.startDelayMs || 0)
      const retryDelayMs = Number(config.retryDelayMs || 2000)
      const cycleDelayMs = Number(config.cycleDelayMs || 600)

      if (startDelayMs > 0) {
        logInfo(`Auto fish will cast in ${Math.round(startDelayMs / 1000)} seconds.`)
        await sleep(startDelayMs)
      }

      while (isActive(currentRunId)) {
        try {
          await equipFishingRod()
          await bot.fish()
        } catch (error) {
          if (!isActive(currentRunId)) break
          console.error('Auto fish cycle failed:', error.message)
          await sleep(retryDelayMs)
          continue
        }

        if (!isActive(currentRunId)) break
        if (cycleDelayMs > 0) {
          await sleep(cycleDelayMs)
        }
      }
    } catch (error) {
      if (isActive(currentRunId)) {
        console.error('Auto fish loop failed:', error.message)
      }
    } finally {
      try {
        await reelInIfNeeded()
      } catch (error) {
        console.error('Failed to reel in while stopping auto fish:', error.message)
      }

      if (runId === currentRunId) enabled = false
      running = false
      logInfo('Auto fish stopped.')
    }
  }

  function startAutoFish() {
    if (enabled) {
      logInfo('Auto fish is already running.')
      return
    }

    if (typeof bot.fish !== 'function') {
      logInfo('This Mineflayer version does not expose bot.fish().')
      return
    }

    clearAutoStartTimer()
    enabled = true
    runId += 1
    const currentRunId = runId
    logInfo('Auto fish enabled.')

    void autoFishLoop(currentRunId)
  }

  async function stopAutoFish() {
    clearAutoStartTimer()
    enabled = false
    runId += 1

    try {
      await reelInIfNeeded()
    } catch (error) {
      console.error('Failed to reel in while stopping auto fish:', error.message)
    }

    logInfo('Auto fish stop requested.')
  }

  async function handleCommand(message) {
    const normalized = message.toLowerCase()

    if (normalized === '/autofish start' || normalized === '/fish start') {
      startAutoFish()
      return true
    }

    if (normalized === '/fish stop' || normalized === '/autofish stop') {
      await stopAutoFish()
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /autofish start',
      'Local command: /autofish stop'
    ]
  }

  function onReady() {
    clearAutoStartTimer()

    if (!config.enabled || config.autoStartDelayMs < 0) return

    autoStartTimer = setTimeout(() => {
      autoStartTimer = null
      startAutoFish()
    }, config.autoStartDelayMs)

    logInfo(`Auto fish will auto-start in ${Math.round(config.autoStartDelayMs / 1000)} seconds.`)
  }

  function onDisconnect() {
    clearAutoStartTimer()
    enabled = false
    runId += 1
    running = false
  }

  async function stop() {
    await stopAutoFish()
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
  createAutoFishFeature
}
