const { Vec3 } = require('vec3')

const REPLANTABLE_CROPS = {
  wheat: { seed: 'wheat_seeds', maxAge: 7, surfaces: ['farmland'] },
  carrots: { seed: 'carrot', maxAge: 7, surfaces: ['farmland'] },
  potatoes: { seed: 'potato', maxAge: 7, surfaces: ['farmland'] },
  beetroots: { seed: 'beetroot_seeds', maxAge: 3, surfaces: ['farmland'] },
  nether_wart: { seed: 'nether_wart', maxAge: 3, surfaces: ['soul_sand'] },
  cocoa: { seed: 'cocoa_beans', maxAge: 2, surfaces: ['jungle_log', 'stripped_jungle_log'] }
}

const INTERACT_HARVEST_CROPS = new Set([
  'sweet_berry_bush',
  'cave_vines',
  'cave_vines_plant'
])

const TALL_CROPS = new Set(['sugar_cane', 'cactus', 'bamboo', 'kelp'])
const FRUIT_CROPS = new Set(['melon', 'pumpkin'])

function createAutoFarmFeature({ bot, config, logInfo, sleep }) {
  let enabled = false
  let runId = 0
  let autoStartTimer = null
  let activeCrops = new Set()
  let actionSequence = 0
  const replantQueue = new Map()

  function nextActionSequence() {
    const sequence = actionSequence
    actionSequence += 1
    return sequence
  }

  function shouldFaceTarget() {
    return config.faceTarget !== false
  }

  function shouldSwingHand() {
    return config.swingHand !== false
  }

  function sendDigPacket(status, position) {
    if (!bot._client || typeof bot._client.write !== 'function') {
      throw new Error('Protocol client is not ready yet.')
    }

    const payload = {
      status,
      location: { x: position.x, y: position.y, z: position.z },
      face: 1,
      sequence: nextActionSequence()
    }

    try {
      bot._client.write('block_dig', payload)
    } catch {
      bot._client.write('player_action', payload)
    }
  }

  async function faceBlock(block) {
    if (!shouldFaceTarget() || typeof bot.lookAt !== 'function') return
    await bot.lookAt(block.position.offset(0.5, 0.5, 0.5), true)
  }

  function swingHand() {
    if (shouldSwingHand() && typeof bot.swingArm === 'function') {
      bot.swingArm('right')
    }
  }

  function sendBlockInteractionPacket(block) {
    if (!bot._client || typeof bot._client.write !== 'function') {
      throw new Error('Protocol client is not ready yet.')
    }

    const payload = {
      location: block.position,
      direction: 1,
      hand: 0,
      cursorX: 0.5,
      cursorY: 0.5,
      cursorZ: 0.5
    }

    if (bot.supportFeature('blockPlaceHasHeldItem')) {
      const Item = require('prismarine-item')(bot.registry)
      payload.heldItem = Item.toNotch(bot.heldItem)
      delete payload.hand
      payload.cursorX = 8
      payload.cursorY = 8
      payload.cursorZ = 8
    } else if (bot.supportFeature('blockPlaceHasHandAndIntCursor')) {
      payload.cursorX = 8
      payload.cursorY = 8
      payload.cursorZ = 8
    } else if (bot.supportFeature('blockPlaceHasInsideBlock')) {
      payload.insideBlock = false
      payload.sequence = nextActionSequence()
      payload.worldBorderHit = false
    }

    bot._client.write('block_place', payload)
  }

  async function harvestByMining(block, id) {
    if (shouldSwingHand()) {
      await bot.dig(block, shouldFaceTarget() ? true : 'ignore')
      assertActive(id)
      return
    }

    await faceBlock(block)
    assertActive(id)
    sendDigPacket(0, block.position)
    const configuredDelay = Number(config.packetDigDelayMs)
    let packetDelay = Number.isFinite(configuredDelay) && configuredDelay >= 0
      ? configuredDelay
      : 0
    // Melons and pumpkins are not instant-break crops. Keep their real dig time
    // even when packet mode is configured with no delay.
    if (FRUIT_CROPS.has(block.name) && typeof bot.digTime === 'function') {
      const digTime = Number(bot.digTime(block))
      if (Number.isFinite(digTime)) packetDelay = Math.max(packetDelay, digTime)
    }
    if (packetDelay > 0) await sleep(packetDelay)
    assertActive(id)
    sendDigPacket(2, block.position)
  }

  async function harvestByInteracting(block, id) {
    await faceBlock(block)
    assertActive(id)
    sendBlockInteractionPacket(block)
    swingHand()
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '_')
  }

  function getConfiguredCrops() {
    return Array.from(new Set((Array.isArray(config.targetCrops) ? config.targetCrops : [])
      .map(normalizeName)
      .filter(Boolean)))
  }

  function getCurrentCrops() {
    return activeCrops.size > 0 ? Array.from(activeCrops) : getConfiguredCrops()
  }

  function isActive(id) {
    return enabled && runId === id
  }

  function assertActive(id) {
    if (!isActive(id)) throw new Error('Auto farm stopped.')
  }

  function getProperties(block) {
    if (!block) return {}
    if (typeof block.getProperties === 'function') return block.getProperties() || {}
    return block.stateProperties || {}
  }

  function isMature(block) {
    const crop = REPLANTABLE_CROPS[block.name]
    if (!crop) return false
    return Number(getProperties(block).age) >= crop.maxAge
  }

  function isTallCropTop(block) {
    if (!TALL_CROPS.has(block.name)) return false
    const above = bot.blockAt(block.position.offset(0, 1, 0))
    const below = bot.blockAt(block.position.offset(0, -1, 0))
    return above?.name !== block.name && below?.name === block.name
  }

  function isInteractHarvestable(block) {
    if (!INTERACT_HARVEST_CROPS.has(block.name)) return false
    const properties = getProperties(block)
    return block.name === 'sweet_berry_bush'
      ? Number(properties.age) >= 2
      : properties.berries === true || properties.berries === 'true'
  }

  function isHarvestable(block) {
    return Boolean(block) && (isMature(block) || isTallCropTop(block) ||
      isInteractHarvestable(block) || FRUIT_CROPS.has(block.name))
  }

  function isWithinRange(position) {
    if (!bot.entity || !position) return false
    const range = Math.max(1, Number(config.searchRange) || 5)
    return bot.entity.position.distanceTo(position.offset(0.5, 0.5, 0.5)) <= range
  }

  function findCandidates() {
    if (!bot.entity) return []
    const targetIds = Array.from(new Set(getCurrentCrops()
      .map((name) => bot.registry?.blocksByName?.[name]?.id)
      .filter(Number.isInteger)))
    if (targetIds.length === 0) return []

    const range = Math.max(1, Number(config.searchRange) || 5)
    const count = Math.max(1, Number(config.searchCount) || 128)
    return bot.findBlocks({
      // Passing numeric block IDs lets Mineflayer reject whole chunk palettes
      // before visiting individual blocks, which is much faster than a callback.
      matching: targetIds,
      maxDistance: range,
      count
    })
      .map((position) => bot.blockAt(position))
      .filter(isHarvestable)
  }

  function queueReplant(block) {
    const crop = REPLANTABLE_CROPS[block.name]
    if (!config.replant || !crop) return
    replantQueue.set(`${block.position.x},${block.position.y},${block.position.z}`, {
      position: block.position.clone(),
      seed: crop.seed,
      surfaces: crop.surfaces
    })
  }

  async function equipSeed(seed) {
    const item = bot.inventory.items().find((entry) => entry.name === seed)
    if (!item) return false
    if (bot.heldItem?.type !== item.type) await bot.equip(item, 'hand')
    return true
  }

  async function replantNext(id) {
    for (const [key, target] of replantQueue) {
      assertActive(id)
      if (!isWithinRange(target.position)) continue
      const current = bot.blockAt(target.position)
      let support = bot.blockAt(target.position.offset(0, -1, 0))
      let face = new Vec3(0, 1, 0)
      if (target.seed === 'cocoa_beans') {
        const directions = [
          new Vec3(1, 0, 0), new Vec3(-1, 0, 0),
          new Vec3(0, 0, 1), new Vec3(0, 0, -1)
        ]
        for (const direction of directions) {
          const neighbor = bot.blockAt(target.position.minus(direction))
          if (neighbor && target.surfaces.includes(neighbor.name)) {
            support = neighbor
            face = direction
            break
          }
        }
      }
      if (current?.name !== 'air') {
        replantQueue.delete(key)
        continue
      }
      if (!support || !target.surfaces.includes(support.name)) {
        replantQueue.delete(key)
        continue
      }
      if (!(await equipSeed(target.seed))) {
        if (!target.missingSeedWarned) {
          logInfo(`Cannot replant at ${target.position}: no ${target.seed} in inventory yet.`)
          target.missingSeedWarned = true
        }
        continue
      }

      assertActive(id)
      if (typeof bot._placeBlockWithOptions !== 'function') {
        throw new Error('This Mineflayer version cannot configure planting rotation and hand swing.')
      }
      await bot._placeBlockWithOptions(support, face, {
        forceLook: shouldFaceTarget() ? true : 'ignore',
        swingArm: shouldSwingHand() ? 'right' : undefined
      })
      replantQueue.delete(key)
      logInfo(`Replanted ${target.seed} at ${target.position.x}, ${target.position.y}, ${target.position.z}.`)
      return true
    }
    return false
  }

  async function harvest(block, id) {
    assertActive(id)
    const current = bot.blockAt(block.position)
    if (!current || !isHarvestable(current)) return false

    if (isInteractHarvestable(current)) {
      await harvestByInteracting(current, id)
    } else {
      queueReplant(current)
      await harvestByMining(current, id)
    }
    return true
  }

  async function loop(id) {
    const idleDelay = Math.max(50, Number(config.idleDelayMs) || 2000)
    const configuredActionDelay = Number(config.actionDelayMs)
    const actionDelay = Number.isFinite(configuredActionDelay) && configuredActionDelay >= 0
      ? configuredActionDelay
      : 0
    const configuredCycleDelay = Number(config.cycleDelayMs)
    const cycleDelay = Number.isFinite(configuredCycleDelay) && configuredCycleDelay >= 0
      ? configuredCycleDelay
      : 10
    const maxActions = Math.max(1, Math.floor(Number(config.maxActionsPerCycle) || 32))
    while (isActive(id)) {
      try {
        if (await replantNext(id)) {
          if (actionDelay > 0) await sleep(actionDelay)
          continue
        }
        const candidates = findCandidates()
        if (candidates.length === 0) {
          await sleep(idleDelay)
          continue
        }

        let actions = 0
        for (const candidate of candidates) {
          assertActive(id)
          if (actions >= maxActions) break
          if (!(await harvest(candidate, id))) continue
          actions += 1
          if (actionDelay > 0) await sleep(actionDelay)
        }

        // All candidates may have changed after the scan. Yield briefly so block
        // updates can arrive without falling back to the much longer idle delay.
        if (actions === 0) await sleep(Math.min(idleDelay, 50))
        else await sleep(cycleDelay)
      } catch (error) {
        if (!isActive(id)) break
        if (error?.name === 'GoalChanged' || error?.name === 'PathStopped') break
        logInfo(`Auto farm skipped an action: ${error.message}`)
        await sleep(idleDelay)
      }
    }
    if (runId === id) {
      enabled = false
      activeCrops.clear()
    }
    logInfo('Auto farm stopped.')
  }

  function start(crops = []) {
    if (!bot.entity) {
      logInfo('Auto farm is unavailable until the bot is ready.')
      return
    }
    const selected = crops.length ? crops : getConfiguredCrops()
    if (!selected.length) {
      logInfo('Auto farm needs at least one crop name in targetCrops.')
      return
    }
    if (enabled) {
      logInfo(`Auto farm is already running for ${getCurrentCrops().join(', ')}.`)
      return
    }
    enabled = true
    activeCrops = new Set(selected)
    const id = ++runId
    logInfo(`Auto farm enabled for ${selected.join(', ')}.`)
    void loop(id)
  }

  function stop({ announce = true } = {}) {
    if (autoStartTimer) clearTimeout(autoStartTimer)
    autoStartTimer = null
    if (!enabled) {
      if (announce) logInfo('Auto farm is already stopped.')
      return
    }
    enabled = false
    activeCrops.clear()
    replantQueue.clear()
    runId += 1
    if (announce) logInfo('Auto farm stop requested.')
  }

  async function handleCommand(message) {
    const trimmed = message.trim()
    const normalized = trimmed.toLowerCase()
    if (normalized === '/autofarm stop' || normalized === '/farm stop') {
      stop()
      return true
    }
    if (normalized === '/autofarm status' || normalized === '/farm status') {
      logInfo(enabled ? `Auto farm is running for ${getCurrentCrops().join(', ')}.` : 'Auto farm is stopped.')
      return true
    }
    const match = trimmed.match(/^\/(?:autofarm|farm)\s+start(?:\s+(.+))?$/i)
    if (!match) return false
    start(match[1] ? match[1].split(/[,\s]+/).map(normalizeName).filter(Boolean) : [])
    return true
  }

  function onReady() {
    if (!config.enabled || Number(config.autoStartDelayMs) < 0) return
    autoStartTimer = setTimeout(() => {
      autoStartTimer = null
      start()
    }, Math.max(0, Number(config.autoStartDelayMs) || 0))
  }

  return {
    getCommandHelp: () => [
      'Local command: /autofarm start [crop_name ...]',
      'Local command: /autofarm stop',
      'Local command: /autofarm status'
    ],
    handleCommand,
    onReady,
    onDisconnect: () => stop({ announce: false }),
    stop: () => stop({ announce: false })
  }
}

module.exports = { createAutoFarmFeature }
