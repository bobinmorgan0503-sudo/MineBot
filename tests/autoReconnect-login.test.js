const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { EventEmitter } = require('node:events')
const { FakeClock } = require('./helpers/fake-clock')
const { createAutoReconnect } = require('../features/autoReconnect')
const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')

function fixture({ argv = [], reconnect = {}, socks, dns } = {}) {
  const clock = new FakeClock()
  const bots = []
  const featureInstances = []
  const terminal = new EventEmitter()
  terminal.input = { isTTY: false }
  terminal.prompt = () => {}
  terminal.close = () => terminal.emit('close')
  const processMock = Object.assign(new EventEmitter(), {
    argv: ['node', 'index.js', ...argv],
    stdin: terminal.input, stdout: {}, env: {},
    cwd: () => __dirname, exit: () => {}
  })
  const config = {
    serverConfig: { host: 'localhost', port: 25565, username: 'TestBot', version: '1.21.11', auth: 'offline' },
    protocolConfig: {}, timingConfig: { perCommandDelayMs: 10 },
    spawnCommands: ['/login test-password', '/home home'],
    autoVerifyConfig: { enabled: true, matchTexts: ['/verify'], dedupeWindowMs: 5000 },
    autoReconnectConfig: { initialDelayMs: 100, maxDelayMs: 400, connectTimeoutMs: 10000, ...reconnect }
  }
  function createBot(options) {
    const bot = Object.assign(new EventEmitter(), { options, chats: [], swings: 0 })
    const client = Object.assign(new EventEmitter(), { state: 'play', packets: [] })
    client.write = (name, data) => client.packets.push({ name, data })
    client.setSocket = (socket) => { client.socket = socket }
    for (const event of ['connect', 'error', 'end']) client.on(event, (...args) => bot.emit(event, ...args))
    bot._client = client
    bot.chat = (command) => bot.chats.push(command)
    bot.loadPlugin = () => {}
    bot.swingArm = () => { bot.swings += 1 }
    bot.quit = () => {
      if (client.state === 'end') return
      client.state = 'end'
      bot.emit('end', 'quit')
    }
    bots.push(bot)
    if (options.connect) options.connect(client)
    return bot
  }
  function requireMock(name) {
    if (name.endsWith('config.js')) return config
    if (name === 'fs') return { mkdirSync() {}, copyFileSync() {} }
    if (name === 'readline') return { createInterface: () => terminal }
    if (name === 'mineflayer') return { createBot }
    if (name === 'mineflayer-pathfinder') return { pathfinder() {}, goals: {} }
    if (name === 'dns') return { promises: dns || { resolveSrv: async () => [] } }
    if (name === 'socks') return { SocksClient: socks || {} }
    if (name === './features/autoReconnect') return {
      createAutoReconnect: (options) => createAutoReconnect({ ...options, timers: clock })
    }
    if (name === './features/autoVerify') return require('../features/autoVerify')
    if (name === './features/navigation') return { createNavigationService: () => ({}) }
    if (name.startsWith('./features/')) return new Proxy({}, { get: () => () => {
      const feature = {
        ready: 0, disconnected: 0,
        onReady() { this.ready += 1 },
        onDisconnect() { this.disconnected += 1 }
      }
      featureInstances.push(feature)
      return feature
    } })
    return require(name)
  }
  requireMock.resolve = (name) => name
  requireMock.cache = {}
  const context = vm.createContext({
    require: requireMock, __dirname: path.join(__dirname, '..'), process: processMock,
    console: { log() {}, error() {} },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout
  })
  vm.runInContext(source, context, { filename: 'index.js' })
  const controller = vm.runInContext('autoReconnect', context)
  return { clock, bots, terminal, controller, featureInstances, process: processMock }
}

test('reconnect runs login and spawn commands again using the same connection settings', async (t) => {
  const f = fixture({ argv: ['--username', 'ReconnectBot', '--host', 'example.test', '--port', '25566'] })
  t.after(() => f.controller.stop())
  const first = f.bots[0]
  first.emit('spawn')
  await f.clock.advance(1020)
  assert.deepEqual(first.chats, ['/login test-password', '/home home'])
  first.emit('message', 'successfully logged in')
  first.emit('spawn') // Respawns must not repeat login.
  first.emit('end', 'socketClosed')
  await f.clock.advance(100)
  const second = f.bots[1]
  assert.equal(second.options.host, 'example.test')
  assert.equal(second.options.port, 25566)
  assert.equal(second.options.username, 'ReconnectBot')
  second.emit('spawn')
  await f.clock.advance(1020)
  assert.deepEqual(second.chats, ['/login test-password', '/home home'])
  assert.equal(second.swings, 1)
  assert.ok(f.featureInstances.every((feature) => feature.ready === 1))
})

