const fs = require('fs')
const path = require('path')
const readline = require('readline')
const dns = require('dns').promises
const { spawn } = require('child_process')
const mineflayer = require('mineflayer')
const nbt = require('prismarine-nbt')
const { SocksClient } = require('socks')
const {
  pathfinder,
  Movements,
  goals: { GoalBlock, GoalGetToBlock }
} = require('mineflayer-pathfinder')
const { createAutoBackFeature } = require('./features/autoBack')
const { createAntiAfkFeature } = require('./features/antiAfk')
const { createAutoAttackFeature } = require('./features/autoAttack')
const { createAutoDigFeature } = require('./features/autoDig')
const { createAutoDropFeature } = require('./features/autoDrop')
const { createAutoFishFeature } = require('./features/autoFish')
const { createInventoryFeature } = require('./features/inventory')
const { createMakeuFeature } = require('./features/makeu')
const { createNukerFeature } = require('./features/nuker')
const { createAutoMineFeature } = require('./features/autoMine')
const { createAutoFarmFeature } = require('./features/autoFarm')
const { createGotoFeature } = require('./features/goto')
const { createSieveFeature } = require('./features/sieve')
const { createAutoVerifyFeature } = require('./features/autoVerify')

// pkg 将应用代码放进只读快照。已打包时必须使用可执行文件同目录的配置，
// 这样用户无需安装 Node.js 也能编辑配置，且配置备份能够正常写入磁盘。
const APP_DIRECTORY = process.pkg ? path.dirname(process.execPath) : __dirname
const CONFIG_FILE_PATH = path.join(APP_DIRECTORY, 'config.js')
const CONFIG_BACKUP_DIR = path.join(APP_DIRECTORY, 'config-backups')

function ensureRuntimeConfigFile() {
  if (!process.pkg || fs.existsSync(CONFIG_FILE_PATH)) return

  const bundledConfigPath = path.join(__dirname, 'config.js')
  fs.copyFileSync(bundledConfigPath, CONFIG_FILE_PATH)
  console.log(`Created editable configuration file: ${CONFIG_FILE_PATH}`)
}

function formatBackupTimestamp(date = new Date()) {
  const pad = (value, length = 2) => String(value).padStart(length, '0')

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '-',
    pad(date.getMilliseconds(), 3)
  ].join('')
}

function backupConfigFile() {
  fs.mkdirSync(CONFIG_BACKUP_DIR, { recursive: true })

  const latestBackupPath = path.join(CONFIG_BACKUP_DIR, 'config.latest.js')
  const timestampedBackupPath = path.join(
    CONFIG_BACKUP_DIR,
    `config.${formatBackupTimestamp()}.js`
  )

  fs.copyFileSync(CONFIG_FILE_PATH, latestBackupPath)
  fs.copyFileSync(CONFIG_FILE_PATH, timestampedBackupPath)
}

function loadRuntimeConfig() {
  try {
    ensureRuntimeConfigFile()
    const resolvedConfigPath = require.resolve(CONFIG_FILE_PATH)
    delete require.cache[resolvedConfigPath]
    const loadedConfig = require(resolvedConfigPath)
    backupConfigFile()
    return loadedConfig
  } catch (error) {
    throw new Error(`Failed to load and back up config.js: ${error.message}`)
  }
}

