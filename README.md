# MineBot

MineBot 是一个基于 `mineflayer` 的 Minecraft 机器人项目，用来处理挂机、自动化操作、导航、挖掘和战斗辅助。

当前项目包含这些模块：

- `/goto` 坐标导航
- 自动挖掘固定坐标方块
- 自动挖矿
- 自动钓鱼
- 自动攻击
- 自动死亡返回
- 反挂机
- 自动聊天验证
- 自动筛矿
- SOCKS5 代理启动

## 环境要求

- Node.js 22 或更高版本
- npm
- Windows 下可直接使用仓库内的 `.cmd` 启动脚本

## 安装

```powershell
npm install
```

## 启动

使用 `config.js` 中的默认配置启动：

```powershell
npm start
```

通过位置参数覆盖 `用户名 / 地址 / 端口 / 版本`：

```powershell
npm start -- MrBobin 180.141.249.246 25565 1.20.4
```

通过显式参数启动：

```powershell
npm start -- --username MrBobin --host 180.141.249.246 --port 25565 --version 1.20.4
```

带 SOCKS5 代理启动：

```powershell
npm start -- --username muck --host mc101.ytonidc.com --port 50305 --version 1.21.11 --proxy-host 49.232.133.49 --proxy-port 1080 --proxy-username minebot --proxy-password your_password
```

直接使用 Node 启动：

```powershell
node index.js MrBobin 180.141.249.246 25565 1.20.4
```

## Windows 启动脚本

通用脚本：

- `start_bot.cmd <username> <host> <port> <version>`

固定账号脚本：

- `start_Arthas.cmd [host] [port] [version]`
- `start_MrBobin.cmd [host] [port] [version]`
- `start_muck.cmd [host] [port] [version] [proxy_host] [proxy_port] [proxy_username] [proxy_password]`

`start_muck.cmd` 当前默认值：

- 服务器：`mc101.ytonidc.com:50305`
- 版本：`1.21.11`
- 代理：`49.232.133.49:1080`

## 本地命令

以下命令只在本地终端里由 MineBot 处理，不会直接作为聊天消息发到服务器：

- `/goto <x> <y> <z>`
- `/goto stop`
- `/autodig start`
- `/autodig stop`
- `/automine start <block_name> [more_block_names...]`
- `/automine stop`
- `/automine status`
- `/autofish start`
- `/autofish stop`
- `/autoattack start`
- `/autoattack stop`
- `/autoattack status`
- `/autoafk start`
- `/autoafk stop`
- `/autosieve start`
- `/autosieve stop`
- `/useblock [x,y,z]`
- `/quit`

以下功能不再提供本地开关命令，统一由 `config.js` 控制：

- 自动死亡返回 `autoBackConfig`
- 自动聊天验证 `autoVerifyConfig`

其他输入会按普通聊天消息发到服务器。

## 功能说明

### `/goto`

文件：`features/goto.js`

功能：

- 使用 `mineflayer-pathfinder` 导航到指定坐标
- 支持 `/goto stop` 中断当前路径

### 自动挖掘

文件：`features/autoDig.js`

功能：

- 按固定坐标列表轮询目标方块
- 直接发送挖掘协议包
- 支持黑名单/白名单过滤
- 不依赖 pathfinder

### 自动挖矿

文件：`features/autoMine.js`

功能：

- 在指定半径内搜索目标矿物
- 每轮只锁定一个目标，处理完成后再重新扫描
- 使用 pathfinder 走到目标矿附近
- 使用协议包方式执行挖掘

默认目标矿：

```js
targetBlocks: ['diamond_ore', 'deepslate_diamond_ore']
```

### 自动钓鱼

文件：`features/autoFish.js`

功能：

- 自动寻找并装备鱼竿
- 循环执行钓鱼
- 支持延迟自动启动

### 自动攻击

文件：`features/autoAttack.js`

功能：

- 支持 `single` / `multi` 两种目标模式
- 支持按距离或血量选目标
- 支持 `attack`、`interact`、`interactAt`
- 支持敌对/被动生物过滤
- 支持白名单/黑名单实体名过滤
- 支持自定义或自动计算攻击冷却

说明：

- 当前自动攻击运行时默认不输出普通攻击日志

### 自动死亡返回

文件：`features/autoBack.js`

功能：

- 死亡后自动请求重生
- 重生后自动发送返回命令

说明：

- 是否启用、重生延迟、返回延迟和返回命令都在 `autoBackConfig` 中配置
- 不再提供 `/autoback` 本地命令

### 反挂机

文件：`features/antiAfk.js`

功能：

- 周期性做小范围移动
- 用于避免长时间挂机掉线

### 自动聊天验证

文件：`features/autoVerify.js`

功能：

- 监听聊天 JSON 中的 `clickEvent`
- 自动识别并执行验证相关命令
- 支持调试模式

说明：

- 是否启用与调试输出由 `autoVerifyConfig.enabled` 和 `autoVerifyConfig.debug` 控制
- 不再提供 `/autoverify` 本地命令

默认命中关键字：

```js
matchTexts: ['.gogogogochecker=', '/verify', '/login', '/register']
```

### 自动筛矿

文件：`features/sieve.js`

功能：

- 打开指定容器
- 按固定顺序点击方块
- 循环执行筛矿流程

## 配置说明

主配置文件：

- `config.js`

主要配置项：

- `serverConfig`：服务器地址、端口、版本、用户名、认证方式
- `protocolConfig`：协议兼容补丁
- `timingConfig`：进服后自动命令发送间隔
- `spawnCommands`：进服后自动执行的命令列表
- `antiAfkConfig`
- `autoAttackConfig`
- `autoBackConfig`
- `autoDigConfig`
- `autoFishConfig`
- `autoMineConfig`
- `autoVerifyConfig`
- `sieveConfig`

## 项目结构

- `index.js`：程序入口，负责连接、命令行解析、本地命令分发
- `config.js`：项目主配置
- `features/navigation.js`：共享导航配置
- `features/goto.js`：坐标导航
- `features/autoDig.js`：自动挖掘
- `features/autoMine.js`：自动挖矿
- `features/autoFish.js`：自动钓鱼
- `features/autoAttack.js`：自动攻击
- `features/autoBack.js`：自动死亡返回
- `features/antiAfk.js`：反挂机
- `features/autoVerify.js`：自动聊天验证
- `features/sieve.js`：自动筛矿

## 补充说明

- 控制台默认会输出聊天消息
- 进服后自动执行的命令来自 `config.js` 里的 `spawnCommands`
- 如果服务器版本不同，可以通过命令行参数覆盖 `version`
- 如果需要代理，请通过 `--proxy-host`、`--proxy-port`、`--proxy-username`、`--proxy-password` 传入
