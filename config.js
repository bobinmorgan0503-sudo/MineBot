const { Vec3 } = require('vec3')

const serverConfig = {
  host: 'azrxjh.cn',
  port: 25568,
  version: '1.21.11',
  username: 'Arthas',
  auth: 'offline'
}

const partialPacketWorkaround = {
  play: {
    toClient: {
      types: {
        // This server sends particle payloads that the current protocol stack
        // cannot decode reliably. We do not use particle data, so skip it.
        packet_world_particles: [
          'container',
          [
            {
              name: 'payload',
              type: 'restBuffer'
            }
          ]
        ]
      }
    }
  }
}

const protocolConfig = {
  customPackets: {
    '1.21': partialPacketWorkaround,
    '1.21.9': partialPacketWorkaround,
    '1.21.11': partialPacketWorkaround
  }
}

const timingConfig = {
  loginDelayMs: 2000,
  homeDelayMs: 2000
}

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

module.exports = {
  autoDigConfig,
  protocolConfig,
  serverConfig,
  sieveConfig,
  timingConfig
}