const {
  antiAfkConfig,
  autoBackConfig,
  autoAttackConfig,
  autoDigConfig,
  autoDropConfig,
  autoFishConfig,
  makeuConfig,
  nukerConfig,
  autoMineConfig,
  autoFarmConfig,
  autoVerifyConfig,
  protocolConfig,
  serverConfig,
  sieveConfig,
  spawnCommands,
  timingConfig
} = loadRuntimeConfig()

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

    if (arg === '--proxy-host') {
      const value = argv[index + 1]
      if (value) {
        options.proxyHost = value
        index += 1
      }
      continue
    }

    if (arg.startsWith('--proxy-host=')) {
      options.proxyHost = arg.slice('--proxy-host='.length)
      continue
    }

    if (arg === '--proxy-port') {
      const value = argv[index + 1]
      if (value) {
        options.proxyPort = Number.parseInt(value, 10)
        index += 1
      }
      continue
    }

    if (arg.startsWith('--proxy-port=')) {
      options.proxyPort = Number.parseInt(arg.slice('--proxy-port='.length), 10)
      continue
    }

    if (arg === '--proxy-username') {
      const value = argv[index + 1]
      if (value) {
        options.proxyUsername = value
        index += 1
      }
      continue
    }

    if (arg.startsWith('--proxy-username=')) {
      options.proxyUsername = arg.slice('--proxy-username='.length)
      continue
    }

    if (arg === '--proxy-password') {
      const value = argv[index + 1]
      if (value) {
        options.proxyPassword = value
        index += 1
      }
      continue
    }

    if (arg.startsWith('--proxy-password=')) {
      options.proxyPassword = arg.slice('--proxy-password='.length)
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
  if (!options.proxyHost && positional[4]) options.proxyHost = positional[4]
  if (options.proxyPort == null && positional[5]) options.proxyPort = Number.parseInt(positional[5], 10)
  if (!options.proxyUsername && positional[6]) options.proxyUsername = positional[6]
  if (!options.proxyPassword && positional[7]) options.proxyPassword = positional[7]

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
const runtimeProxyConfig = {
  host: cliOptions.proxyHost || '',
  port: Number.isFinite(cliOptions.proxyPort) ? cliOptions.proxyPort : null,
  username: cliOptions.proxyUsername || '',
  password: cliOptions.proxyPassword || ''
}
const proxyRequested = [
  cliOptions.proxyHost,
  cliOptions.proxyPort,
  cliOptions.proxyUsername,
  cliOptions.proxyPassword
].some((value) => value != null && value !== '')
const proxyEnabled = Boolean(runtimeProxyConfig.host && Number.isFinite(runtimeProxyConfig.port))

if (proxyRequested && !proxyEnabled) {
  throw new Error('Proxy host and port are required when using proxy options.')
}

async function resolveMinecraftDestination(host, port) {
  if (!host || !Number.isFinite(port) || port !== 25565) {
    return { host, port }
  }

  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${host}`)
    if (!Array.isArray(records) || records.length === 0) {
      return { host, port }
    }

    records.sort((left, right) => {
      if (left.priority !== right.priority) {
        return left.priority - right.priority
      }

      return right.weight - left.weight
    })

    return {
      host: records[0].name,
      port: records[0].port
    }
  } catch {
    return { host, port }
  }
}

const botOptions = {
  username: runtimeServerConfig.username,
  auth: runtimeServerConfig.auth,
  host: runtimeServerConfig.host,
  port: runtimeServerConfig.port,
  version: runtimeServerConfig.version,
  customPackets: protocolConfig.customPackets,
  respawn: false,
  plugins: {
    particle: false
  }
}

if (proxyEnabled) {
  botOptions.connect = (client) => {
    void (async () => {
      const destination = await resolveMinecraftDestination(runtimeServerConfig.host, runtimeServerConfig.port)

      // Match minecraft-protocol's built-in SRV flow so proxy mode behaves the
      // same as a normal direct connection for servers behind SRV records.
      botOptions.host = destination.host
      botOptions.port = destination.port

      if (destination.host !== runtimeServerConfig.host || destination.port !== runtimeServerConfig.port) {
        logInfo(
          `Resolved Minecraft SRV target ${runtimeServerConfig.host}:${runtimeServerConfig.port} ` +
          `-> ${destination.host}:${destination.port} for proxy connection.`
        )
      }

      SocksClient.createConnection({
        proxy: {
          host: runtimeProxyConfig.host,
          port: runtimeProxyConfig.port,
          type: 5,
          userId: runtimeProxyConfig.username || undefined,
          password: runtimeProxyConfig.password || undefined
        },
        command: 'connect',
        destination
      }, (error, info) => {
        if (error) {
          client.emit('error', error)
          return
        }

        client.setSocket(info.socket)
        client.emit('connect')
      })
    })().catch((error) => {
      if (error) {
        client.emit('error', error)
      }
    })
  }
}

const bot = mineflayer.createBot(botOptions)
bot.loadPlugin(pathfinder)

function sanitizeWorldParticlesPacket(packet) {
  if (!packet || typeof packet !== 'object') return

  const usesUpdatedParticlesPacket = typeof bot.supportFeature === 'function' &&
    bot.supportFeature('updatedParticlesPacket')

  const looksMalformed = usesUpdatedParticlesPacket
    ? !packet.particle || packet.particle.type == null
    : packet.particleId == null

  if (!looksMalformed) return

  packet.longDistance ??= false
  packet.alwaysShow ??= false
  packet.x ??= 0
  packet.y ??= 0
  packet.z ??= 0
  packet.offsetX ??= 0
  packet.offsetY ??= 0
  packet.offsetZ ??= 0
  packet.velocityOffset ??= 0
  packet.amount ??= 0
  packet.particles ??= 0
  packet.particleData ??= 0

  if (usesUpdatedParticlesPacket) {
    packet.particle ??= { type: '__ignored__', data: {} }
    packet.particle.type ??= '__ignored__'
    packet.particle.data ??= {}
  } else {
    packet.particleId ??= -1
  }
}

function extractDialogText(value) {
  value = simplifyNbtValue(value)

  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => extractDialogText(entry)).filter(Boolean).join(' ')
  }

  if (typeof value !== 'object') return ''

  const directKeys = ['text', 'contents', 'label', 'tooltip', 'title', 'translate', 'extra', 'with']
  const fragments = []

  for (const key of directKeys) {
    if (value[key] != null) {
      fragments.push(extractDialogText(value[key]))
    }
  }

  if (fragments.length > 0) {
    return fragments.filter(Boolean).join(' ').trim()
  }

  return Object.values(value)
    .map((entry) => extractDialogText(entry))
    .filter(Boolean)
    .join(' ')
    .trim()
}

function simplifyNbtValue(value) {
  if (!value || typeof value !== 'object') return value

  const looksLikeNbt = Object.prototype.hasOwnProperty.call(value, 'type') &&
    Object.prototype.hasOwnProperty.call(value, 'value')

  if (!looksLikeNbt) return value

  try {
    return nbt.simplify(value)
  } catch {
    return value
  }
}

function getPacketDialog(data) {
  if (!data || typeof data !== 'object' || !data.dialog) return null

  const rawDialog = data.dialog
  return simplifyNbtValue(rawDialog.data || rawDialog)
}

function isRejectLikeText(text) {
  if (!text) return false

  return /拒绝|不同意|取消|关闭|返回|上一页|下一页|deny|disagree|reject|cancel|close|back|previous|prev|next|\bno\b/i.test(text)
}

function isAcceptLikeText(text) {
  if (!text) return false

  return /同意|接受|确认|继续|好的|允许|已阅读|阅读|知道了|登录|注册|agree|accept|confirm|continue|proceed|allow|read|acknowledge|understand|login|register|yes|ok/i.test(text)
}

function collectDialogActionCandidates(dialog) {
  const candidates = []

  const pushCandidate = (action, label, path) => {
    if (!action || typeof action !== 'object' || typeof action.id !== 'string') return

    const duplicate = candidates.some((candidate) => candidate.id === action.id)
    if (duplicate) return

    candidates.push({
      id: action.id,
      nbt: action.nbt ?? action.data ?? undefined,
      labelText: extractDialogText(label || action.label || action.tooltip),
      path
    })
  }

  const visit = (value, path, inheritedLabel, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 8) return

    const label = value.label || value.tooltip || value.title || inheritedLabel
    pushCandidate(value.action || value.on_click || value, label, path)

    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`, inheritedLabel, depth + 1))
      return
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === 'nbt' || key === 'data') continue
      visit(child, `${path}.${key}`, label, depth + 1)
    }
  }

  if (!dialog || typeof dialog !== 'object') {
    return candidates
  }

  if (dialog.yes && typeof dialog.yes === 'object') {
    pushCandidate(dialog.yes.action || dialog.yes.on_click, dialog.yes.label || dialog.yes.tooltip, 'yes')
  }

  if (dialog.no && typeof dialog.no === 'object') {
    pushCandidate(dialog.no.action || dialog.no.on_click, dialog.no.label || dialog.no.tooltip, 'no')
  }

  if (dialog.action && typeof dialog.action === 'object') {
    pushCandidate(dialog.action.action || dialog.action.on_click || dialog.action, dialog.action.label || dialog.action.tooltip, 'action')
  }

  if (dialog.action_button && typeof dialog.action_button === 'object') {
    pushCandidate(
      dialog.action_button.action || dialog.action_button.on_click || dialog.action_button,
      dialog.action_button.label || dialog.action_button.tooltip,
      'action_button'
    )
  }

  const listGroups = [
    ['actions', dialog.actions],
    ['buttons', dialog.buttons],
    ['options', dialog.options]
  ]

  for (const [groupName, group] of listGroups) {
    if (!Array.isArray(group)) continue

    for (let index = 0; index < group.length; index += 1) {
      const entry = group[index]
      if (!entry || typeof entry !== 'object') continue

      pushCandidate(
        entry.action || entry.on_click || entry,
        entry.label || entry.tooltip || entry.title,
        `${groupName}[${index}]`
      )
    }
  }

  visit(dialog, 'dialog', undefined)

  return candidates
}

