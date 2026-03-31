# MineBot

MineBot 是一个基于 `mineflayer` 的 Minecraft 机器人项目，用来处理挂机、自动化操作和简单的导航/挖矿任务。

当前项目已经集成了以下能力：

- `/goto` 坐标导航
- 自动挖掘固定坐标方块
- 自动挖矿
- 自动钓鱼
- 反挂机
- 自动点击聊天验证
- 自动筛矿
- 支持通过命令行覆盖服务器和代理参数

## 环境要求

- Node.js 22 或更高版本
- npm
- Windows 下可直接使用仓库内的 `.cmd` 启动脚本

## 安装

```powershell
npm install
```

## 启动方式

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
npm start -- --username muck --host mc101.ytonidc.com --port 50305 --version 1.21.11 --proxy-host 49.232.133.49 --proxy-port 1080 --proxy-username minebot --proxy-password nCaLdWs0RiKEfBOfGhWG
```

也可以直接使用 Node 启动：

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

`start_muck.cmd` 当前默认连接：

- 服务器：`mc101.ytonidc.com:50305`
- 版本：`1.21.11`
- 代理：`49.232.133.49:1080`

## 本地命令

以下命令只在本地终端里由 MineBot 处理，不会直接作为聊天消息发送到服务器：

- `/goto <x> <y> <z>`
- `/goto stop`
- `/autodig start`
- `/autodig stop`
- `/automine start <block_name> [more_block_names...]`
- `/automine stop`
- `/automine status`
- `/autofish start`
- `/autofish stop`
- `/autoafk start`
- `/autoafk stop`
- `/autoverify start`
- `/autoverify stop`
- `/autoverify debug on`
- `/autoverify debug off`
- `/autosieve start`
- `/autosieve stop`
- `/useblock [x,y,z]`
- `/quit`

其他输入内容会按普通聊天消息发送到服务器。

## 功能说明

### `/goto`

实现文件：`features/goto.js`

功能：

- 使用 `mineflayer-pathfinder` 导航到指定坐标
- 支持 `/goto stop` 中断当前路径
- 使用共享导航配置

### 自动挖掘

实现文件：`features/autoDig.js`

功能：

- 按固定坐标列表轮询方块
- 直接发送挖掘协议包
- 支持黑名单/白名单过滤
- 不依赖 pathfinder

### 自动挖矿

实现文件：`features/autoMine.js`

功能：

- 在指定半径内搜索目标矿物
- 每轮只锁定一个目标，处理完成后再重新扫描
- 通过 pathfinder 走到目标矿附近
- 使用协议包方式执行挖掘

默认目标矿：

```js
targetBlocks: ['diamond_ore', 'deepslate_diamond_ore']
```

### 自动钓鱼

实现文件：`features/autoFish.js`

功能：

- 自动寻找并装备鱼竿
- 循环执行钓鱼
- 支持延迟自动启动

### 反挂机

实现文件：`features/antiAfk.js`

功能：

- 周期性做小范围移动
- 用于避免长时间挂机掉线

### 自动聊天验证

实现文件：`features/autoVerify.js`

功能：

- 监听聊天 JSON 中的 `clickEvent`
- 自动识别并执行验证相关命令
- 支持调试输出

默认匹配关键字：

```js
matchTexts: ['.gogogogochecker=', '/verify', '/login', '/register']
```

### 自动筛矿

实现文件：`features/sieve.js`

功能：

- 打开指定容器
- 按固定顺序点击方块
- 循环执行筛矿流程

## 配置说明

主配置文件：

- `config.js`

重要配置项：

- `serverConfig`：默认服务器地址、端口、版本、用户名、认证方式
- `protocolConfig`：1.21.x 协议兼容补丁
- `timingConfig`：进服后自动命令的发送间隔
- `spawnCommands`：进服后自动执行的命令
- `antiAfkConfig`
- `autoDigConfig`
- `autoFishConfig`
- `autoMineConfig`
- `autoVerifyConfig`
- `sieveConfig`

## 项目结构

- `index.js`：程序入口，负责连接、命令行参数解析、本地命令分发
- `config.js`：项目主配置
- `features/navigation.js`：共享导航配置
- `features/goto.js`：坐标导航
- `features/autoDig.js`：自动挖掘
- `features/autoMine.js`：自动挖矿
- `features/autoFish.js`：自动钓鱼
- `features/antiAfk.js`：反挂机
- `features/autoVerify.js`：自动聊天验证
- `features/sieve.js`：自动筛矿

## 说明

- 控制台默认会输出聊天消息
- 进服后自动执行的命令来自 `config.js` 里的 `spawnCommands`
- 如果服务器版本不同，可以通过命令行参数覆盖 `version`
- 如果需要代理，请通过 `--proxy-host`、`--proxy-port`、`--proxy-username`、`--proxy-password` 传入
