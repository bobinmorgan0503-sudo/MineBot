const { once } = require('events')
const { Vec3 } = require('vec3')

function createSieveFeature({
  bot,
  config,
  logInfo,
  logVerbose,
  sleep
}) {
  let sieveEnabled = false
  let sieveRunId = 0
  let interactionSequence = 0

  function isSieveActive(runId) {
    return sieveEnabled && sieveRunId === runId
  }

  function assertSieveActive(runId) {
    if (!isSieveActive(runId)) {
      throw new Error('Sieve loop stopped.')
    }
  }

  async function sleepSieve(ms, runId) {
    await sleep(ms)
    assertSieveActive(runId)
  }

  async function waitForWindow(runId, timeoutMs) {
    assertSieveActive(runId)

    const windowPromise = once(bot, 'windowOpen').then(([window]) => window)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out waiting for window after ${timeoutMs}ms.`)), timeoutMs)
    })

    const window = await Promise.race([windowPromise, timeoutPromise])
    assertSieveActive(runId)
    return window
  }

  async function closeAllWindows(runId = sieveRunId) {
    for (let i = 0; i < 5; i++) {
      if (!bot.currentWindow) return
      bot.closeWindow(bot.currentWindow)
      await sleep(150)
      if (sieveEnabled && runId === sieveRunId) assertSieveActive(runId)
    }
  }

  function nextInteractionSequence() {
    const sequence = interactionSequence
    interactionSequence += 1
    return sequence
  }

  async function sendUseBlockPacket(position, runId, label) {
    assertSieveActive(runId)

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
    const window = await waitForWindow(runId, config.containerOpenTimeoutMs)
    return window
  }

  async function takeGravel(runId) {
    await openGravelContainer(runId)
    logVerbose(`Shift-clicking gravel slot ${config.gravelSlot}.`)
    await bot.clickWindow(config.gravelSlot, 0, 1)
  }

  async function doClickSequence(runId, cycle) {
    await sendUseBlockPacket(config.trapdoorPos, runId, 'trapdoor')
    await sendUseBlockPacket(config.fencePos1, runId, 'fence 1')
    await sendUseBlockPacket(config.fencePos1, runId, 'fence 1')

    if (cycle % 2 === 0) {
      await sendUseBlockPacket(config.fencePos2, runId, 'fence 2')
    }
  }

  async function runSieveCycle(runId, cycle) {
    await takeGravel(runId)
    await doClickSequence(runId, cycle)
  }

  async function sieveLoop(runId) {
    let cycle = 0

    while (isSieveActive(runId)) {
      try {
        cycle += 1
        await runSieveCycle(runId, cycle)
        logVerbose(`Sieve cycle ${cycle} completed.`)
        await sleepSieve(config.tickDelayMs, runId)
      } catch (error) {
        if (!isSieveActive(runId)) break
        console.error('Sieve cycle failed:', error.message)
        await closeAllWindows(runId).catch(() => {})
        await sleep(1500)
      }
    }

    if (sieveRunId === runId) sieveEnabled = false
    logInfo('Sieve loop stopped.')
  }

  function startSieve() {
    if (sieveEnabled) {
      logInfo('Sieve loop is already running.')
      return
    }

    sieveEnabled = true
    sieveRunId += 1
    const runId = sieveRunId
    logInfo('Sieve loop enabled.')
    void (async () => {
      try {
        await openGravelContainer(runId)
        await sieveLoop(runId)
      } catch (error) {
        if (isSieveActive(runId)) {
          console.error('Failed to start sieve loop:', error.message)
        }
        sieveEnabled = false
      }
    })()
  }

  async function stopSieve() {
    sieveEnabled = false
    sieveRunId += 1
    await closeAllWindows()
    logInfo('Sieve loop stopped and windows were closed.')
  }

  function parseUseBlockCommand(input) {
    const match = input.match(/^\/useblock\s+\[\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\]$/i)
    if (!match) return null

    return new Vec3(
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10),
      Number.parseInt(match[3], 10)
    )
  }

  async function useBlockAt(position) {
    const block = bot.blockAt(position)

    if (!block) {
      logInfo(`No block found at ${position.x}, ${position.y}, ${position.z}.`)
      return
    }

    if (!bot.entity) {
      logInfo('Bot entity is not ready yet.')
      return
    }

    const target = block.position.offset(0.5, 0.5, 0.5)
    const distance = bot.entity.position.distanceTo(target)
    if (distance > 6) {
      logInfo(`Block is too far away to use (${distance.toFixed(2)} blocks).`)
      return
    }

    try {
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
      logInfo(`Used block at ${position.x}, ${position.y}, ${position.z}.`)
    } catch (error) {
      console.error('Failed to use block:', error.message)
    }
  }

  async function handleCommand(message) {
    const normalized = message.toLowerCase()

    if (normalized === '/sieve start') {
      startSieve()
      return true
    }

    if (normalized === '/sieve stop') {
      await stopSieve()
      return true
    }

    const useBlockPosition = parseUseBlockCommand(message)
    if (useBlockPosition) {
      await useBlockAt(useBlockPosition)
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /sieve start',
      'Local command: /sieve stop',
      'Local command: /useblock [x,y,z]'
    ]
  }

  async function stop() {
    await stopSieve()
  }

  function onDisconnect() {
    sieveEnabled = false
  }

  return {
    getCommandHelp,
    handleCommand,
    onDisconnect,
    stop
  }
}

module.exports = {
  createSieveFeature
}