function collectDialogInputCandidates(dialog) {
  if (!dialog || typeof dialog !== 'object' || !Array.isArray(dialog.inputs)) {
    return []
  }

  return dialog.inputs
    .filter((input) => input && typeof input === 'object' && typeof input.key === 'string')
    .map((input) => ({
      key: input.key,
      type: input.type || '',
      labelText: extractDialogText(input.label || input.tooltip || input.placeholder)
    }))
}

function pickDialogAcceptAction(dialog) {
  const candidates = collectDialogActionCandidates(dialog)

  if (candidates.length === 0) return null

  if (dialog && dialog.type === 'minecraft:confirmation') {
    const yesCandidate = candidates.find((candidate) => candidate.path === 'yes')
    if (yesCandidate) return yesCandidate
  }

  const positiveCandidate = candidates.find((candidate) => {
    const joinedText = `${candidate.id} ${candidate.labelText} ${candidate.path}`
    return isAcceptLikeText(joinedText) && !isRejectLikeText(joinedText)
  })

  if (positiveCandidate) return positiveCandidate

  const nonRejectCandidates = candidates.filter((candidate) => {
    const joinedText = `${candidate.id} ${candidate.labelText} ${candidate.path}`
    return !isRejectLikeText(joinedText)
  })

  if (nonRejectCandidates.length === 1) return nonRejectCandidates[0]

  return null
}

