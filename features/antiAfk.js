function createAntiAfkFeature({
  bot,
  config,
  logInfo,
  sleep
}) {
  let enabled = Boolean(config.enabled)
  let runId = 0
  let running = false
  let timer = null

  function stopAllMovement() {
    bot.setControlState('forward', false)
    bot.setControlState('back', false)
    bot.setControlState('left', false)
    bot.setControlState('right', false)
    bot.setControlState('jump', false)
    bot.setControlState('sprint', false)
  }

  function clearTimer() {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  function isActive(currentRunId) {
    return enabled && runId === currentRunId
  }

  function randomPointInRadius(baseX, baseZ, radius) {
    const angle = Math.random() * Math.PI * 2
    const distance = radius * Math.sqrt(Math.random())

    return {
      x: baseX + Math.cos(angle) * distance,
      z: baseZ + Math.sin(angle) * distance
    }
  }

  function worldToLocal(dx, dz, yaw) {
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    const rightX = Math.cos(yaw)
    const rightZ = -Math.sin(yaw)

    return {
      forward: dx * forwardX + dz * forwardZ,
      right: dx * rightX + dz * rightZ
    }
  }

  function applyControlToTarget(dx, dz, yaw, deadzone) {
    const local = worldToLocal(dx, dz, yaw)

    bot.setControlState('forward', local.forward > deadzone)
    bot.setControlState('back', local.forward < -deadzone)
    bot.setControlState('right', local.right > deadzone)
    bot.setControlState('left', local.right < -deadzone)
  }

  async function waitForPhysicsTick() {
    if (typeof bot.waitForTicks === 'function') {
      await bot.waitForTicks(1)
      return
    }

    await sleep(50)
  }

  async function moveToWorldPoint(targetX, targetZ, currentRunId) {
    const tolerance = Number(config.reachTolerance || 0.03)
    const maxTicks = Number(config.maxTicks || 60)
    const deadzone = Math.max(tolerance / 3, 0.005)

    let ticks = 0

    while (isActive(currentRunId) && bot.entity && ticks < maxTicks) {
      const dx = targetX - bot.entity.position.x
      const dz = targetZ - bot.entity.position.z

      if (Math.hypot(dx, dz) <= tolerance) break

      applyControlToTarget(dx, dz, bot.entity.yaw, deadzone)
      await waitForPhysicsTick()
      ticks += 1
    }

    stopAllMovement()
  }

  async function runStep(currentRunId) {
    if (running || !bot.entity || !isActive(currentRunId)) return
    running = true

    const radius = Number(config.radius || 0.1)
    const base = bot.entity.position.clone()
    const target = randomPointInRadius(base.x, base.z, radius)

    try {
      await moveToWorldPoint(target.x, target.z, currentRunId)
      if (!isActive(currentRunId)) return
      await sleep(Number(config.stepPauseMs || 100))
      await moveToWorldPoint(base.x, base.z, currentRunId)
    } catch (error) {
      if (isActive(currentRunId)) {
        console.error('Anti-AFK step failed:', error.message)
      }
    } finally {
      stopAllMovement()
      running = false
    }
  }

  function startLoop() {
    clearTimer()

    if (!enabled) return

    const currentRunId = runId
    const intervalMs = Number(config.intervalMs || 30000)
    timer = setInterval(() => {
      void runStep(currentRunId)
    }, intervalMs)

    logInfo(`Anti-AFK enabled (interval ${intervalMs}ms).`)
  }

  function enable() {
    if (enabled) {
      logInfo('Anti-AFK is already enabled.')
      return
    }

    enabled = true
    runId += 1
    startLoop()
  }

  async function disable() {
    if (!enabled) {
      logInfo('Anti-AFK is already disabled.')
      return
    }

    enabled = false
    runId += 1
    clearTimer()
    stopAllMovement()
    logInfo('Anti-AFK disabled.')
  }

  async function handleCommand(message) {
    const normalized = message.toLowerCase()

    if (normalized === '/autoafk start' || normalized === '/afk start' || normalized === '/antiafk start') {
      enable()
      return true
    }

    if (normalized === '/autoafk stop' || normalized === '/afk stop' || normalized === '/antiafk stop') {
      await disable()
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /autoafk start',
      'Local command: /autoafk stop'
    ]
  }

  function onReady() {
    if (!enabled) return
    runId += 1
    startLoop()
  }

  function onDisconnect() {
    clearTimer()
    stopAllMovement()
    runId += 1
    running = false
  }

  async function stop() {
    await disable()
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
  createAntiAfkFeature
}
