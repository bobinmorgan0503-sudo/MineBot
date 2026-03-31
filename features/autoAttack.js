const nbt = require('prismarine-nbt')

const DEFAULT_SCAN_INTERVAL_MS = 100
const LEGACY_LIVING_HEALTH_METADATA_INDEX = 7
const DEFAULT_MODERN_ATTACK_SPEED = 4
const DEFAULT_PRE_COOLDOWN_ATTACK_INTERVAL_MS = 250

const ATTACK_SPEED_BY_ITEM_NAME = {
  wooden_sword: 1.6,
  golden_sword: 1.6,
  stone_sword: 1.6,
  iron_sword: 1.6,
  diamond_sword: 1.6,
  netherite_sword: 1.6,
  wooden_axe: 0.8,
  golden_axe: 1.0,
  stone_axe: 0.8,
  iron_axe: 0.9,
  diamond_axe: 1.0,
  netherite_axe: 1.0,
  wooden_pickaxe: 1.2,
  golden_pickaxe: 1.2,
  stone_pickaxe: 1.2,
  iron_pickaxe: 1.2,
  diamond_pickaxe: 1.2,
  netherite_pickaxe: 1.2,
  wooden_shovel: 1.0,
  golden_shovel: 1.0,
  stone_shovel: 1.0,
  iron_shovel: 1.0,
  diamond_shovel: 1.0,
  netherite_shovel: 1.0,
  wooden_hoe: 1.0,
  golden_hoe: 1.0,
  stone_hoe: 2.0,
  iron_hoe: 3.0,
  diamond_hoe: 4.0,
  netherite_hoe: 4.0,
  trident: 1.1
}