function getConfiguredLoginPassword() {
  if (!Array.isArray(spawnCommands)) return ''

  for (const command of spawnCommands) {
    const match = String(command).trim().match(/^\/login\s+(\S+)/i)
    if (match) return match[1]
  }

  return ''
}

function pickDialogInputKey(inputs, preferredKeys, labelPattern) {
  const preferred = inputs.find((input) => preferredKeys.includes(input.key))
  if (preferred) return preferred.key

  const byLabel = inputs.find((input) => labelPattern.test(`${input.key} ${input.labelText}`))
  return byLabel ? byLabel.key : ''
}

function pickTermsAcceptedInputKey(inputs) {
  return pickDialogInputKey(
    inputs,
    ['terms_of_service', 'accept_terms', 'terms_accepted', 'agree_terms', 'tos'],
    /服务条款|条款|同意|已阅读|terms|tos|agree|accept/i
  )
}

function buildDialogResponseNbt(values) {
  const entries = {}

  for (const [key, value] of Object.entries(values)) {
    if (!key) continue

    if (typeof value === 'boolean') {
      entries[key] = nbt.byte(value ? 1 : 0)
    } else {
      entries[key] = nbt.string(String(value))
    }
  }

  if (Object.keys(entries).length === 0) {
    return null
  }

  return nbt.comp(entries)
}

