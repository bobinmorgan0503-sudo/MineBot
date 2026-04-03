const prismarineItem = require('prismarine-item')

function createInventoryFeature({
  bot,
  logInfo
}) {
  const Item = prismarineItem(bot.registry)
  const registryItems = Object.values(bot.registry.itemsByName || {})
  let operationChain = Promise.resolve()

  const TOP_LEVEL_SUBCOMMANDS = new Set([
    'inventories',
    'i',
    'search',
    's'
  ])

  const INVENTORY_SUBCOMMANDS = new Set([
    'preview',
    'click',
    'drop',
    'close',
    'creativegive',
    'creativedelete'
  ])

  function queueOperation(action) {
    const result = operationChain.catch(() => {}).then(action)
    operationChain = result.catch(() => {})
    return result
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
  }

  function extractText(value) {
    if (value == null) return ''
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    if (Array.isArray(value)) {
      return value.map((entry) => extractText(entry)).filter(Boolean).join(' ')
    }

    if (typeof value !== 'object') return ''

    const keys = ['text', 'translate', 'contents', 'title', 'label', 'extra']
    return keys
      .map((key) => extractText(value[key]))
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  function getWindowTitle(window) {
    if (!window) return ''
    const text = extractText(window.title)
    return text || String(window.title || '')
  }

  function itemToText(item) {
    if (!item) return '(empty)'
    return `${item.name} x${item.count}`
  }

  function repeatChar(char, count) {
    return new Array(Math.max(0, count) + 1).join(char)
  }

  function padRight(value, width) {
    return String(value).padEnd(width, ' ')
  }

  function buildAsciiBox(title, lines) {
    const contentLines = [title, ...lines].map((line) => String(line))
    const width = contentLines.reduce((max, line) => Math.max(max, line.length), 0)
    const border = `+${repeatChar('-', width + 2)}+`

    return [
      border,
      `| ${padRight(title, width)} |`,
      border,
      ...lines.map((line) => `| ${padRight(line, width)} |`),
      border
    ]
  }

  function buildPlayerTarget() {
    return {
      kind: 'player',
      id: 0,
      name: 'player',
      title: 'Player Inventory',
      window: bot.inventory,
      logicalSlotCount: bot.inventory?.slots?.length || 0
    }
  }

  function buildContainerTarget() {
    if (!bot.currentWindow) return null

    return {
      kind: 'container',
      id: bot.currentWindow.id,
      name: 'container',
      title: getWindowTitle(bot.currentWindow) || 'Container',
      window: bot.currentWindow,
      logicalSlotCount: bot.currentWindow.inventoryStart
    }
  }

  function getAvailableTargets() {
    const targets = [buildPlayerTarget()]
    const containerTarget = buildContainerTarget()
    if (containerTarget) targets.push(containerTarget)
    return targets
  }

  function isPlayerAlias(token) {
    const normalized = normalizeText(token)
    return normalized === 'player' || normalized === normalizeText(bot.username)
  }

  function isContainerAlias(token) {
    const normalized = normalizeText(token)
    return normalized === 'container' || normalized === 'c'
  }

  function isTargetToken(token) {
    if (!token) return false
    if (/^\d+$/.test(token)) return true
    return isPlayerAlias(token) || isContainerAlias(token)
  }

  function resolveTarget(token) {
    if (!token) return buildPlayerTarget()

    if (/^\d+$/.test(token)) {
      const id = Number.parseInt(token, 10)
      if (id === 0) return buildPlayerTarget()
      const containerTarget = buildContainerTarget()
      if (containerTarget && containerTarget.id === id) {
        return containerTarget
      }
      return {
        error: `Inventory id ${id} is not available. Use /inventory inventories to list ids.`
      }
    }

    if (isPlayerAlias(token)) {
      return buildPlayerTarget()
    }

    if (isContainerAlias(token)) {
      const containerTarget = buildContainerTarget()
      if (containerTarget) return containerTarget
      return {
        error: 'No container window is currently open.'
      }
    }

    return {
      error: `Unknown inventory target: ${token}`
    }
  }

  function getPlayerPreviewSections() {
    const slots = bot.inventory?.slots || []
    const sections = []

    sections.push({
      label: 'Player Utility',
      slots: [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((slot) => slot < slots.length)
    })

    for (let slot = 9, row = 1; slot <= 35 && slot < slots.length; slot += 9, row += 1) {
      sections.push({
        label: `Player Main Row ${row}`,
        slots: Array.from({ length: Math.min(9, slots.length - slot) }, (_, index) => slot + index)
      })
    }

    if (slots.length > 36) {
      sections.push({
        label: 'Player Hotbar',
        slots: Array.from({ length: Math.min(9, slots.length - 36) }, (_, index) => 36 + index)
      })
    }

    if (slots.length > 45) {
      sections.push({
        label: 'Player Offhand',
        slots: [45]
      })
    }

    return sections
  }

  function chooseContainerRowWidth(slotCount) {
    if (slotCount <= 0) return 0
    if (slotCount === 5) return 5
    if (slotCount <= 4) return slotCount
    if (slotCount % 9 === 0) return 9
    if (slotCount <= 9 && slotCount % 3 === 0) return 3
    return Math.min(9, slotCount)
  }

  function getContainerPreviewSections(target) {
    const rowWidth = chooseContainerRowWidth(target.logicalSlotCount)
    const sections = []

    for (let start = 0, row = 1; start < target.logicalSlotCount; start += rowWidth, row += 1) {
      sections.push({
        label: `Container Row ${row}`,
        slots: Array.from(
          { length: Math.min(rowWidth, target.logicalSlotCount - start) },
          (_, index) => start + index
        )
      })
    }

    return sections
  }

  function getSlotLocationLabel(target, section, slot, slotIndex) {
    if (target.kind === 'container') {
      return `${section.label.toLowerCase().replace(/\s+/g, '_')}:col${slotIndex + 1}`
    }

    if (slot >= 36 && slot <= 44) {
      return `hotbar:${slot - 35}`
    }

    if (slot === 45) {
      return 'offhand'
    }

    if (slot >= 9 && slot <= 35) {
      const row = Math.floor((slot - 9) / 9) + 1
      const col = ((slot - 9) % 9) + 1
      return `main:r${row}c${col}`
    }

    if (slot >= 5 && slot <= 8) {
      const armorMap = {
        5: 'armor:head',
        6: 'armor:chest',
        7: 'armor:legs',
        8: 'armor:feet'
      }
      return armorMap[slot]
    }

    if (slot >= 1 && slot <= 4) {
      return `craft:r${Math.floor((slot - 1) / 2) + 1}c${((slot - 1) % 2) + 1}`
    }

    if (slot === 0) {
      return 'craft:result'
    }

    return section.label.toLowerCase().replace(/\s+/g, '_')
  }

  function formatSlotLine(target, section, slot, slotIndex) {
    const item = target.window.slots[slot]
    const location = getSlotLocationLabel(target, section, slot, slotIndex)
    return `| slot ${String(slot).padStart(2, '0')} | ${padRight(location, 14)} | ${itemToText(item)}`
  }

  function logPreview(target) {
    const headerLines = [
      `target: ${target.name}`,
      `id: ${target.id}`,
      `slots: ${target.logicalSlotCount}`,
      `title: ${target.title || '(none)'}`,
      `type: ${target.window?.type || '(unknown)'}`
    ]

    const selectedItem = target.window?.selectedItem
    if (selectedItem) {
      headerLines.push(`cursor: ${itemToText(selectedItem)}`)
    }

    for (const line of buildAsciiBox(`Inventory Preview`, headerLines)) {
      logInfo(line)
    }

    const sections = target.kind === 'player'
      ? getPlayerPreviewSections()
      : getContainerPreviewSections(target)

    for (const section of sections) {
      const sectionLines = section.slots.map((slot, slotIndex) => formatSlotLine(target, section, slot, slotIndex))
      for (const line of buildAsciiBox(section.label, sectionLines)) {
        logInfo(line)
      }
    }
  }

  function listInventories() {
    for (const target of getAvailableTargets()) {
      logInfo(
        `Inventory: ${target.name} (id ${target.id}), slots ${target.logicalSlotCount}` +
        `${target.title ? `, title "${target.title}"` : ''}` +
        `${target.window?.type ? `, type ${target.window.type}` : ''}`
      )
    }
  }

  function resolveItemDefinition(query) {
    const normalized = normalizeText(query)
    if (!normalized) return null

    let exact = registryItems.find((item) => normalizeText(item.name) === normalized)
    if (exact) return exact

    exact = registryItems.find((item) => normalizeText(item.displayName) === normalized)
    if (exact) return exact

    let partial = registryItems.find((item) => normalizeText(item.name).includes(normalized))
    if (partial) return partial

    partial = registryItems.find((item) => normalizeText(item.displayName).includes(normalized))
    return partial || null
  }

  function matchesItemQuery(item, query, resolvedItem) {
    if (!item) return false
    if (resolvedItem) return item.type === resolvedItem.id

    const normalized = normalizeText(query)
    if (!normalized) return false

    return normalizeText(item.name).includes(normalized) ||
      normalizeText(item.displayName).includes(normalized)
  }

  function searchInventories(query, requestedCount = null) {
    const resolvedItem = resolveItemDefinition(query)
    const matches = []
    let totalCount = 0

    for (const target of getAvailableTargets()) {
      for (let slot = 0; slot < target.logicalSlotCount; slot += 1) {
        const item = target.window.slots[slot]
        if (!matchesItemQuery(item, query, resolvedItem)) continue

        totalCount += item.count
        matches.push({
          target,
          slot,
          item
        })
      }
    }

    const displayQuery = resolvedItem ? resolvedItem.name : query

    if (matches.length === 0) {
      logInfo(`Inventory search: no matches for ${displayQuery}.`)
      return
    }

    logInfo(`Inventory search: found ${totalCount} x ${displayQuery} across ${matches.length} slot(s).`)
    if (requestedCount != null) {
      if (totalCount >= requestedCount) {
        logInfo(`Requested amount ${requestedCount} is available.`)
      } else {
        logInfo(`Requested amount ${requestedCount} is not available.`)
      }
    }

    for (const match of matches) {
      logInfo(
        `- ${match.target.name} (id ${match.target.id}) slot ${match.slot}: ${itemToText(match.item)}`
      )
    }
  }

  function validateLogicalSlot(target, slot) {
    if (!Number.isInteger(slot)) {
      return 'Slot must be an integer.'
    }

    if (slot < 0 || slot >= target.logicalSlotCount) {
      return `Slot ${slot} is out of range for ${target.name} inventory (0-${target.logicalSlotCount - 1}).`
    }

    return null
  }

  function mapPlayerSlotToCurrentWindow(slot) {
    if (!bot.currentWindow) return slot

    const mappedSlots = bot.currentWindow.inventoryEnd - bot.currentWindow.inventoryStart
    const playerStart = bot.inventory.inventoryStart
    const playerEnd = playerStart + mappedSlots - 1

    if (slot < playerStart || slot > playerEnd) {
      return {
        error: `When a container is open, only player slots ${playerStart}-${playerEnd} can be clicked or dropped.`
      }
    }

    const offset = bot.currentWindow.inventoryStart - bot.inventory.inventoryStart
    return {
      slot: slot + offset
    }
  }

  function getClickSlot(target, logicalSlot) {
    const validationError = validateLogicalSlot(target, logicalSlot)
    if (validationError) return { error: validationError }

    if (target.kind === 'container') {
      return { slot: logicalSlot }
    }

    if (!bot.currentWindow) {
      return { slot: logicalSlot }
    }

    return mapPlayerSlotToCurrentWindow(logicalSlot)
  }

  async function executeClick(target, slot, clickType = 'left') {
    const clickInfo = getClickSlot(target, slot)
    if (clickInfo.error) {
      logInfo(clickInfo.error)
      return
    }

    const normalizedType = clickType.toLowerCase()
    let mouseButton = 0
    let mode = 0

    if (normalizedType === 'right') {
      mouseButton = 1
    } else if (normalizedType === 'left') {
      mouseButton = 0
    } else if (normalizedType === 'middle') {
      mouseButton = 2
      mode = 3
    } else if (normalizedType === 'shift') {
      mouseButton = 0
      mode = 1
    } else if (normalizedType === 'shiftright') {
      mouseButton = 1
      mode = 1
    } else {
      logInfo('Usage: /inventory [player|container|id] click <slot> [left|right|middle|shift|shiftright]')
      return
    }

    await bot.clickWindow(clickInfo.slot, mouseButton, mode)
    logInfo(`Inventory click completed on ${target.name} slot ${slot} using ${normalizedType}.`)
  }

  async function executeDrop(target, slot, dropSpecifier = 'all') {
    const clickInfo = getClickSlot(target, slot)
    if (clickInfo.error) {
      logInfo(clickInfo.error)
      return
    }

    const window = target.kind === 'container'
      ? bot.currentWindow
      : (bot.currentWindow || bot.inventory)
    const item = window?.slots?.[clickInfo.slot]

    if (!item) {
      logInfo(`Slot ${slot} is empty.`)
      return
    }

    if (String(dropSpecifier).toLowerCase() === 'all') {
      await bot.clickWindow(clickInfo.slot, 1, 4)
      logInfo(`Dropped all items from ${target.name} slot ${slot}.`)
      return
    }

    const count = Number.parseInt(dropSpecifier, 10)
    if (!Number.isInteger(count) || count <= 0) {
      logInfo('Usage: /inventory [player|container|id] drop <slot> <count|all>')
      return
    }

    if (count >= item.count) {
      await bot.clickWindow(clickInfo.slot, 1, 4)
      logInfo(`Dropped all ${item.count} item(s) from ${target.name} slot ${slot}.`)
      return
    }

    for (let index = 0; index < count; index += 1) {
      await bot.clickWindow(clickInfo.slot, 0, 4)
    }

    logInfo(`Dropped ${count} item(s) from ${target.name} slot ${slot}.`)
  }

  function ensureCreativeMode() {
    if (bot.game?.gameMode !== 'creative') {
      logInfo(`Creative inventory actions require creative mode. Current mode: ${bot.game?.gameMode || 'unknown'}.`)
      return false
    }

    if (!bot.creative || typeof bot.creative.setInventorySlot !== 'function') {
      logInfo('Creative inventory API is not available.')
      return false
    }

    return true
  }

  async function executeCreativeGive(target, itemQuery, countArg, slotArg) {
    if (target.kind !== 'player') {
      logInfo('creativegive currently supports only the player inventory.')
      return
    }

    if (!ensureCreativeMode()) return

    const itemDefinition = resolveItemDefinition(itemQuery)
    if (!itemDefinition) {
      logInfo(`Unknown item type: ${itemQuery}`)
      return
    }

    const count = countArg == null ? 1 : Number.parseInt(countArg, 10)
    if (!Number.isInteger(count) || count <= 0) {
      logInfo('Usage: /inventory [player] creativegive <itemtype> [count] [slot]')
      return
    }

    let slot = slotArg == null
      ? bot.inventory.firstEmptyInventorySlot()
      : Number.parseInt(slotArg, 10)

    if (!Number.isInteger(slot) || slot < 0 || slot > 44) {
      logInfo('creativegive slot must be between 0 and 44.')
      return
    }

    const item = new Item(itemDefinition.id, count)
    await bot.creative.setInventorySlot(slot, item)
    logInfo(`Placed ${item.name} x${count} into player slot ${slot}.`)
  }

  async function executeCreativeDelete(target, slotArg) {
    if (target.kind !== 'player') {
      logInfo('creativedelete currently supports only the player inventory.')
      return
    }

    if (!ensureCreativeMode()) return

    if (slotArg == null) {
      const slots = (bot.inventory?.slots || [])
        .filter((item) => item && item.slot >= 0 && item.slot <= 44)
        .map((item) => item.slot)

      if (slots.length === 0) {
        logInfo('No items found in deletable creative slots 0-44.')
        return
      }

      for (const slot of slots) {
        await bot.creative.setInventorySlot(slot, null)
      }

      logInfo(`Cleared ${slots.length} slot(s) from player inventory.`)
      return
    }

    const slot = Number.parseInt(slotArg, 10)
    if (!Number.isInteger(slot) || slot < 0 || slot > 44) {
      logInfo('creativedelete slot must be between 0 and 44.')
      return
    }

    await bot.creative.setInventorySlot(slot, null)
    logInfo(`Cleared player slot ${slot}.`)
  }

  function closeInventory(target) {
    if (target.kind === 'player') {
      logInfo('Player inventory does not have a separate open container to close.')
      return
    }

    if (!bot.currentWindow) {
      logInfo('No container window is currently open.')
      return
    }

    bot.closeWindow(bot.currentWindow)
    logInfo(`Closed container id ${target.id}.`)
  }

  async function handleInventoryCommand(args) {
    const firstArg = args[0]?.toLowerCase()

    if (!firstArg) {
      logPreview(buildPlayerTarget())
      return
    }

    if (TOP_LEVEL_SUBCOMMANDS.has(firstArg)) {
      if (firstArg === 'inventories' || firstArg === 'i') {
        listInventories()
        return
      }

      const itemQuery = args[1]
      const amountArg = args[2]
      if (!itemQuery) {
        logInfo('Usage: /inventory search <itemtype> [amount]')
        return
      }

      const requestedCount = amountArg == null ? null : Number.parseInt(amountArg, 10)
      if (amountArg != null && (!Number.isInteger(requestedCount) || requestedCount <= 0)) {
        logInfo('Search amount must be a positive integer.')
        return
      }

      searchInventories(itemQuery, requestedCount)
      return
    }

    let target = buildPlayerTarget()
    let subcommandIndex = 0

    if (isTargetToken(args[0])) {
      target = resolveTarget(args[0])
      subcommandIndex = 1
      if (target.error) {
        logInfo(target.error)
        return
      }
    }

    const subcommand = (args[subcommandIndex] || 'preview').toLowerCase()
    const rest = args.slice(subcommandIndex + 1)

    if (!INVENTORY_SUBCOMMANDS.has(subcommand)) {
      logInfo('Usage: /inventory [player|container|id] [preview|click|drop|close|creativegive|creativedelete]')
      logInfo('Usage: /inventory inventories')
      logInfo('Usage: /inventory search <itemtype> [amount]')
      return
    }

    if (subcommand === 'preview') {
      logPreview(target)
      return
    }

    if (subcommand === 'close') {
      closeInventory(target)
      return
    }

    if (subcommand === 'click') {
      const slot = Number.parseInt(rest[0], 10)
      await executeClick(target, slot, rest[1] || 'left')
      return
    }

    if (subcommand === 'drop') {
      const slot = Number.parseInt(rest[0], 10)
      if (!Number.isInteger(slot)) {
        logInfo('Usage: /inventory [player|container|id] drop <slot> <count|all>')
        return
      }

      await executeDrop(target, slot, rest[1] || 'all')
      return
    }

    if (subcommand === 'creativegive') {
      if (!rest[0]) {
        logInfo('Usage: /inventory [player] creativegive <itemtype> [count] [slot]')
        return
      }

      await executeCreativeGive(target, rest[0], rest[1], rest[2])
      return
    }

    if (subcommand === 'creativedelete') {
      await executeCreativeDelete(target, rest[0])
    }
  }

  async function handleCommand(message) {
    const trimmed = message.trim()
    const match = trimmed.match(/^\/(?:inventory|inv)\b/i)
    if (!match) return false

    const args = trimmed.slice(match[0].length).trim().split(/\s+/).filter(Boolean)

    try {
      await queueOperation(() => handleInventoryCommand(args))
    } catch (error) {
      console.error('Inventory command failed:', error.message)
    }

    return true
  }

  function getCommandHelp() {
    return [
      'Local command: /inventory [player|container|id] [preview]',
      'Local command: /inventory [player|container|id] click <slot> [left|right|middle|shift|shiftright]',
      'Local command: /inventory [player|container|id] drop <slot> <count|all>',
      'Local command: /inventory [player|container|id] close',
      'Local command: /inventory inventories',
      'Local command: /inventory search <itemtype> [amount]',
      'Local command: /inventory [player] creativegive <itemtype> [count] [slot]',
      'Local command: /inventory [player] creativedelete [slot]'
    ]
  }

  return {
    getCommandHelp,
    handleCommand
  }
}

module.exports = {
  createInventoryFeature
}