function createAutoAttackFeature({
  bot,
  config,
  logInfo,
  sleep
}) {
  let enabled = false
  let runId = 0
  let autoStartTimer = null
  let lastActionAt = 0

  function clearAutoStartTimer() {
    if (!autoStartTimer) return
    clearTimeout(autoStartTimer)
    autoStartTimer = null
  }

  function getConfigValue(...keys) {
    for (const key of keys) {
      if (config[key] !== undefined) return config[key]
    }

    return undefined
  }

  function normalizeName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '')
  }

  function normalizeChoice(value, fallback) {
    const normalized = normalizeName(value)
    return normalized || fallback
  }

  function normalizeRegistryName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  }

  function normalizeAttributeName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[:._\s-]+/g, '')
  }

  function normalizeSlotName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[_\s-]+/g, '')
  }

  function isAttackSpeedAttributeName(value) {
    const normalized = normalizeAttributeName(value)
    return normalized === 'genericattackspeed' || normalized === 'minecraftattackspeed'
  }

  function isMainHandSlot(value) {
    const normalized = normalizeSlotName(value)
    return normalized === '' || normalized === 'mainhand' || normalized === 'hand'
  }

  function getMode() {
    const mode = normalizeChoice(getConfigValue('mode', 'Mode'), 'single')
    return mode === 'multi' ? 'multi' : 'single'
  }

  function getPriority() {
    const priority = normalizeChoice(getConfigValue('priority', 'Priority'), 'distance')
    return priority === 'health' ? 'health' : 'distance'
  }

  function getInteraction() {
    const interaction = normalizeChoice(getConfigValue('interaction', 'Interaction'), 'attack')
    if (interaction === 'interact') return 'interact'
    if (interaction === 'interactat') return 'interactat'
    return 'attack'
  }

  function getListMode() {
    const listMode = normalizeChoice(getConfigValue('listMode', 'List_Mode'), 'whitelist')
    return listMode === 'blacklist' ? 'blacklist' : 'whitelist'
  }

  function getAttackRange() {
    const rawValue = Number(getConfigValue('attackRange', 'Attack_Range'))
    if (!Number.isFinite(rawValue)) return 4
    return Math.max(1, Math.min(4, rawValue))
  }

  function getScanIntervalMs() {
    const rawValue = Number(getConfigValue('scanIntervalMs', 'Scan_Interval_Ms'))
    if (!Number.isFinite(rawValue) || rawValue < 20) return DEFAULT_SCAN_INTERVAL_MS
    return rawValue
  }

  function getConfiguredEntityNames() {
    const list = getConfigValue('entitiesList', 'Entites_List', 'Entities_List')
    if (!Array.isArray(list)) return new Set()

    return new Set(
      list
        .map((name) => normalizeName(name))
        .filter(Boolean)
    )
  }

  function isActive(currentRunId) {
    return enabled && runId === currentRunId
  }

  function assertActive(currentRunId) {
    if (!isActive(currentRunId)) {
      throw new Error('Auto attack stopped.')
    }
  }

  function hasAttackCooldown() {
    return typeof bot.supportFeature === 'function' && bot.supportFeature('hasAttackCooldown')
  }

  function getAttributeValue(prop) {
    if (!prop || !Number.isFinite(Number(prop.value))) return null

    const modifiers = Array.isArray(prop.modifiers) ? prop.modifiers : []
    let baseValue = Number(prop.value)

    for (const modifier of modifiers) {
      if (Number(modifier.operation) !== 0) continue
      baseValue += Number(modifier.amount || 0)
    }

    let value = baseValue
    for (const modifier of modifiers) {
      if (Number(modifier.operation) !== 1) continue
      value += baseValue * Number(modifier.amount || 0)
    }

    for (const modifier of modifiers) {
      if (Number(modifier.operation) !== 2) continue
      value += value * Number(modifier.amount || 0)
    }

    return value
  }

  function getAttackSpeedAttributeProp() {
    const attributes = bot.entity && bot.entity.attributes
    if (!attributes || typeof attributes !== 'object') return null

    for (const [key, prop] of Object.entries(attributes)) {
      if (isAttackSpeedAttributeName(key)) {
        return prop
      }
    }

    return null
  }

  function getLiveAttackSpeed() {
    if (!hasAttackCooldown()) return null

    const prop = getAttackSpeedAttributeProp()
    const value = getAttributeValue(prop)
    return Number.isFinite(value) && value > 0 ? value : null
  }

  function getDefaultAttackSpeedAttributeValue() {
    const attributes = bot.registry && bot.registry.attributes
    if (!attributes || typeof attributes !== 'object') {
      return DEFAULT_MODERN_ATTACK_SPEED
    }

    for (const [key, attribute] of Object.entries(attributes)) {
      if (!isAttackSpeedAttributeName(key)) continue
      if (Number.isFinite(Number(attribute && attribute.default))) {
        return Number(attribute.default)
      }
    }

    return DEFAULT_MODERN_ATTACK_SPEED
  }

  function getHeldItemAttributeModifiersFromComponents() {
    const heldItem = bot.heldItem
    if (!heldItem) return []

    const components = Array.isArray(heldItem.components) ? heldItem.components : []
    const component = components.find((entry) => entry && entry.type === 'attribute_modifiers') ||
      (heldItem.componentMap instanceof Map ? heldItem.componentMap.get('attribute_modifiers') : null)

    if (!component || !component.data || !Array.isArray(component.data.modifiers)) {
      return []
    }

    return component.data.modifiers
      .filter((modifier) => modifier && isAttackSpeedAttributeName(modifier.type))
      .filter((modifier) => isMainHandSlot(modifier.slot))
      .map((modifier) => {
        let operation = modifier.operation
        if (typeof operation === 'string') {
          const normalized = normalizeName(operation)
          if (normalized === 'addvalue') operation = 0
          else if (normalized === 'addmultipliedbase') operation = 1
          else if (normalized === 'addmultipliedtotal') operation = 2
        }

        return {
          amount: Number(modifier.amount || 0),
          operation: Number(operation)
        }
      })
      .filter((modifier) => Number.isFinite(modifier.amount) && Number.isFinite(modifier.operation))
  }

  function getHeldItemAttributeModifiersFromNbt() {
    const heldItem = bot.heldItem
    if (!heldItem || !heldItem.nbt) return []

    let simplified
    try {
      simplified = nbt.simplify(heldItem.nbt)
    } catch {
      return []
    }

    const modifiers = Array.isArray(simplified && simplified.AttributeModifiers)
      ? simplified.AttributeModifiers
      : []

    return modifiers
      .filter((modifier) => modifier && isAttackSpeedAttributeName(modifier.AttributeName || modifier.type))
      .filter((modifier) => isMainHandSlot(modifier.Slot || modifier.slot))
      .map((modifier) => ({
        amount: Number(modifier.Amount != null ? modifier.Amount : modifier.amount || 0),
        operation: Number(modifier.Operation != null ? modifier.Operation : modifier.operation || 0)
      }))
      .filter((modifier) => Number.isFinite(modifier.amount) && Number.isFinite(modifier.operation))
  }

  function getHeldItemAttackSpeedFromModifiers() {
    if (!hasAttackCooldown()) return null

    const modifiers = [
      ...getHeldItemAttributeModifiersFromComponents(),
      ...getHeldItemAttributeModifiersFromNbt()
    ]

    if (modifiers.length === 0) return null

    return getAttributeValue({
      value: getDefaultAttackSpeedAttributeValue(),
      modifiers
    })
  }

  function getFallbackAttackSpeedFromItemTable() {
    if (!hasAttackCooldown()) return null

    const heldItemName = bot.heldItem ? normalizeRegistryName(bot.heldItem.name) : ''
    if (!heldItemName) return DEFAULT_MODERN_ATTACK_SPEED

    return (
      ATTACK_SPEED_BY_ITEM_NAME[heldItemName] ||
      ATTACK_SPEED_BY_ITEM_NAME[normalizeName(heldItemName)] ||
      DEFAULT_MODERN_ATTACK_SPEED
    )
  }

  function getCurrentAttackSpeed() {
    const liveAttackSpeed = getLiveAttackSpeed()
    if (Number.isFinite(liveAttackSpeed) && liveAttackSpeed > 0) {
      return liveAttackSpeed
    }

    const modifierAttackSpeed = getHeldItemAttackSpeedFromModifiers()
    if (Number.isFinite(modifierAttackSpeed) && modifierAttackSpeed > 0) {
      return modifierAttackSpeed
    }

    return getFallbackAttackSpeedFromItemTable()
  }

  function getCooldownMs() {
    const cooldownConfig = getConfigValue('cooldownTime', 'Cooldown_Time') || {}
    const customCooldown = Boolean(
      cooldownConfig.custom != null
        ? cooldownConfig.custom
        : cooldownConfig.Custom
    )

    if (customCooldown) {
      const configuredSeconds = Number(
        cooldownConfig.value != null
          ? cooldownConfig.value
          : cooldownConfig.Value
      )

      if (Number.isFinite(configuredSeconds) && configuredSeconds >= 0) {
        return configuredSeconds * 1000
      }
    }

    const attackSpeed = getCurrentAttackSpeed()
    if (!attackSpeed || attackSpeed <= 0) {
      return DEFAULT_PRE_COOLDOWN_ATTACK_INTERVAL_MS
    }

    return 1000 / attackSpeed
  }

  function getEntityCategory(entity) {
    if (!entity) return ''

    if (entity.kind) return String(entity.kind).toLowerCase()

    const registryEntity = bot.registry &&
      bot.registry.entitiesByName &&
      entity.name
      ? bot.registry.entitiesByName[entity.name]
      : null

    return registryEntity && registryEntity.category
      ? String(registryEntity.category).toLowerCase()
      : ''
  }

  function isHostileEntity(entity) {
    return getEntityCategory(entity).includes('hostile')
  }

  function isPassiveEntity(entity) {
    return getEntityCategory(entity).includes('passive')
  }

  function getEntityNames(entity) {
    const names = [
      entity && entity.name,
      entity && entity.displayName,
      entity && entity.username
    ]

    return new Set(names.map((name) => normalizeName(name)).filter(Boolean))
  }

  function isListedEntity(entity) {
    const configuredNames = getConfiguredEntityNames()
    if (configuredNames.size === 0) {
      return getListMode() === 'blacklist'
    }

    const entityNames = getEntityNames(entity)
    const matched = Array.from(entityNames).some((name) => configuredNames.has(name))

    return getListMode() === 'whitelist' ? matched : !matched
  }

  function isAllowedEntityType(entity) {
    const attackHostile = Boolean(getConfigValue('attackHostile', 'Attack_Hostile'))
    const attackPassive = Boolean(getConfigValue('attackPassive', 'Attack_Passive'))

    if (isHostileEntity(entity)) return attackHostile
    if (isPassiveEntity(entity)) return attackPassive

    return false
  }

  function compareHealth(left, right) {
    const leftHealth = getEntityHealth(left)
    const rightHealth = getEntityHealth(right)
    const leftFinite = Number.isFinite(leftHealth)
    const rightFinite = Number.isFinite(rightHealth)

    if (leftFinite && rightFinite) {
      return leftHealth - rightHealth
    }

    if (leftFinite) return -1
    if (rightFinite) return 1
    return 0
  }

  function getEntityCenter(entity) {
    const entityHeight = Number.isFinite(Number(entity && entity.height))
      ? Number(entity.height)
      : 1

    return entity.position.offset(0, Math.max(0.5, entityHeight * 0.5), 0)
  }

  function getDistanceToEntity(entity) {
    if (!bot.entity || !bot.entity.position || !entity || !entity.position) {
      return Number.POSITIVE_INFINITY
    }

    return bot.entity.position.distanceTo(getEntityCenter(entity))
  }

  function getMetadataValue(entity, key) {
    if (!entity || !Array.isArray(entity.metadata)) return null

    if (typeof bot.supportFeature === 'function' && bot.supportFeature('mcDataHasEntityMetadata')) {
      const metadataKeys = bot.registry &&
        bot.registry.entitiesByName &&
        entity.name &&
        bot.registry.entitiesByName[entity.name]
        ? bot.registry.entitiesByName[entity.name].metadataKeys
        : null

      if (Array.isArray(metadataKeys)) {
        const keyIndex = metadataKeys.indexOf(key)
        if (keyIndex >= 0) {
          return entity.metadata[keyIndex]
        }
      }
    }

    if (key === 'health') {
      return entity.metadata[LEGACY_LIVING_HEALTH_METADATA_INDEX]
    }

    return null
  }

  function getEntityHealth(entity) {
    if (Number.isFinite(Number(entity && entity.health))) {
      return Number(entity.health)
    }

    const metadataHealth = Number(getMetadataValue(entity, 'health'))
    if (Number.isFinite(metadataHealth)) {
      return metadataHealth
    }

    return Number.POSITIVE_INFINITY
  }

  function isTargetCandidate(entity) {
    if (!entity || !entity.isValid || !entity.position) return false
    if (!bot.entity || !bot.entity.position) return false
    if (bot.entity.id === entity.id) return false
    if (entity.type === 'player') return false
    if (!isAllowedEntityType(entity)) return false
    if (!isListedEntity(entity)) return false

    return getDistanceToEntity(entity) <= getAttackRange()
  }

  function compareCandidates(left, right) {
    const distanceDelta = getDistanceToEntity(left) - getDistanceToEntity(right)
    if (getMode() !== 'single' || getPriority() !== 'health') {
      if (distanceDelta !== 0) return distanceDelta
      return compareHealth(left, right)
    }

    const healthDelta = compareHealth(left, right)
    if (healthDelta !== 0) return healthDelta
    return distanceDelta
  }

  function findCandidates() {
    return Object.values(bot.entities)
      .filter((entity) => isTargetCandidate(entity))
      .sort(compareCandidates)
  }

  async function waitForCooldown(currentRunId) {
    while (isActive(currentRunId)) {
      const remainingMs = lastActionAt + getCooldownMs() - Date.now()
      if (remainingMs <= 0) return
      await sleep(Math.min(remainingMs, getScanIntervalMs()))
    }
  }

  async function aimAtEntity(entity) {
    if (typeof bot.lookAt !== 'function') return

    try {
      await bot.lookAt(getEntityCenter(entity), true)
    } catch {
      // keep the action attempt even if lookAt fails
    }
  }

  async function performInteraction(entity, currentRunId) {
    assertActive(currentRunId)

    await aimAtEntity(entity)
    assertActive(currentRunId)

    const interaction = getInteraction()
    if (interaction === 'interact') {
      await bot.activateEntity(entity)
    } else if (interaction === 'interactat') {
      await bot.activateEntityAt(entity, getEntityCenter(entity))
    } else {
      bot.attack(entity)
    }

    lastActionAt = Date.now()
  }

  function describeEntity(entity) {
    const entityName = entity.displayName || entity.name || entity.username || `#${entity.id}`
    const distance = getDistanceToEntity(entity)
    return `${entityName} (${distance.toFixed(2)} blocks)`
  }

  async function attackCandidates(currentRunId) {
    const candidates = findCandidates()
    if (candidates.length === 0) {
      await sleep(getScanIntervalMs())
      return
    }

    const targets = getMode() === 'multi' ? candidates : [candidates[0]]

    for (const entity of targets) {
      assertActive(currentRunId)

      if (!isTargetCandidate(entity)) continue

      await waitForCooldown(currentRunId)
      assertActive(currentRunId)

      if (!isTargetCandidate(entity)) continue

      try {
        await performInteraction(entity, currentRunId)
        logInfo(`Auto attack ${getInteraction()} -> ${describeEntity(entity)}.`)
      } catch (error) {
        if (!isActive(currentRunId)) break
        logInfo(`Auto attack skipped ${describeEntity(entity)}: ${error.message}`)
      }
    }

    if (isActive(currentRunId)) {
      await sleep(getScanIntervalMs())
    }
  }

  async function autoAttackLoop(currentRunId) {
    try {
      while (isActive(currentRunId)) {
        await attackCandidates(currentRunId)
      }
    } catch (error) {
      if (isActive(currentRunId)) {
        console.error('Auto attack loop failed:', error.message)
      }
    } finally {
      if (runId === currentRunId) {
        enabled = false
      }

      logInfo('Auto attack stopped.')
    }
  }

  function startAutoAttack() {
    if (!bot.entity || !bot.entity.position) {
      logInfo('Bot is not ready to attack yet.')
      return
    }

    if (enabled) {
      logInfo('Auto attack is already running.')
      return
    }

    clearAutoStartTimer()
    enabled = true
    runId += 1
    lastActionAt = 0
    const currentRunId = runId

    logInfo(
      `Auto attack enabled. mode=${getMode()}, interaction=${getInteraction()}, range=${getAttackRange()}, cooldown=${Math.round(getCooldownMs())}ms.`
    )
    void autoAttackLoop(currentRunId)
  }

  async function stopAutoAttack({ announceIfIdle = true } = {}) {
    clearAutoStartTimer()

    if (!enabled) {
      if (announceIfIdle) {
        logInfo('Auto attack is already stopped.')
      }
      return
    }

    enabled = false
    runId += 1
    lastActionAt = 0

    if (announceIfIdle) {
      logInfo('Auto attack stop requested.')
    }
  }

  async function handleCommand(message) {
    const normalized = message.trim().toLowerCase()

    if (normalized === '/autoattack start') {
      startAutoAttack()
      return true
    }

    if (normalized === '/autoattack stop') {
      await stopAutoAttack()
      return true
    }

    if (normalized === '/autoattack status') {
      if (!enabled) {
        logInfo('Auto attack is stopped.')
      } else {
        logInfo(
          `Auto attack is running. mode=${getMode()}, priority=${getPriority()}, interaction=${getInteraction()}, range=${getAttackRange()}, cooldown=${Math.round(getCooldownMs())}ms.`
        )
      }
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /autoattack start',
      'Local command: /autoattack stop',
      'Local command: /autoattack status'
    ]
  }

  function onReady() {
    clearAutoStartTimer()

    if (!Boolean(getConfigValue('enabled', 'Enabled'))) return

    const autoStartDelayMs = Number(getConfigValue('autoStartDelayMs', 'AutoStartDelayMs'))
    const delayMs = Number.isFinite(autoStartDelayMs) ? autoStartDelayMs : 0
    if (delayMs < 0) return

    autoStartTimer = setTimeout(() => {
      autoStartTimer = null
      startAutoAttack()
    }, delayMs)

    if (delayMs > 0) {
      logInfo(`Auto attack will auto-start in ${Math.round(delayMs / 1000)} seconds.`)
    }
  }

  function onDisconnect() {
    clearAutoStartTimer()
    enabled = false
    runId += 1
    lastActionAt = 0
  }

  async function stop() {
    await stopAutoAttack({ announceIfIdle: false })
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
  createAutoAttackFeature
}
