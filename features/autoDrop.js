function createAutoDropFeature({
  bot,
  config,
  logInfo,
  sleep
}) {
  let enabled = false
  let runId = 0
  let autoStartTimer = null
  let lastBlockedReason = ''

  function clearAutoStartTimer() {
    if (!autoStartTimer) return
    clearTimeout(autoStartTimer)
    autoStartTimer = null
  }

  function normalizeName(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  function compilePattern(pattern) {
    const normalized = normalizeName(pattern)
    if (!normalized) return null

    if (!normalized.includes('*')) {
      return {
        raw: normalized,
        test: (itemName) => itemName === normalized
      }
    }

    const regex = new RegExp(
      `^${normalized.split('*').map((part) => escapeRegex(part)).join('.*')}$`,
      'i'
    )

    return {
      raw: normalized,
      test: (itemName) => regex.test(itemName)
    }
  }

  function getCompiledPatterns() {
    const rawItems = Array.isArray(config.items) ? config.items : []
    return rawItems
      .map((pattern) => compilePattern(pattern))
      .filter(Boolean)
  }

  function isActive(currentRunId) {
    return enabled && runId === currentRunId
  }

  function assertActive(currentRunId) {
    if (!isActive(currentRunId)) {
      throw new Error('Auto drop stopped.')
    }
  }

  function setBlockedReason(reason) {
    if (reason && reason !== lastBlockedReason) {
      logInfo(reason)
    }

    if (!reason) {
      lastBlockedReason = ''
      return
    }

    lastBlockedReason = reason
  }

  function getListMode() {
    return normalizeName(config.listType) === 'whitelist' ? 'whitelist' : 'blacklist'
  }

  function shouldDropItem(item) {
    if (!item) return false

    const normalizedItemName = normalizeName(item.name || item.displayName)
    const patterns = getCompiledPatterns()
    const listed = patterns.some((pattern) => pattern.test(normalizedItemName))

    return getListMode() === 'whitelist' ? listed : !listed
  }

  function getDroppableSlots() {
    const inventorySlots = bot.inventory?.slots || []
    const slots = []

    for (let slot = 9; slot <= 44 && slot < inventorySlots.length; slot += 1) {
      const item = inventorySlots[slot]
      if (!item) continue
      if (!shouldDropItem(item)) continue
      slots.push(item)
    }

    return slots
  }

  function getStatusSummary() {
    const configuredItems = Array.isArray(config.items) ? config.items : []
    return `${enabled ? 'running' : 'stopped'}, mode=${getListMode()}, rules=${configuredItems.length}`
  }

  async function autoDropLoop(currentRunId) {
    const idleDelayMs = Math.max(100, Number(config.idleDelayMs || 1000))
    const dropDelayMs = Math.max(0, Number(config.dropDelayMs || 300))
    const retryDelayMs = Math.max(100, Number(config.retryDelayMs || 1500))

    while (isActive(currentRunId)) {
      try {
        if (bot.currentWindow) {
          setBlockedReason('Auto drop is waiting because a container window is open.')
          await sleep(retryDelayMs)
          continue
        }

        if (bot.inventory?.selectedItem) {
          setBlockedReason('Auto drop is waiting because the cursor is holding an item.')
          await sleep(retryDelayMs)
          continue
        }

        const droppableItems = getDroppableSlots()
        if (droppableItems.length === 0) {
          setBlockedReason('')
          await sleep(idleDelayMs)
          continue
        }

        setBlockedReason('')
        const item = droppableItems[0]
        await bot.tossStack(item)
        assertActive(currentRunId)
        logInfo(`Auto drop tossed ${item.name} x${item.count} from slot ${item.slot}.`)

        if (dropDelayMs > 0) {
          await sleep(dropDelayMs)
        }
      } catch (error) {
        if (!isActive(currentRunId)) break
        console.error('Auto drop failed:', error.message)
        await sleep(retryDelayMs)
      }
    }

    if (runId === currentRunId) {
      enabled = false
    }

    setBlockedReason('')
    logInfo('Auto drop stopped.')
  }

  function startAutoDrop() {
    if (!config.enabled) {
      logInfo('Auto drop is disabled in config.')
      return
    }

    if (enabled) {
      logInfo(`Auto drop is already ${getStatusSummary()}.`)
      return
    }

    clearAutoStartTimer()
    enabled = true
    runId += 1
    const currentRunId = runId

    logInfo(`Auto drop enabled with ${getListMode()} mode.`)
    void autoDropLoop(currentRunId)
  }

  async function stopAutoDrop({ announceIfIdle = true } = {}) {
    clearAutoStartTimer()

    if (!enabled) {
      if (announceIfIdle) {
        logInfo('Auto drop is already stopped.')
      }
      return
    }

    enabled = false
    runId += 1
    setBlockedReason('')

    if (announceIfIdle) {
      logInfo('Auto drop stop requested.')
    }
  }

  async function handleCommand(message) {
    const normalized = message.trim().toLowerCase()

    if (normalized === '/autodrop start') {
      startAutoDrop()
      return true
    }

    if (normalized === '/autodrop stop') {
      await stopAutoDrop()
      return true
    }

    if (normalized === '/autodrop status') {
      logInfo(`Auto drop is ${getStatusSummary()}.`)
      return true
    }

    return false
  }

  function getCommandHelp() {
    return [
      'Local command: /autodrop start',
      'Local command: /autodrop stop',
      'Local command: /autodrop status'
    ]
  }

  function onReady() {
    clearAutoStartTimer()

    if (!config.enabled || config.autoStartDelayMs < 0) return

    autoStartTimer = setTimeout(() => {
      autoStartTimer = null
      startAutoDrop()
    }, config.autoStartDelayMs)

    logInfo(`Auto drop will auto-start in ${Math.round(config.autoStartDelayMs / 1000)} seconds.`)
  }

  function onDisconnect() {
    clearAutoStartTimer()
    enabled = false
    runId += 1
    setBlockedReason('')
  }

  async function stop() {
    await stopAutoDrop({ announceIfIdle: false })
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
  createAutoDropFeature
}
