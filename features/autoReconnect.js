function createAutoReconnect({
  connect,
  config = {},
  logInfo = console.log,
  onStopped = () => {},
  timers = { setTimeout, clearTimeout }
}) {
  const milliseconds = (value, fallback, minimum = 1) =>
    Number.isFinite(Number(value)) && Number(value) >= minimum ? Number(value) : fallback
  const initialDelayMs = milliseconds(config.initialDelayMs, 5000)
  const maxDelayMs = Math.max(initialDelayMs, milliseconds(config.maxDelayMs, 60000))
  const multiplier = milliseconds(config.backoffMultiplier, 2, 1)
  const connectTimeoutMs = milliseconds(config.connectTimeoutMs, 60000)
  const stableConnectionMs = milliseconds(config.stableConnectionMs, 30000, 0)
  const noticeDelayMs = milliseconds(config.noticeDelayMs, 90000)
  let stopped = false
  let started = false
  let session = null
  let retryTimer = null
  let connectTimer = null
  let stableTimer = null
  let failures = 0

  function clearSessionTimers() {
    timers.clearTimeout(connectTimer)
    timers.clearTimeout(stableTimer)
    connectTimer = null
    stableTimer = null
  }

  function scheduleRetry(reason, afterNotice = false) {
    if (stopped || retryTimer !== null) return
    if (config.enabled === false) {
      stop()
      return
    }

    const backoff = Math.min(maxDelayMs, initialDelayMs * multiplier ** Math.min(failures, 1024))
    const delayMs = afterNotice ? Math.max(backoff, noticeDelayMs) : backoff
    failures += 1
    logInfo(`[autoreconnect] ${reason || 'Connection lost'}; retrying in ${delayMs}ms (attempt ${failures}).`)
    retryTimer = timers.setTimeout(() => {
      retryTimer = null
      openSession()
    }, delayMs)
  }

  function fail(failedSession, reason) {
    if (stopped || session !== failedSession) return
    const afterNotice = Boolean(failedSession.shouldDelayReconnect?.())
    session = null
    clearSessionTimers()
    closeSession(failedSession)
    scheduleRetry(reason, afterNotice)
  }

  function closeSession(previous) {
    try {
      previous.close()
    } catch (error) {
      logInfo(`[autoreconnect] Failed to close connection: ${error.message}`)
    }
  }

  function openSession() {
    if (stopped || session) return
    try {
      const next = connect()
      session = next
      next.bot.on('end', (reason) => fail(next, String(reason || 'Connection lost')))
      next.bot.on('kicked', (reason) => fail(next, String(reason || 'Kicked by server')))
      // Proxy, DNS and authentication failures can emit error without end.
      next.bot.on('error', (error) => fail(next, error.message || String(error)))
      next.bot.once('spawn', () => {
        if (stopped || session !== next) return
        timers.clearTimeout(connectTimer)
        connectTimer = null
        stableTimer = timers.setTimeout(() => {
          stableTimer = null
          if (!stopped && session === next) failures = 0
        }, stableConnectionMs)
      })
      connectTimer = timers.setTimeout(() => {
        fail(next, `Connection/login timed out after ${connectTimeoutMs}ms`)
      }, connectTimeoutMs)
    } catch (error) {
      logInfo(`[autoreconnect] Failed to create connection: ${error.message}`)
      scheduleRetry(error.message)
    }
  }

  function start() {
    if (started || stopped) return
    started = true
    openSession()
  }

  function reconnect() {
    if (stopped) return false
    started = true
    timers.clearTimeout(retryTimer)
    retryTimer = null
    clearSessionTimers()
    failures = 0
    const previous = session
    session = null
    if (previous) closeSession(previous)
    logInfo('[autoreconnect] Manual reconnect requested; connecting now.')
    openSession()
    return true
  }

  function stop() {
    if (stopped) return
    stopped = true
    timers.clearTimeout(retryTimer)
    retryTimer = null
    clearSessionTimers()
    const previous = session
    session = null
    if (previous) closeSession(previous)
    onStopped()
  }

  return { start, reconnect, stop, getSession: () => session }
}

module.exports = { createAutoReconnect }