test('dialog login and pre-spawn join prompt are handled on each new connection', async (t) => {
  const f = fixture()
  t.after(() => f.controller.stop())
  for (let index = 0; index < 2; index += 1) {
    const bot = f.bots[index]
    bot._client.emit('packet', { text: '单击左键以加入' }, { state: 'play', name: 'set_title_text' })
    await f.clock.advance(500)
    assert.equal(bot.swings, 1)
    bot._client.emit('packet', {
      dialog: {
        title: '登录',
        inputs: [{ key: 'password', label: '密码' }],
        action: { id: 'loginpool:auth_login', label: '登录' }
      }
    }, { state: 'play', name: 'show_dialog' })
    const response = bot._client.packets.find((packet) => packet.name === 'custom_click_action')
    assert.equal(response.data.nbt.value.password.value, 'test-password')
    bot.emit('spawn')
    await f.clock.advance(10)
    assert.deepEqual(bot.chats, ['/home home'])
    if (index === 0) {
      bot.emit('end', 'socketClosed')
      await f.clock.advance(100)
    }
  }
})

test('disconnect cancels old login commands, delayed swings and duplicate feature cleanup', async (t) => {
  const f = fixture()
  t.after(() => f.controller.stop())
  const first = f.bots[0]
  first.emit('spawn')
  await f.clock.advance(10)
  first.emit('kicked', 'server restarting')
  first.emit('end', 'socketClosed')
  await f.clock.advance(1100)
  assert.deepEqual(first.chats, ['/login test-password'])
  assert.equal(first.swings, 0)
  assert.ok(f.featureInstances.slice(0, 13).every((feature) => feature.disconnected === 1))
  assert.equal(f.bots.length, 2)
})

test('authenticated notice arriving during login delay skips the redundant login', async (t) => {
  const f = fixture()
  t.after(() => f.controller.stop())
  f.bots[0].emit('spawn')
  f.bots[0].emit('message', '已帮你自动登录')
  await f.clock.advance(20)
  assert.deepEqual(f.bots[0].chats, ['/home home'])
})

test('chat verification deduplication resets on reconnect', async (t) => {
  const f = fixture()
  t.after(() => f.controller.stop())
  const message = { text: '验证', clickEvent: { action: 'run_command', value: '/verify test' } }
  f.bots[0].emit('message', message)
  f.bots[0].emit('message', message)
  assert.deepEqual(f.bots[0].chats, ['/verify test'])
  f.bots[0].emit('end')
  await f.clock.advance(100)
  f.bots[1].emit('message', message)
  assert.deepEqual(f.bots[1].chats, ['/verify test'])
})

test('quit during retry cancels reconnect; SIGINT closes an active session', async () => {
  const f = fixture()
  f.bots[0].emit('end')
  f.terminal.emit('line', '/quit')
  await f.clock.advance(20000)
  assert.equal(f.bots.length, 1)
  assert.equal(f.clock.pending.size, 0)
  const active = fixture()
  active.process.emit('SIGINT')
  await active.clock.advance(20000)
  assert.equal(active.bots.length, 1)
  assert.equal(active.bots[0]._client.state, 'end')
  assert.equal(active.clock.pending.size, 0)
})

test('proxy retry re-resolves SRV and rejects a late socket from the cancelled attempt', async (t) => {
  const requests = []
  let resolutions = 0
  const f = fixture({
    argv: ['--proxy-host', '127.0.0.1', '--proxy-port', '1080'],
    dns: { resolveSrv: async () => [{ name: `target-${++resolutions}.test`, port: 25566, priority: 0, weight: 1 }] },
    socks: { createConnection: (options, callback) => requests.push({ options, callback }) }
  })
  t.after(() => f.controller.stop())
  await f.clock.flush()
  assert.equal(requests[0].options.destination.host, 'target-1.test')
  f.bots[0].emit('error', new Error('proxy failed'))
  await f.clock.advance(100)
  assert.equal(requests[1].options.destination.host, 'target-2.test')
  let destroyed = false
  requests[0].callback(null, { socket: { destroy() { destroyed = true } } })
  assert.equal(destroyed, true)
  assert.equal(f.bots[0]._client.socket, undefined)
  requests[1].callback(null, { socket: { destroy() {} } })
  assert.equal(f.bots[1].options.host, 'target-2.test')
})

test('/reconnect is local, cancels old login work and logs in again immediately', async (t) => {
  const f = fixture({ reconnect: { enabled: false } })
  t.after(() => f.controller.stop())
  const first = f.bots[0]
  first.emit('spawn')
  f.terminal.emit('line', '/reconnect')
  assert.equal(f.bots.length, 2)
  assert.equal(first._client.state, 'end')
  f.bots[1].emit('spawn')
  await f.clock.advance(1020)
  assert.deepEqual(first.chats, [])
  assert.deepEqual(f.bots[1].chats, ['/login test-password', '/home home'])
})

test('/reconnect works before spawn and while waiting, and rejects arguments locally', async (t) => {
  const f = fixture()
  t.after(() => f.controller.stop())
  f.terminal.emit('line', '/reconnect')
  assert.equal(f.bots.length, 2)
  f.bots[1].emit('end')
  f.terminal.emit('line', '/reconnect')
  assert.equal(f.bots.length, 3)
  f.bots[2].emit('spawn')
  f.terminal.emit('line', '/reconnect unexpected')
  await f.clock.advance(1020)
  assert.equal(f.bots.length, 3)
  assert.deepEqual(f.bots[2].chats, ['/login test-password', '/home home'])
})
