const { Vec3 } = require('vec3')

// 服务器连接配置。
// 这些值可以被命令行参数覆盖，例如：
// `npm start -- --username Bot --host example.com --port 25565 --version 1.21.11`
const serverConfig = {
  // 服务器地址。
  // 可选值：任意有效域名或 IP 字符串，例如：
  // - 'example.com'
  // - '127.0.0.1'
  // - 'mc.hypixel.net'
  host: 'azrxjh.cn',

  // 服务器端口。
  // 可选值：1 到 65535 的整数，Minecraft 默认通常为 25565。
  port: 25568,

  // Minecraft 协议版本。
  // 可选值：当前 mineflayer / minecraft-protocol 支持的版本字符串，例如：
  // - '1.12.2'
  // - '1.20.4'
  // - '1.21.11'
  version: '1.21.11',

  // 机器人用户名。
  // 可选值：任意字符串；离线模式下就是进服显示名。
  username: 'Arthas',

  // 登录认证方式。
  // 可选值：
  // - 'offline'：离线登录，适合离线服或代理服
  // - 'microsoft'：微软正版登录
  // - 'mojang'：旧认证方式，通常已不推荐使用
  auth: 'offline'
}

// 异常粒子包兼容补丁。
// 某些服务器发出的粒子包与当前协议栈不完全兼容，会导致入服时报错或掉线。
// 这里将 `world_particles` 重定向到自定义的原始缓冲区类型，直接跳过解析。
// 一般不需要手动修改。
const partialPacketWorkaround = {
  play: {
    // 可选值：固定为 `play`，表示游戏阶段的数据包定义。
    toClient: {
      // 可选值：固定为 `toClient`，表示服务端 -> 客户端方向。
      types: {
        // 自定义类型名。
        // 可选值：任意未占用的协议类型名字符串；这里固定使用
        // `packet_partial_world_particles`。
        packet_partial_world_particles: [
          // 可选值：`'container'`，表示复合结构。
          'container',
          [
            {
              // 字段名。
              // 可选值：任意字符串；这里固定使用 `payload`。
              name: 'payload',

              // 字段类型。
              // 可选值：任意 protodef 类型名；这里固定使用 `restBuffer`，
              // 表示剩余原始字节全部吞掉。
              type: 'restBuffer'
            }
          ]
        ],

        // 重写顶层 packet 的 switch 映射，把 `world_particles`
        // 指向上面的自定义类型。
        // 一般不需要修改。
        packet: [
          'container',
          [
            {},
            {
              type: [
                'switch',
                {
                  fields: {
                    // 数据包名。
                    // 可选值：任意 packet 名称；这里固定重定向
                    // `world_particles`。
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

// 协议补丁配置。
const protocolConfig = {
  customPackets: {
    // 注意：minecraft-protocol 这里按 majorVersion 取值，而不是完整版本号。
    // 可选值：主版本字符串，例如：
    // - '1.12'
    // - '1.20'
    // - '1.21'
    // 值通常是某个补丁对象，例如 `partialPacketWorkaround`。
    '1.12': partialPacketWorkaround,
    '1.21': partialPacketWorkaround
  }
}

// 通用时间配置。
const timingConfig = {
  // 进服后自动执行命令之间的间隔。
  // 可选值：任意 >= 0 的毫秒整数。
  perCommandDelayMs: 2000
}

// 机器人成功进入服务器后自动发送的聊天命令。
// 可选值：字符串数组，每一项都是一条完整命令，例如：
// - '/login password'
// - '/register password password'
// - '/home home'
// - []
const spawnCommands = [
  '/login cui159478',
  '/home home'
]

// 自动筛矿配置。
const sieveConfig = {
  // 每轮筛矿循环的间隔。
  // 可选值：任意 > 0 的毫秒整数。
  tickDelayMs: 30,

  // 等待容器界面打开的超时时间。
  // 可选值：任意 > 0 的毫秒整数。
  containerOpenTimeoutMs: 3000,

  // 砂砾容器坐标。
  // 可选值：`new Vec3(x, y, z)`。
  gravelContainerPos: new Vec3(-52965, 193, -1043567),

  // 活板门坐标。
  // 可选值：`new Vec3(x, y, z)`。
  trapdoorPos: new Vec3(-52963, 193, -1043569),

  // 第一个栅栏坐标。
  // 可选值：`new Vec3(x, y, z)`。
  fencePos1: new Vec3(-52962, 194, -1043567),

  // 第二个栅栏坐标。
  // 可选值：`new Vec3(x, y, z)`。
  fencePos2: new Vec3(-52963, 194, -1043565),

  // 容器里要 shift-click 的砂砾槽位。
  // 可选值：任意 >= 0 的整数；通常从 0 开始。
  gravelSlot: 0,

  // `block_place` 交互方向。
  // 可选值：
  // - 0：down
  // - 1：up
  // - 2：north
  // - 3：south
  // - 4：west
  // - 5：east
  blockFaceDown: 0,

  // 点击方块时的光标位置。
  // 可选值：0.0 到 1.0 的数字；0.5 表示方块中心附近。
  interactCursor: 0.5
}

// Makeu 配置。
const makeuConfig = {
  // 每轮循环的间隔。
  // 可选值：任意 > 0 的毫秒整数。
  tickDelayMs: 50,

  // 等待容器界面打开的超时时间。
  // 可选值：任意 > 0 的毫秒整数。
  containerOpenTimeoutMs: 3000,

  // 砂砾容器坐标。
  // 可选值：`new Vec3(x, y, z)`。
  gravelContainerPos: new Vec3(-651776, 21, 122690),

  // 活板门坐标。
  // 可选值：`new Vec3(x, y, z)`。
  trapdoorPos: new Vec3(-651776, 22, 122694),

  // 每轮都要连续点击两次的栅栏坐标。
  // 可选值：`new Vec3(x, y, z)`。
  fencePos: new Vec3(-651776, 22, 122692),

  // 第一个栅栏坐标。
  // 可选值：`new Vec3(x, y, z)`。
  fencePos1: new Vec3(-651775, 22, 122693),

  // 第二个栅栏坐标。
  // 可选值：`new Vec3(x, y, z)`。
  fencePos2: new Vec3(-651779, 22, 122695),

  // 第三个栅栏坐标。
  // 可选值：`new Vec3(x, y, z)`。
  fencePos3: new Vec3(-651780, 22, 122693),

  // 第四个栅栏坐标。
  // 可选值：`new Vec3(x, y, z)`。
  fencePos4: new Vec3(-651779, 22, 122691),

  // 容器里要 shift-click 的砂砾槽位。
  // 可选值：任意 >= 0 的整数；通常从 0 开始。
  gravelSlot: 0,

  // `block_place` 交互方向。
  // 可选值：
  // - 0：down
  // - 1：up
  // - 2：north
  // - 3：south
  // - 4：west
  // - 5：east
  blockFaceDown: 0,

  // 点击方块时的光标位置。
  // 可选值：0.0 到 1.0 的数字；0.5 表示方块中心附近。
  interactCursor: 0.5
}

// 自动挖掘配置。
const autoDigConfig = {
  // 是否启用自动挖掘。
  // 可选值：true | false
  enabled: true,

  // 目标选择模式。
  // 可选值：
  // - 'fixedpos'：只挖 `locations` 列表里的坐标
  // - 'lookat'：只挖当前准星指向的方块
  // - 'both'：准星指向的方块必须也在 `locations` 里
  mode: 'fixedpos',

  // 固定挖掘坐标列表。
  // 可选值：`Vec3` 数组，例如：
  // - [new Vec3(1, 64, 1)]
  // - []
  locations: [
    new Vec3(-11887, 68, -2100),
    new Vec3(-11887, 68, -2101),
    new Vec3(-11887, 68, -2103),
    new Vec3(-11887, 68, -2104)
  ],

  // 固定坐标的处理顺序。
  // 可选值：
  // - 'index'：按 `locations` 顺序
  // - 'distance'：按离机器人距离排序
  locationOrder: 'index',

  // 自动启动延迟。
  // 可选值：
  // - -1：不自动启动
  // - 0：进服后立即启动
  // - > 0：延迟指定毫秒后启动
  autoStartDelayMs: -1,

  // 预留字段，当前逻辑未使用。
  // 可选值：任意 >= 0 的毫秒整数。
  digTimeoutMs: 600000,

  // 预留字段，当前逻辑未使用。
  // 可选值：true | false
  logBlockDig: true,

  // 方块名单模式。
  // 可选值：
  // - 'blacklist'：忽略 `blocks` 列表中的方块
  // - 'whitelist'：只挖 `blocks` 列表中的方块
  listType: 'blacklist',

  // 方块名称列表。
  // 可选值：字符串数组；匹配 `displayName` / `name`，忽略空格和大小写，例如：
  // - ['Stone']
  // - ['Cobblestone', 'Stone']
  // - []
  blocks: ['Stone'],

  // 空闲时的轮询间隔。
  // 可选值：任意 > 0 的毫秒整数。
  idleDelayMs: 500,

  // 出错后的重试间隔。
  // 可选值：任意 > 0 的毫秒整数。
  retryDelayMs: 1000,

  // `lookat` / `both` 模式下，准星检测的最大距离。
  // 可选值：任意 > 0 的数字，单位为格。
  lookAtMaxDistance: 5
}

// Nuker 配置。
const nukerConfig = {
  // 是否启用 nuker。
  // 可选值：true | false
  enabled: true,

  // 形状。
  // 当前仅实现：
  // - 'cube'：按前后左右上下范围构成立方体搜索区
  shape: 'cube',

  // 方块名单模式。
  // 可选值：
  // - 'blacklist'：忽略 `blocks` 列表中的方块
  // - 'whitelist'：只挖 `blocks` 列表中的方块
  listType: 'whitelist',

  // 方块名称列表。
  // 可选值：字符串数组；匹配 `displayName` / `name`，忽略空格和大小写。
  blocks: ['cobblestone'],

  // 向上的范围。
  up: 6,

  // 向下的范围。
  down: 2,

  // 左侧范围。
  left: 4,

  // 右侧范围。
  right: 4,

  // 面前范围。
  forward: 4,

  // 身后范围。
  back: 4,

  // 墙体范围预留值。
  wallsRange: 6,

  // 每轮最多挖多少个方块。
  maxBlocksPerTick: 5,

  // 排序方式。
  // 可选值：
  // - 'closest'：优先最近的方块
  // - 'index'：按搜索顺序处理
  sortMode: 'closest',

  // 是否使用协议包秒挖。
  packetMine: true,

  // 是否只挖当前工具适合的方块。
  onlySuitableTools: false,

  // 是否在挖掘前先尝试与目标方块交互。
  interact: false,

  // 是否在挖掘前转头看向目标方块。
  rotate: false,

  // 每轮挖掘后的延迟。
  delayMs: 0,

  // 没有目标时的空闲轮询间隔。
  idleDelayMs: 100,

  // 出错后的重试间隔。
  retryDelayMs: 1000
}

// 自动钓鱼配置。
const autoFishConfig = {
  // 是否启用自动钓鱼。
  // 可选值：true | false
  enabled: true,

  // 自动启动延迟。
  // 可选值：
  // - -1：不自动启动
  // - 0：进服后立即启动
  // - > 0：延迟指定毫秒后启动
  autoStartDelayMs: -1,

  // 启动后第一次抛竿前的等待时间。
  // 可选值：任意 >= 0 的毫秒整数。
  startDelayMs: 3000,

  // 每轮钓鱼完成后的间隔。
  // 可选值：任意 >= 0 的毫秒整数。
  cycleDelayMs: 600,

  // 失败后的重试间隔。
  // 可选值：任意 > 0 的毫秒整数。
  retryDelayMs: 2000,

  // 寻找浮漂的最大距离。
  // 可选值：任意 > 0 的数字，单位为格。
  bobberDistance: 48
}

// 自动丢弃配置。
const autoDropConfig = {
  // 是否启用自动丢弃。
  // 可选值：true | false
  enabled: true,

  // 自动启动延迟。
  // 可选值：
  // - -1：不自动启动
  // - 0：进服后立即启动
  // - > 0：延迟指定毫秒后启动
  autoStartDelayMs: -1,

  // 物品名单模式。
  // 可选值：
  // - 'blacklist'：保留 `items` 列表中的物品，丢弃其余物品
  // - 'whitelist'：只丢弃 `items` 列表中的物品
  listType: 'blacklist',

  // 物品规则列表。
  // 可选值：字符串数组；匹配 `item.name`，忽略大小写，并支持 `*` 通配符，例如：
  // - ['*_ore']
  // - ['stone', 'dirt']
  // - ['*_pickaxe', 'diamond']
  items: [
    '*_helmet',
    '*_chestplate',
    '*_leggings',
    '*_boots',
    '*_elytra',
    '*_sword',
    '*_pickaxe',
    '*_axe',
    '*_shovel',
    '*_hoe',
    'bow',
    'crossbow',
    'trident',
    'shield',
    'fishing_rod',
    'shears',
    'flint_and_steel',
    '*_ore',
    '*_ingot',
    '*_nugget',
    'coal',
    'charcoal',
    'diamond',
    'emerald',
    'lapis_lazuli',
    'redstone',
    'quartz',
    'amethyst_shard',
    'ancient_debris',
    'netherite_scrap',
    'netherite_ingot',
    'raw_iron',
    'raw_gold',
    'raw_copper'
  ],


  // 指定某些物品至少保留多少个。
  // 可选值：对象，键为 `item.name`，值为要保留的最小数量；只有超出的部分才会被丢弃，例如：
  // - { cobblestone: 64 }
  // - { cobblestone: 64, dirt: 64, netherrack: 64 }
  // - {}
  keepAtLeast: {
    cobblestone: 64,
    stone: 64,
    cobbled_deepslate: 64,
    dirt: 64,
    netherrack: 64
  },
  // 没有可丢弃物品时的轮询间隔。
  // 可选值：任意 > 0 的毫秒整数。
  idleDelayMs: 1000,

  // 每次丢弃一组物品后的等待时间。
  // 可选值：任意 >= 0 的毫秒整数。
  dropDelayMs: 300,

  // 被容器界面或异常阻塞时的重试间隔。
  // 可选值：任意 > 0 的毫秒整数。
  retryDelayMs: 1500
}

// 反挂机配置。
const antiAfkConfig = {
  // 是否启用反挂机。
  // 可选值：true | false
  enabled: false,

  // 两次反挂机动作之间的间隔。
  // 可选值：任意 > 0 的毫秒整数。
  intervalMs: 30000,

  // 小范围移动半径。
  // 可选值：任意 > 0 的数字，单位为格。
  radius: 0.1,

  // 判定已经走到目标点的容差。
  // 可选值：任意 >= 0 的数字，单位为格。
  reachTolerance: 0.03,

  // 单轮最多尝试移动的 tick 数。
  // 可选值：任意 > 0 的整数。
  maxTicks: 60,

  // 每一步移动之间的暂停时间。
  // 可选值：任意 >= 0 的毫秒整数。
  stepPauseMs: 100
}

// 自动死亡返回配置。
const autoBackConfig = {
  // 是否启用自动 back。
  // 可选值：true | false
  enabled: true,

  // 死亡后等待多久再点击重生。
  // 可选值：任意 >= 0 的毫秒整数。
  respawnDelayMs: 50,

  // 重生后等待多久再发送返回命令。
  // 可选值：任意 >= 0 的毫秒整数。
  backDelayMs: 100,

  // 重生后自动发送的命令。
  // 可选值：任意非空字符串，例如：
  // - '/back'
  // - '/home home'
  // - '/warp spawn'
  backCommand: '/back'
}

// 自动聊天验证配置。
const autoVerifyConfig = {
  // 是否启用自动验证。
  // 可选值：true | false
  enabled: true,

  // 是否输出调试日志。
  // 可选值：true | false
  debug: false,

  // 允许自动执行的 clickEvent.action 类型。
  // 可选值：字符串数组，常见值为：
  // - 'run_command'
  // - 'suggest_command'
  // 其他 clickEvent.action 也能填，但通常不会自动执行聊天以外的操作。
  allowedActions: ['run_command', 'suggest_command'],

  // 要求点击文本中必须包含的关键字。
  // 可选值：字符串数组；空数组表示不限制。
  requiredTextPatterns: [],

  // 命令值中必须命中的关键字。
  // 可选值：字符串数组；空数组表示任何命令都可。
  matchTexts: ['.gogogogochecker=', '/verify', '/login', '/register'],

  // 去重窗口时间，同一命令在窗口内只执行一次。
  // 可选值：任意 >= 0 的毫秒整数。
  dedupeWindowMs: 5000
}

// 自动挖矿配置。
const autoMineConfig = {
  // 是否启用自动挖矿。
  // 可选值：true | false
  enabled: false,

  // 自动启动延迟。
  // 可选值：
  // - -1：不自动启动
  // - 0：进服后立即启动
  // - > 0：延迟指定毫秒后启动
  autoStartDelayMs: -1,

  // 目标矿方块名列表。
  // 可选值：Minecraft 注册名数组，建议使用小写下划线格式，例如：
  // - ['diamond_ore']
  // - ['diamond_ore', 'deepslate_diamond_ore']
  targetBlocks: ['diamond_ore', 'deepslate_diamond_ore'],

  // 搜索半径。
  // 可选值：任意 > 0 的整数，单位为格。
  searchRange: 100,

  // 每次扫描最多返回多少个候选方块。
  // 可选值：任意 > 0 的整数。
  searchCount: 64,

  // 每轮尝试后的重试间隔。
  // 可选值：任意 > 0 的毫秒整数。
  retryDelayMs: 1200,

  // 没找到目标时的空闲等待时间。
  // 可选值：任意 > 0 的毫秒整数。
  idleDelayMs: 2000,

  // 挖掉方块后等待掉落物收集的时间。
  // 可选值：任意 >= 0 的毫秒整数。
  collectDelayMs: 300,

  // 危险方块名单。
  // 可选值：Minecraft 注册名数组，例如：
  // - ['lava', 'flowing_lava', 'fire']
  // - []
  unsafeBlocks: ['lava', 'flowing_lava', 'fire'],

  // 导航行为配置。
  navigation: {
    // 是否允许寻路过程中挖方块。
    // 可选值：true | false
    canDig: true,

    // 是否允许 1x1 垂直搭路 / 柱状上升。
    // 可选值：true | false
    allow1by1towers: false,

    // 是否允许跑酷跳跃。
    // 可选值：true | false
    allowParkour: false
  }
}

// 自动农场配置。成熟作物会按距离收获；可补种作物会优先补种。
const autoFarmConfig = {
  // 是否在进服后自动启动。
  enabled: false,
  // -1 表示不自动启动；0 表示立即启动。
  autoStartDelayMs: -1,
  // 要处理的作物方块名。支持 wheat、carrots、potatoes、beetroots、
  // nether_wart、cocoa、sweet_berry_bush、cave_vines、sugar_cane、
  // cactus、bamboo、kelp、melon、pumpkin。
  targetCrops: ['wheat', 'carrots', 'potatoes', 'beetroots', 'sugar_cane'],
  // 原地操作范围（格）和每轮最大候选数；AutoFarm 不会寻路或移动。
  searchRange: 6,
  searchCount: 128,
  // 一次搜索后最多连续处理多少个目标，避免每收获一格就重新扫描世界。
  maxActionsPerCycle: 10,
  // 收获后是否自动补种。缺少对应种子时只收获并记录提示。
  replant: false,
  // 操作前是否面向目标方块。
  faceTarget: false,
  // 是否发送主手挥动动画。faceTarget 与 swingHand 都关闭时，
  // 挖掘收获只发送开始和完成挖掘数据包。
  swingHand: false,
  // 纯挖掘数据包模式下，开始与完成数据包之间的延迟。普通作物可设为 0；
  // 西瓜和南瓜始终至少等待实际挖掘时间。
  packetDigDelayMs: 0,
  // 找不到作物时的等待时间、每次动作间隔，以及批次间隔（毫秒）。
  idleDelayMs: 1000,
  actionDelayMs: 0,
  cycleDelayMs: 100
}

// 自动攻击配置。
const autoAttackConfig = {
  // 是否启用自动攻击。
  // 可选值：true | false
  enabled: false,

  // 自动启动延迟。
  // 可选值：
  // - -1：不自动启动
  // - 0：进服后立即启动
  // - > 0：延迟指定毫秒后启动
  autoStartDelayMs: 0,

  // 攻击模式。
  // 可选值：
  // - 'single'：每轮只处理一个目标
  // - 'multi'：范围内多个目标都会尝试处理
  mode: 'multi',

  // multi 模式下每个攻击批次最多处理的目标数量。
  // 可选值：任意 >= 1 的整数。
  maxTargets: 10,

  // 单目标模式下的优先级。
  // 可选值：
  // - 'distance'：优先最近目标
  // - 'health'：优先低血量目标
  priority: 'distance',

  // 冷却配置。
  cooldownTime: {
    // 是否使用自定义冷却。
    // 可选值：
    // - true：使用下面的 `value`
    // - false：按实时攻速属性 / 物品属性修饰器自动计算
    custom: true,

    // 自定义冷却刻数。
    // 可选值：任意 >= 0 的数字，单位为刻（20 刻 = 1 秒）。
    // 只有 `custom: true` 时才会生效。
    value: 2
  },

  // 是否尝试按服务端实际 TPS 同步攻击冷却。服务端 TPS 低于 20 时会延长间隔。
  // 可选值：true | false
  tpsSync: true,

  // 与实体交互方式。
  // 可选值：
  // - 'attack'：攻击
  // - 'interact'：普通交互
  // - 'interactAt'：按实体位置交互
  interaction: 'attack',

  // 攻击半径。
  // 可选值：任意 >= 1.0 的数字；不再设置最大范围限制。
  attackRange: 6.0,

  // 攻击或交互前是否转向目标实体。
  // 可选值：true | false
  rotate: false,

  // 是否攻击敌对生物。
  // 可选值：true | false
  attackHostile: true,

  // 是否攻击被动生物。
  // 可选值：true | false
  attackPassive: true,

  // 实体列表模式。
  // 可选值：
  // - 'whitelist'：只处理 `entitiesList` 中的实体
  // - 'blacklist'：忽略 `entitiesList` 中的实体
  listMode: 'blacklist',

  // 实体名列表。
  // 可选值：字符串数组；可写 `name` / `displayName` / `username`，匹配时忽略大小写、
  // 空格、下划线和连字符，例如：
  // - ['Zombie']
  // - ['Cow', 'Villager']
  // - ['Player']
  // - []
  entitiesList: ['Player'],

  // 扫描附近实体的间隔。
  // 可选值：任意 >= 20 的毫秒整数；更小的值会被自动提升到内部默认值。
  scanIntervalMs: 20
}

module.exports = {
  antiAfkConfig,
  autoBackConfig,
  autoAttackConfig,
  autoDigConfig,
  autoDropConfig,
  autoFishConfig,
  nukerConfig,
  makeuConfig,
  autoMineConfig,
  autoFarmConfig,
  autoVerifyConfig,
  protocolConfig,
  serverConfig,
  sieveConfig,
  spawnCommands,
  timingConfig
}
