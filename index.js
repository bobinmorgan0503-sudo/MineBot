const readline = require('readline')
const mineflayer = require('mineflayer')
const {
  antiAfkConfig,
  autoDigConfig,
  autoFishConfig,
  autoVerifyConfig,
  protocolConfig,
  serverConfig,
  sieveConfig,
  spawnCommands,
  timingConfig
} = require('./config')
const { createAntiAfkFeature } = require('./features/antiAfk')
const { createAutoDigFeature } = require('./features/autoDig')
const { createAutoFishFeature } = require('./features/autoFish')
const { createSieveFeature } = require('./features/sieve')
const { createAutoVerifyFeature } = require('./features/autoVerify')

function getCliOptions(argv) {
  const options = {}
  const positional = []

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--username' || arg === '-u') {
      const value = argv[index + 1]
      if (value) {
        options.username = value
        index += 1
      }
      continue
    }

    if (arg.startsWith('--username=')) {
      options.username = arg.slice('--username='.length)
      continue
    }

    if (arg === '--host' || arg === '-h') {
      const value = argv[index + 1]
      if (value) {
        options.host = value
        index += 1
      }
      continue
    }

    if (arg.startsWith('--host=')) {
      options.host = arg.slice('--host='.length)
      continue
    }

    if (arg === '--port' || arg === '-p') {
      const value = argv[index + 1]
      if (value) {
        options.port = Number.parseInt(value, 10)
        index += 1
      }
      continue
    }

    if (arg.startsWith('--port=')) {
      options.port = Number.parseInt(arg.slice('--port='.length), 10)
      continue
    }

    if (arg === '--version' || arg === '-v') {
      const value = argv[index + 1]
      if (value) {
        options.version = value
        index += 1
      }
      continue
    }

    if (arg.startsWith('--version=')) {
      options.version = arg.slice('--version='.length)
      continue
    }

    if (!arg.startsWith('-')) {
      positional.push(arg)
    }
  }

  if (!options.username && positional[0]) options.username = positional[0]
  if (!options.host && positional[1]) options.host = positional[1]
  if (options.port == null && positional[2]) options.port = Number.parseInt(positional[2], 10)
  if (!options.version && positional[3]) options.version = positional[3]

  return options
}

const cliOptions = getCliOptions(process.argv.slice(2))
const runtimeServerConfig = {
  ...serverConfig,
  host: cliOptions.host || serverConfig.host,
  port: Number.isFinite(cliOptions.port) ? cliOptions.port : serverConfig.port,
  username: cliOptions.username || serverConfig.username,
  version: cliOptions.version || serverConfig.version
}

const bot = mineflayer.createBot({
  host: runtimeServerConfig.host,
  port: runtimeServerConfig.port,
  username: runtimeServerConfig.username,
  auth: runtimeServerConfig.auth,
  version: runtimeServerConfig.version,
  customPackets: protocolConfig.customPackets
})

if (bot._client) {
  bot._client.on('packet', (data, meta) => {
    if (!meta || meta.state !== 'configuration' || meta.name !== 'add_resource_pack') return

    logVerbose(`Received resource pack request: ${data.uuid}`)
    bot._client.write('resource_pack_receive', {
      uuid: data.uuid,
      result: 1
    })
  })
}

let chatReady = false
let setupStarted = false
const SHOW_CHAT_LOGS = true
const SHOW_VERBOSE_LOGS = false

function disconnectBot() {
  if (typeof bot.quit === 'function') {
    bot.quit()
    return
  }

  if (typeof bot.end === 'function') {
    bot.end()
    return
  }

  if (bot._client && typeof bot._client.end === 'function') {
    bot._client.end()
  }
}

function logInfo(...args) {
  if (args.length === 0) return
  console.log(...args)
}