function buildAutoDialogResponseNbt(dialog, action) {
  if (!action || typeof action.id !== 'string') {
    return null
  }

  const inputs = collectDialogInputCandidates(dialog)
  const actionText = `${action.id} ${action.labelText} ${action.path}`
  const password = getConfiguredLoginPassword()

  if (/loginpool:auth_login|auth_login|login/i.test(actionText) && password) {
    const passwordKey = pickDialogInputKey(
      inputs,
      ['password', 'login_password'],
      /密码|password/i
    )
    const autoLoginKey = pickDialogInputKey(
      inputs,
      ['auto_login_by_ip'],
      /自动登录|auto.*login|ip/i
    )

    const termsAcceptedKey = pickTermsAcceptedInputKey(inputs)

    const values = {}
    if (passwordKey) values[passwordKey] = password
    if (autoLoginKey) values[autoLoginKey] = true
    if (termsAcceptedKey) values[termsAcceptedKey] = true

    if (Object.keys(values).length > 0) {
      return buildDialogResponseNbt(values)
    }
  }

  if (/loginpool:auth_register|auth_register|register/i.test(actionText) && password) {
    const passwordKey = pickDialogInputKey(
      inputs,
      ['reg_password', 'password'],
      /密码|password/i
    )
    const confirmPasswordKey = pickDialogInputKey(
      inputs.filter((input) => input.key !== passwordKey),
      ['reg_confirm_password', 'confirm_password'],
      /确认|再次|confirm/i
    )

    const termsAcceptedKey = pickTermsAcceptedInputKey(inputs)

    const values = {}
    if (passwordKey) values[passwordKey] = password
    if (confirmPasswordKey) values[confirmPasswordKey] = password
    if (termsAcceptedKey) values[termsAcceptedKey] = true

    if (Object.keys(values).length > 0) {
      return buildDialogResponseNbt(values)
    }
  }

  return action.nbt || null
}

function getDialogTitle(dialog) {
  if (!dialog || typeof dialog !== 'object') return ''
  return extractDialogText(dialog.title || dialog.name || dialog.body)
}

function formatStructuredReason(reason) {
  if (reason == null || reason === '') return ''

  if (typeof reason === 'string') {
    return reason
  }

  if (reason && typeof reason.toAnsi === 'function') {
    try {
      return reason.toAnsi()
    } catch {
      // fall through to structured parsing
    }
  }

  const simplified = simplifyNbtValue(reason)
  const text = extractDialogText(simplified)
  if (text) return text

  try {
    return JSON.stringify(simplified)
  } catch {
    return String(reason)
  }
}

if (bot._client) {
  bot._client.prependListener('world_particles', sanitizeWorldParticlesPacket)
}

if (bot._client) {
  bot._client.on('packet', (data, meta) => {
    if (!meta) return

    if (meta.state === 'configuration' && meta.name === 'add_resource_pack') {
      logVerbose(`Received resource pack request: ${data.uuid}`)
      bot._client.write('resource_pack_receive', {
        uuid: data.uuid,
        result: 1
      })
      return
    }

    if (meta.state === 'configuration' && meta.name === 'code_of_conduct') {
      logInfo('Received code of conduct prompt, accepting automatically.')
      bot._client.write('accept_code_of_conduct', {})
      return
    }

    if (meta.state === 'play' && (meta.name === 'set_title_subtitle' || meta.name === 'set_title_text')) {
      handlePreSpawnJoinTitle(data && data.text)
      return
    }

    if (meta.name !== 'show_dialog') return

    const dialog = getPacketDialog(data)
    const acceptAction = pickDialogAcceptAction(dialog)

    if (!acceptAction) {
      const dialogTitle = getDialogTitle(dialog)
      logInfo(`Received dialog${dialogTitle ? `: ${dialogTitle}` : ''}, but no accept action was recognized.`)
      if (process.env.MINEBOT_DEBUG_DIALOG === '1') {
        logInfo(JSON.stringify(dialog, null, 2).slice(0, 12000))
      }
      return
    }

    const dialogTitle = getDialogTitle(dialog)
    logInfo(
      `Received dialog${dialogTitle ? `: ${dialogTitle}` : ''}, sending automatic accept action (${acceptAction.id}).`
    )
    const responseNbt = buildAutoDialogResponseNbt(dialog, acceptAction)
    if (/loginpool:auth_login|auth_login/i.test(acceptAction.id) && responseNbt && responseNbt.type === 'compound') {
      dialogLoginSubmitted = true
    }
    if (/loginpool:notice_read|notice_read/i.test(acceptAction.id)) {
      noticeReadSubmitted = true
    }

    bot._client.write('custom_click_action', {
      id: acceptAction.id,
      nbt: responseNbt
    })
  })
}

