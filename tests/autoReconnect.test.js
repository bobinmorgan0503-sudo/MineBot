const test = require('node:test')
const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { FakeClock } = require('./helpers/fake-clock')
const { createAutoReconnect } = require('../features/autoReconnect')
const { createAntiAfkFeature } = require('../features/antiAfk')

function fixture(overrides = {}) {
  const clock = new FakeClock()
  const sessions = []
  const logs = []
  let stopCount = 0
  const controller = createAutoReconnect({
    config: {
      initialDelayMs: 100,
      maxDelayMs: 400,
      connectTimeoutMs: 1000,
      stableConnectionMs: 500,
      noticeDelayMs: 900,
      ...overrides
    },
    timers: clock,
    logInfo: (line) => logs.push(line),
    onStopped: () => { stopCount += 1 },
    connect: () => {
      const session = {
        bot: new EventEmitter(),
        closes: 0,
        close() { this.closes += 1 }
      }
      sessions.push(session)
      return session
    }
  })
  controller.start()
  return { clock, sessions, logs, controller, getStopCount: () => stopCount }
}

test('disconnect retries once despite kicked, error and end events', async () => {
  const f = fixture()
  const first = f.sessions[0]
  first.bot.emit('kicked', 'restart')
  first.bot.emit('error', new Error('socket closed'))
  first.bot.emit('end', 'socketClosed')
  assert.equal(first.closes, 1)
  assert.equal(f.controller.getSession(), null)
  await f.clock.advance(99)
  assert.equal(f.sessions.length, 1)
  await f.clock.advance(1)
  assert.equal(f.sessions.length, 2)
  first.bot.emit('end', 'late event')
  assert.equal(f.controller.getSession(), f.sessions[1])
  f.controller.stop()
})

test('consecutive connection errors back off and cap the retry delay', async () => {
  const f = fixture()
  for (const delay of [100, 200, 400, 400]) {
    const count = f.sessions.length
    f.controller.getSession().bot.emit('error', new Error('ECONNREFUSED'))
    await f.clock.advance(delay - 1)
    assert.equal(f.sessions.length, count)
    await f.clock.advance(1)
    assert.equal(f.sessions.length, count + 1)
  }
  f.controller.stop()
  assert.equal(f.clock.pending.size, 0)
})

test('stable spawn resets backoff, but a brief spawn does not', async () => {
  const f = fixture()
  f.sessions[0].bot.emit('end')
  await f.clock.advance(100)
  f.sessions[1].bot.emit('spawn')
  await f.clock.advance(499)
  f.sessions[1].bot.emit('end')
  await f.clock.advance(200)
  f.sessions[2].bot.emit('spawn')
  await f.clock.advance(500)
  f.sessions[2].bot.emit('end')
  await f.clock.advance(100)
  assert.equal(f.sessions.length, 4)
  f.controller.stop()
})

test('stalled login times out and retries even without a socket end event', async () => {
  const f = fixture()
  f.sessions[0].bot.emit('connect')
  f.sessions[0].bot.emit('login')
  await f.clock.advance(1000)
  assert.equal(f.sessions[0].closes, 1)
  assert.equal(f.controller.getSession(), null)
  await f.clock.advance(100)
  assert.equal(f.sessions.length, 2)
  f.controller.stop()
})

test('manual stop cancels waiting retries and is idempotent', async () => {
  const f = fixture()
  f.sessions[0].bot.emit('end')
  f.controller.stop()
  f.controller.stop()
  f.controller.start()
  await f.clock.advance(10000)
  assert.equal(f.sessions.length, 1)
  assert.equal(f.getStopCount(), 1)
  assert.equal(f.clock.pending.size, 0)
})

test('disabled reconnect still connects initially and stops on failure', async () => {
  const f = fixture({ enabled: false })
  f.sessions[0].bot.emit('error', new Error('proxy failed'))
  await f.clock.advance(10000)
  assert.equal(f.sessions.length, 1)
  assert.equal(f.getStopCount(), 1)
  assert.equal(f.clock.pending.size, 0)
})

test('notice reconnect respects the extra waiting period', async () => {
  const f = fixture()
  f.sessions[0].shouldDelayReconnect = () => true
  f.sessions[0].bot.emit('end', 'reconnect after notice')
  await f.clock.advance(899)
  assert.equal(f.sessions.length, 1)
  await f.clock.advance(1)
  assert.equal(f.sessions.length, 2)
  f.controller.stop()
})

test('a synchronous connection failure can recover on the next attempt', async () => {
  const clock = new FakeClock()
  let attempts = 0
  const recovered = { bot: new EventEmitter(), close() {} }
  const controller = createAutoReconnect({
    config: { initialDelayMs: 100 }, timers: clock, logInfo() {},
    connect() {
      if (++attempts === 1) throw new Error('temporary connection setup failure')
      return recovered
    }
  })
  controller.start()
  await clock.advance(100)
  assert.equal(controller.getSession(), recovered)
  controller.stop()
})

test('early connection failure can clean up movement before plugins are injected', () => {
  const feature = createAntiAfkFeature({
    bot: new EventEmitter(), config: { enabled: false }, logInfo() {}, sleep: async () => {}
  })
  assert.doesNotThrow(() => feature.onDisconnect())
})

test('manual reconnect closes the current session and ignores its late events', async () => {
  const f = fixture()
  const first = f.sessions[0]
  first.bot.emit('spawn')
  first.close = function () {
    this.closes += 1
    this.bot.emit('end', 'manual quit')
  }
  assert.equal(f.controller.reconnect(), true)
  assert.equal(first.closes, 1)
  assert.equal(f.sessions.length, 2)
  first.bot.emit('error', new Error('late error'))
  first.bot.emit('end', 'late end')
  f.sessions[1].bot.emit('spawn')
  await f.clock.advance(600)
  assert.equal(f.sessions.length, 2)
  assert.equal(f.controller.getSession(), f.sessions[1])
  f.controller.stop()
  assert.equal(f.clock.pending.size, 0)
})

test('manual reconnect skips waiting retries and resets their backoff', async () => {
  const f = fixture()
  f.sessions[0].bot.emit('end')
  f.controller.reconnect()
  assert.equal(f.sessions.length, 2)
  f.sessions[1].bot.emit('end')
  await f.clock.advance(100)
  assert.equal(f.sessions.length, 3)
  f.sessions[2].bot.emit('spawn')
  await f.clock.advance(400)
  assert.equal(f.sessions.length, 3)
  f.controller.stop()
})

test('manual reconnect works with automatic retries disabled but cannot revive a stopped controller', () => {
  const f = fixture({ enabled: false })
  assert.equal(f.controller.reconnect(), true)
  assert.equal(f.sessions.length, 2)
  assert.equal(f.getStopCount(), 0)
  f.controller.stop()
  assert.equal(f.controller.reconnect(), false)
  assert.equal(f.sessions.length, 2)
  assert.equal(f.clock.pending.size, 0)
})
