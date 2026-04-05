const { once } = require('events')

function createMakeuFeature({
  bot,
  config,
  logInfo,
  logVerbose,
  sleep
}) {
  let makeuEnabled = false
  let makeuRunId = 0
  let interactionSequence = 0

  function isMakeuActive(runId) {
    return makeuEnabled && makeuRunId === runId
  }

  function assertMakeuActive(runId) {
    if (!isMakeuActive(runId)) {
      throw new Error('Makeu loop stopped.')
    }
  }

  async function sleepMakeu(ms, runId) {
    await sleep(ms)
    assertMakeuActive(runId)
  }

  async function waitForWindow(runId, timeoutMs) {
    assertMakeuActive(runId)

    const windowPromise = once(bot, 'windowOpen').then(([window]) => window)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out waiting for window after ${timeoutMs}ms.`)), timeoutMs)
    })

    const window = await Promise.race([windowPromise, timeoutPromise])
    assertMakeuActive(runId)
    return window
  }

  async function closeAllWindows(runId = makeuRunId) {
    for (let i = 0; i < 5; i++) {
      if (!bot.currentWindow) return
      bot.closeWindow(bot.currentWindow)
      await sleep(150)
      if (makeuEnabled && runId === makeuRunId) assertMakeuActive(runId)
    }
  }

  function nextInteractionSequence() {
    const sequence = interactionSequence
    interactionSequence += 1
    return sequence
  }

  async function sendUseBlockPacket(position, runId, label) {
    assertMakeuActive(runId)

    const block = bot.blockAt(position)
    if (!block) {
      throw new Error(`No block found for ${label} at ${position.x}, ${position.y}, ${position.z}.`)
    }

    if (!bot.entity) {
      throw new Error('Bot entity is not ready yet.')
    }

    const target = block.position.offset(0.5, 0.5, 0.5)
    const distance = bot.entity.position.distanceTo(target)
    if (distance > 6) {
      throw new Error(`${label} is too far away (${distance.toFixed(2)} blocks).`)
    }

    if (!bot._client || typeof bot._client.write !== 'function') {
      throw new Error('Protocol client is not ready yet.')
    }

    bot._client.write('block_place', {
      hand: 0,
      location: {
        x: position.x,
        y: position.y,
        z: position.z
      },
      direction: config.blockFaceDown,
      cursorX: config.interactCursor,
      cursorY: config.interactCursor,
      cursorZ: config.interactCursor,
      insideBlock: false,
      sequence: nextInteractionSequence()
    })
  }

  async function openGravelContainer(runId) {
    if (bot.currentWindow) {
      return bot.currentWindow
    }

    await sendUseBlockPacket(config.gravelContainerPos, runId, 'gravel container')
    return waitForWindow(runId, config.containerOpenTimeoutMs)
  }

  async function takeGravel(runId) {
    await openGravelContainer(runId)
    logVerbose(`Shift-clicking makeu gravel slot ${config.gravelSlot}.`)
    await bot.clickWindow(config.gravelSlot, 0, 1)
  }

  async function doClickSequence(runId, cycle) {
    await sendUseBlockPacket(config.trapdoorPos, runId, 'trapdoor')
    await sendUseBlockPacket(config.fencePos, runId, 'fence')
    await sendUseBlockPacket(config.fencePos, runId, 'fence')

    if (cycle % 2 === 0) {
      await sendUseBlockPacket(config.fencePos1, runId, 'fence 1')
      await sendUseBlockPacket(config.fencePos2, runId, 'fence 2')
      await sendUseBlockPacket(config.fencePos3, runId, 'fence 3')
      await sendUseBlockPacket(config.fencePos4, runId, 'fence 4')
    }
  }

  async function runMakeuCycle(runId, cycle) {
    await takeGravel(runId)
    await doClickSequence(runId, cycle)
  }

  async function makeuLoop(runId) {
    let cycle = 0

    while (isMakeuActive(runId)) {
      try {
        cycle += 1
        await runMakeuCycle(runId, cycle)
        logVerbose(`Makeu cycle ${cycle} completed.`)
        await sleepMakeu(config.tickDelayMs, runId)
      } catch (error) {
        if (!isMakeuActive(runId)) break
        console.error('Makeu cycle failed:', error.message)
        await closeAllWindows(runId).catch(() => {})
        await sleep(1500)
      }
    }

    if (makeuRunId === runId) makeuEnabled = false
    logInfo('Makeu loop stopped.')
  }

  function startMakeu() {
    if (makeuEnabled) {
      logInfo('Makeu loop is already running.')
      return
    }

    makeuEnabled = true
    makeuRunId += 1
    const runId = makeuRunId
    logInfo('Makeu loop enabled.')
    void (async () => {
      try {
        await openGravelContainer(runId)
        await makeuLoop(runId)
      } catch (error) {
        if (isMakeuActive(runId)) {
          console.error('Failed to start makeu loop:', error.message)
        }
        makeuEnabled = false
      }
    })()
  }

  async function stopMakeu() {
    makeuEnabled = false
    makeuRunId += 1
    await closeAllWindows()
    logInfo('Makeu loop stopped and windows were closed.')
  }

  async function handleCommand(message) {
    const normalized = message.toLowerCase()

    if (normalized === '/makeu start') {
      startMakeu()
      return true
    }

    if (normalized === '/makeu stop') {
      await stopMakeu()
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /makeu start',
      'Local command: /makeu stop'
    ]
  }

  async function stop() {
    await stopMakeu()
  }

  function onDisconnect() {
    makeuEnabled = false
  }

  return {
    getCommandHelp,
    handleCommand,
    onDisconnect,
    stop
  }
}

module.exports = {
  createMakeuFeature
}
