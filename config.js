const { Vec3 } = require('vec3')

const serverConfig = {
  host: 'azrxjh.cn',
  port: 25568,
  version: '1.12.2',
  username: 'Arthas',
  auth: 'offline'
}

const partialPacketWorkaround = {
  play: {
    toClient: {
      types: {
        // This server sends particle payloads that the current protocol stack
        // cannot decode reliably. We do not use particle data, so redirect
        // the packet to a custom raw-buffer type instead of overriding the
        // original array definition in-place, because minecraft-protocol
        // merges protocol arrays with lodash.merge.
        packet_partial_world_particles: [
          'container',
          [
            {
              name: 'payload',
              type: 'restBuffer'
            }
          ]
        ],
        packet: [
          'container',
          [
            {},
            {
              type: [
                'switch',
                {
                  fields: {
                    world_particles: 'packet_partial_world_particles'
                  }
                }
              ]
            }
          ]
        ]
      }
    }
  }
}

const protocolConfig = {
  customPackets: {
    // minecraft-protocol indexes customPackets by mcData.version.majorVersion,
    // so keys here must be major versions like "1.12" or "1.21".
    '1.12': partialPacketWorkaround,
    '1.21': partialPacketWorkaround
  }
}

const timingConfig = {
  perCommandDelayMs: 2000
}

const spawnCommands = [
  '/login cui159478',
  '/home home'
]

const sieveConfig = {
  tickDelayMs: 100,
  containerOpenTimeoutMs: 3000,
  gravelContainerPos: new Vec3(-11894, 67, -2092),
  trapdoorPos: new Vec3(-11896, 68, -2094),
  fencePos1: new Vec3(-11896, 68, -2092),
  fencePos2: new Vec3(-11897, 68, -2093),
  gravelSlot: 0,
  blockFaceDown: 0,
  interactCursor: 0.5
}

const autoDigConfig = {
  enabled: true,
  mode: 'fixedpos',
  locations: [
    new Vec3(-11887, 68, -2100),
    new Vec3(-11887, 68, -2101),
    new Vec3(-11887, 68, -2103),
    new Vec3(-11887, 68, -2104)
  ],
  locationOrder: 'index',
  autoStartDelayMs: -1,
  digTimeoutMs: 600000,
  logBlockDig: true,
  listType: 'blacklist',
  blocks: ['Stone'],
  idleDelayMs: 500,
  retryDelayMs: 1000,
  lookAtMaxDistance: 5
}

const autoFishConfig = {
  enabled: true,
  autoStartDelayMs: -1,
  startDelayMs: 3000,
  cycleDelayMs: 600,
  retryDelayMs: 2000,
  bobberDistance: 48
}

const antiAfkConfig = {
  enabled: false,
  intervalMs: 30000,
  radius: 0.1,
  reachTolerance: 0.03,
  maxTicks: 60,
  stepPauseMs: 100
}

const autoVerifyConfig = {
  enabled: true,
  debug: false,
  allowedActions: ['run_command', 'suggest_command'],
  requiredTextPatterns: [],
  matchTexts: ['.gogogogochecker=', '/verify', '/login', '/register'],
  dedupeWindowMs: 5000
}

const autoMineConfig = {
  enabled: false,
  autoStartDelayMs: -1,
  targetBlocks: ['diamond_ore', 'deepslate_diamond_ore'],
  searchRange: 100,
  searchCount: 64,
  retryDelayMs: 1200,
  idleDelayMs: 2000,
  collectDelayMs: 300,
  unsafeBlocks: ['lava', 'flowing_lava', 'fire'],
  navigation: {
    canDig: true,
    allow1by1towers: true,
    allowParkour: false
  }
}

const autoAttackConfig = {
  enabled: false,
  autoStartDelayMs: 0,
  mode: 'multi',
  priority: 'distance',
  cooldownTime: {
    custom: false,
    value: 1.0
  },
  interaction: 'attack',
  attackRange: 5.0,
  attackHostile: true,
  attackPassive: false,
  listMode: 'blacklist',
  entitiesList: ['Player'],
  scanIntervalMs: 100
}

module.exports = {
  antiAfkConfig,
  autoAttackConfig,
  autoDigConfig,
  autoFishConfig,
  autoMineConfig,
  autoVerifyConfig,
  protocolConfig,
  serverConfig,
  sieveConfig,
  spawnCommands,
  timingConfig
}
