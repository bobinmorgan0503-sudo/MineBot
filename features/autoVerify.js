function createAutoVerifyFeature({
  bot,
  config,
  logInfo
}) {
  let enabled = Boolean(config.enabled)
  let debugEnabled = Boolean(config.debug)
  const recentCommands = new Map()

  function getMessagePayload(message) {
    if (!message) return null
    if (typeof message.json === 'object' && message.json) return message.json
    if (typeof message === 'object') return message
    return null
  }

  function getPlainText(node) {
    if (!node) return ''
    if (typeof node === 'string') return node
    if (Array.isArray(node)) {
      return node.map((entry) => getPlainText(entry)).join('')
    }

    let text = ''

    if (typeof node.text === 'string') text += node.text
    if (typeof node.translate === 'string') text += node.translate
    if (typeof node.insertion === 'string') text += node.insertion
    if (Array.isArray(node.with)) text += node.with.map((entry) => getPlainText(entry)).join('')
    if (Array.isArray(node.extra)) text += node.extra.map((entry) => getPlainText(entry)).join('')

    return text
  }

  function collectClickEvents(node, events = []) {
    if (!node) return events

    if (Array.isArray(node)) {
      for (const entry of node) collectClickEvents(entry, events)
      return events
    }

    if (typeof node !== 'object') {
      return events
    }

    if (node.clickEvent && typeof node.clickEvent === 'object') {
      events.push({
        clickEvent: node.clickEvent,
        text: getPlainText(node)
      })
    }

    if (Array.isArray(node.extra)) collectClickEvents(node.extra, events)
    if (Array.isArray(node.with)) collectClickEvents(node.with, events)

    return events
  }

  function normalizeCommand(command) {
    return String(command || '').trim()
  }

  function isCommandAllowed(action, command) {
    if (!command) return false

    const allowedActions = Array.isArray(config.allowedActions) && config.allowedActions.length > 0
      ? config.allowedActions
      : ['run_command', 'suggest_command']

    if (!allowedActions.includes(action)) return false

    const matchTexts = Array.isArray(config.matchTexts) ? config.matchTexts : []
    if (matchTexts.length === 0) return true

    const normalizedCommand = command.toLowerCase()
    return matchTexts.some((text) => normalizedCommand.includes(String(text).toLowerCase()))
  }

  function isTextMatched(text) {
    const requiredTextPatterns = Array.isArray(config.requiredTextPatterns) ? config.requiredTextPatterns : []
    if (requiredTextPatterns.length === 0) return true

    const normalizedText = String(text || '').toLowerCase()
    return requiredTextPatterns.some((pattern) => normalizedText.includes(String(pattern).toLowerCase()))
  }

  function isRecentCommand(command) {
    const dedupeWindowMs = Number(config.dedupeWindowMs || 5000)
    const now = Date.now()
    const previous = recentCommands.get(command)

    if (previous && now - previous < dedupeWindowMs) {
      return true
    }

    recentCommands.set(command, now)

    for (const [key, timestamp] of recentCommands.entries()) {
      if (now - timestamp >= dedupeWindowMs) {
        recentCommands.delete(key)
      }
    }

    return false
  }

  function logDebug(...args) {
    if (debugEnabled) {
      logInfo(...args)
    }
  }

  function tryExecuteClickEvent(clickEvent, text) {
    if (!enabled || !clickEvent || typeof clickEvent !== 'object') return false

    const action = String(clickEvent.action || '')
    const command = normalizeCommand(clickEvent.value)

    logDebug(`[autoverify] clickEvent action=${action} text=${JSON.stringify(text)} value=${JSON.stringify(command)}`)

    if (!isTextMatched(text)) return false
    if (!isCommandAllowed(action, command)) return false
    if (isRecentCommand(command)) return false

    bot.chat(command)
    logInfo(`[autoverify] Executed ${action}: ${command}`)
    return true
  }

  function onMessage(message) {
    const payload = getMessagePayload(message)
    if (!payload) return

    const events = collectClickEvents(payload)
    if (events.length === 0) return

    for (const entry of events) {
      if (tryExecuteClickEvent(entry.clickEvent, entry.text)) {
        return
      }
    }
  }

  async function handleCommand(message) {
    return false
  }

  function getCommandHelp() {
    return []
  }

  function onDisconnect() {
    recentCommands.clear()
  }

  return {
    getCommandHelp,
    handleCommand,
    onDisconnect,
    onMessage
  }
}

module.exports = {
  createAutoVerifyFeature
}