let chatReady = false
let setupStarted = false
let preSpawnJoinClickSent = false
let dialogLoginSubmitted = false
let noticeReadSubmitted = false
let lastKickReason = ''
let relaunchScheduled = false
const SHOW_CHAT_LOGS = true
const SHOW_VERBOSE_LOGS = false
const NOTICE_RECONNECT_DELAY_MS = 90000
const MAX_NOTICE_RECONNECTS = 2

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

function isLoginCommand(command) {
  return /^\/login(?:\s|$)/i.test(command)
}

function isAuthenticatedMessage(text) {
  return /\u5df2\u6210\u529f\u767b\u5f55|\u5df2\u5e2e\u4f60\u81ea\u52a8\u767b\u5f55|successfully logged in/i.test(text)
}

function isNoticeReconnectReason(text) {
  return /连接出现问题|请重新连接|connection.*problem|reconnect/i.test(String(text || ''))
}

function getNoticeReconnectAttempt() {
  const attempt = Number.parseInt(process.env.MINEBOT_NOTICE_RECONNECT_ATTEMPT || '0', 10)
  return Number.isFinite(attempt) && attempt >= 0 ? attempt : 0
}

function scheduleProcessRelaunch(reason) {
  if (relaunchScheduled) return true

  const attempt = getNoticeReconnectAttempt()
  if (attempt >= MAX_NOTICE_RECONNECTS) {
    logInfo(`Skipped automatic reconnect after notice because attempt limit was reached (${attempt}).`)
    return false
  }

  relaunchScheduled = true
  const nextAttempt = attempt + 1
  logInfo(
    `Server requested reconnect after notice (${reason || 'unknown reason'}); ` +
    `restarting in ${Math.round(NOTICE_RECONNECT_DELAY_MS / 1000)}s (attempt ${nextAttempt}/${MAX_NOTICE_RECONNECTS}).`
  )

  setTimeout(() => {
    const child = spawn(process.execPath, process.argv.slice(1), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        MINEBOT_NOTICE_RECONNECT_ATTEMPT: String(nextAttempt)
      },
      stdio: 'inherit'
    })

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal)
        return
      }

      process.exit(code == null ? 0 : code)
    })

    child.on('error', (error) => {
      console.error('Failed to restart after notice reconnect:', error.message)
      process.exit(1)
    })
  }, NOTICE_RECONNECT_DELAY_MS)

  return true
}

async function performPostLoginAttack() {
  await sleep(1000)

  if (typeof bot.swingArm === 'function') {
    bot.swingArm('right')
    logInfo('Performed one left-click swing after /login.')
    return
  }

  logInfo('Skipped post-/login attack because swingArm is unavailable.')
}

function isPreSpawnJoinPrompt(text) {
  return /单击左键以加入|左键.*加入|left[- ]?click.*join|click.*join/i.test(text)
}

function handlePreSpawnJoinTitle(titleText) {
  if (setupStarted || preSpawnJoinClickSent) return

  const text = extractDialogText(titleText)
  if (!isPreSpawnJoinPrompt(text)) return

  preSpawnJoinClickSent = true
  logInfo(`Received join prompt${text ? `: ${text}` : ''}; sending left-click.`)

  setTimeout(() => {
    if (setupStarted || !bot._client || bot._client.state === 'end') return

    if (typeof bot.swingArm === 'function') {
      bot.swingArm('right')
      return
    }

    bot._client.write('arm_animation', { hand: 0 })
  }, 500)
}

async function runSpawnCommands() {
  const commands = Array.isArray(spawnCommands)
    ? spawnCommands.map((command) => String(command).trim()).filter(Boolean)
    : []

  if (commands.length === 0) return

  const perCommandDelayMs = Number(timingConfig.perCommandDelayMs || 1000)
  for (const command of commands) {
    if (dialogLoginSubmitted && isLoginCommand(command)) {
      logInfo(`Skipped ${command} because dialog login was already submitted.`)
      continue
    }

    await sleep(perCommandDelayMs)
    bot.chat(command)
    logInfo(`Sent: ${command}`)

    if (isLoginCommand(command)) {
      await performPostLoginAttack()
    }
  }
}