function logVerbose(...args) {
  if (SHOW_VERBOSE_LOGS) console.log(...args)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runSpawnCommands() {
  const commands = Array.isArray(spawnCommands)
    ? spawnCommands.map((command) => String(command).trim()).filter(Boolean)
    : []

  if (commands.length === 0) return

  const perCommandDelayMs = Number(timingConfig.perCommandDelayMs || 1000)
  for (const command of commands) {
    await sleep(perCommandDelayMs)
    bot.chat(command)
    logInfo(`Sent: ${command}`)
  }
}

const features = [
  createAntiAfkFeature({
    bot,
    config: antiAfkConfig,
    logInfo,
    sleep
  }),
  createAutoDigFeature({
    bot,
    config: autoDigConfig,
    logInfo,
    sleep
  }),
  createAutoFishFeature({
    bot,
    config: autoFishConfig,
    logInfo,
    sleep
  }),
  createAutoVerifyFeature({
    bot,
    config: autoVerifyConfig,
    logInfo
  }),
  createSieveFeature({
    bot,
    config: sieveConfig,
    logInfo,
    logVerbose,
    sleep
  })
]

const terminal = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

const originalConsoleLog = console.log.bind(console)
const originalConsoleError = console.error.bind(console)

function writePreservingInput(writeFn, args) {
  const hasActiveInput = Boolean(chatReady && terminal && terminal.input && terminal.input.isTTY)

  if (!hasActiveInput) {
    writeFn(...args)
    return
  }

  const currentLine = terminal.line || ''
  const cursorOffset = typeof terminal.cursor === 'number' ? terminal.cursor : currentLine.length
  const promptText = typeof terminal._prompt === 'string' ? terminal._prompt : '> '

  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  writeFn(...args)
  process.stdout.write(promptText + currentLine)
  readline.cursorTo(process.stdout, Math.max(promptText.length, promptText.length + cursorOffset))
}

console.log = (...args) => writePreservingInput(originalConsoleLog, args)
console.error = (...args) => writePreservingInput(originalConsoleError, args)

terminal.on('line', async (line) => {
  const message = line.trim()

  if (!message) {
    terminal.prompt()
    return
  }

  if (message === '/quit' || message === '/exit') {
    await Promise.all(features.map(async (feature) => {
      if (typeof feature.stop === 'function') {
        await feature.stop()
      }
    }))
    terminal.close()
    disconnectBot()
    return
  }

  if (!chatReady) {
    logInfo('Bot is not ready for commands yet.')
    terminal.prompt()
    return
  }

  for (const feature of features) {
    if (typeof feature.handleCommand === 'function' && await feature.handleCommand(message)) {
      terminal.prompt()
      return
    }
  }

  bot.chat(message)
  terminal.prompt()
})

terminal.on('close', () => {
  if (bot._client && bot._client.state !== 'end') {
    disconnectBot()
  }
})

bot.once('spawn', () => {
  if (setupStarted) return
  setupStarted = true
  chatReady = true

  logInfo('Joined server.')
  for (const feature of features) {
    if (typeof feature.getCommandHelp !== 'function') continue
    for (const line of feature.getCommandHelp()) {
      logInfo(line)
    }
  }
  logInfo('Local command: /quit')
  terminal.prompt()

  for (const feature of features) {
    if (typeof feature.onReady === 'function') {
      feature.onReady()
    }
  }

  void runSpawnCommands().catch((error) => {
    console.error('Failed to run spawn commands:', error.message)
  })
})

bot.on('connect', () => {
  logInfo(
    `TCP connected as ${runtimeServerConfig.username} ` +
    `to ${runtimeServerConfig.host}:${runtimeServerConfig.port}, waiting for login...`
  )
})

bot.on('login', () => {
  logInfo('Login packet sent to server.')
})

bot.on('message', (message) => {
  for (const feature of features) {
    if (typeof feature.onMessage === 'function') {
      feature.onMessage(message)
    }
  }

  if (!SHOW_CHAT_LOGS) return

  if (message && typeof message.toAnsi === 'function') {
    logInfo(message.toAnsi())
    return
  }

  logInfo(String(message))
})

bot.on('kicked', (reason) => {
  chatReady = false
  for (const feature of features) {
    if (typeof feature.onDisconnect === 'function') feature.onDisconnect()
  }
  logInfo('Kicked:', reason)
})

bot.on('end', (reason) => {
  chatReady = false
  for (const feature of features) {
    if (typeof feature.onDisconnect === 'function') feature.onDisconnect()
  }
  logInfo('Disconnected from server.', reason || '')
  terminal.close()
})

bot.on('error', (error) => {
  console.error('Bot error:', error)
})