const features = [
  createGotoFeature({
    bot,
    GoalBlock,
    Movements,
    logInfo
  }),
  createAntiAfkFeature({
    bot,
    config: antiAfkConfig,
    logInfo,
    sleep
  }),
  createAutoBackFeature({
    bot,
    config: autoBackConfig,
    logInfo,
    sleep
  }),
  createAutoAttackFeature({
    bot,
    config: autoAttackConfig,
    logInfo,
    sleep
  }),
  createAutoDigFeature({
    bot,
    config: autoDigConfig,
    logInfo,
    sleep
  }),
  createAutoDropFeature({
    bot,
    config: autoDropConfig,
    logInfo,
    sleep
  }),
  createAutoFishFeature({
    bot,
    config: autoFishConfig,
    logInfo,
    sleep
  }),
  createInventoryFeature({
    bot,
    logInfo
  }),
  createAutoMineFeature({
    bot,
    config: autoMineConfig,
    GoalGetToBlock,
    Movements,
    logInfo,
    sleep
  }),
  createAutoFarmFeature({
    bot,
    config: autoFarmConfig,
    logInfo,
    sleep
  }),
  createAutoVerifyFeature({
    bot,
    config: autoVerifyConfig,
    logInfo
  }),
  createNukerFeature({
    bot,
    config: nukerConfig,
    logInfo,
    sleep
  }),
  createSieveFeature({
    bot,
    config: sieveConfig,
    logInfo,
    logVerbose,
    sleep
  }),
  createMakeuFeature({
    bot,
    config: makeuConfig,
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
let terminalClosed = false

function promptTerminal() {
  if (terminalClosed) return
  terminal.prompt()
}

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
    promptTerminal()
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
    promptTerminal()
    return
  }

  for (const feature of features) {
    if (typeof feature.handleCommand === 'function' && await feature.handleCommand(message)) {
      promptTerminal()
      return
    }
  }

  bot.chat(message)
  promptTerminal()
})

terminal.on('close', () => {
  terminalClosed = true
  if (process.stdin.isTTY && bot._client && bot._client.state !== 'end') {
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
  promptTerminal()

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
  const proxySuffix = proxyEnabled
    ? ` via SOCKS5 ${runtimeProxyConfig.host}:${runtimeProxyConfig.port}`
    : ''
  logInfo(
    `TCP connected as ${runtimeServerConfig.username} ` +
    `to ${runtimeServerConfig.host}:${runtimeServerConfig.port}${proxySuffix}, waiting for login...`
  )
})

bot.on('login', () => {
  logInfo('Login packet sent to server.')
})

bot.on('message', (message) => {
  if (isAuthenticatedMessage(String(message))) {
    dialogLoginSubmitted = true
  }

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

bot.on('death', () => {
  for (const feature of features) {
    if (typeof feature.onDeath === 'function') {
      feature.onDeath()
    }
  }
})

bot.on('spawn', () => {
  for (const feature of features) {
    if (typeof feature.onSpawn === 'function') {
      feature.onSpawn()
    }
  }
})

bot.on('time', () => {
  for (const feature of features) {
    if (typeof feature.onTime === 'function') {
      feature.onTime()
    }
  }
})

bot.on('kicked', (reason) => {
  chatReady = false
  for (const feature of features) {
    if (typeof feature.onDisconnect === 'function') feature.onDisconnect()
  }
  const formattedReason = formatStructuredReason(reason)
  lastKickReason = formattedReason || String(reason || '')
  logInfo('Kicked:', formattedReason || reason)
})

bot.on('end', (reason) => {
  chatReady = false
  for (const feature of features) {
    if (typeof feature.onDisconnect === 'function') feature.onDisconnect()
  }
  const formattedReason = formatStructuredReason(reason)
  logInfo('Disconnected from server.', formattedReason || '')
  if (noticeReadSubmitted && isNoticeReconnectReason(lastKickReason) && scheduleProcessRelaunch(lastKickReason)) {
    return
  }
  terminal.close()
})

bot.on('error', (error) => {
  console.error('Bot error:', error)
})
