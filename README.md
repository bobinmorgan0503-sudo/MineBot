# MineBot

MineBot 是一个基于 `mineflayer` 的 Minecraft 机器人项目，用来处理重复性的挂机与自动化操作。

当前项目已经集成了以下功能：

- 自动钓鱼
- 反挂机
- 自动聊天点击验证
- 自动筛矿
- 自动挖掘
- 多账号启动脚本
- 运行时通过命令行覆盖账号、地址、端口、版本

## 环境要求

- Node.js 18 及以上
- npm
- Windows 下可直接使用仓库内置的 `.cmd` 启动脚本

## 安装

```powershell
npm install
```

## 启动方式

使用默认配置启动：

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

直接使用 Node 启动：

```powershell
node index.js MrBobin 180.141.249.246 25565 1.20.4
```

## Windows 启动脚本

通用脚本：

- `start_bot.cmd <username> <host> <port> <version>`

示例：

```cmd
start_bot.cmd MrBobin 180.141.249.246 25565 1.20.4
start_bot.cmd muck 127.0.0.1 25565 1.20.4
```

固定账号脚本：

- `start_Arthas.cmd [host] [port] [version]`
- `start_muck.cmd [host] [port] [version]`
- `start_MrBobin.cmd [host] [port] [version]`

这些脚本默认版本都是 `1.20.4`，如果不传版本会自动补上。

## 本地命令

以下命令只在当前终端内由 MineBot 本地处理，不会直接发到服务器：

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
- `/autodig start`
- `/autodig stop`
- `/quit`

其他输入内容会按普通聊天消息发送到服务器。

## 功能说明

### 自动登录与进服命令

进服后自动执行的命令由 [config.js](/F:/Code/mineflyer/MineBot/config.js) 里的 `spawnCommands` 控制。

当前配置为：

```js
const spawnCommands = [
  '/login qweasd123',
  '/home home'
]
```

MineBot 会在 `spawn` 之后按顺序执行这些命令，间隔时间由 `timingConfig.perCommandDelayMs` 控制。

### 自动钓鱼

实现文件： [features/autoFish.js](/F:/Code/mineflyer/MineBot/features/autoFish.js)

功能：

- 自动从背包寻找鱼竿并装备
- 调用 Mineflayer 的钓鱼循环
- 停止时尝试自动收杆
- 支持延迟自动启动

相关配置：`autoFishConfig`

### 反挂机

实现文件： [features/antiAfk.js](/F:/Code/mineflyer/MineBot/features/antiAfk.js)

功能：

- 周期性随机小范围移动
- 走出去再返回原地
- 不依赖寻路系统

相关配置：`antiAfkConfig`

### 自动聊天点击验证

实现文件： [features/autoVerify.js](/F:/Code/mineflyer/MineBot/features/autoVerify.js)

功能：

- 监听聊天消息中的 `clickEvent`
- 自动识别 `run_command` 与 `suggest_command`
- 自动执行验证相关命令
- 支持调试输出

当前默认会匹配以下验证命令前缀：

```js
matchTexts: ['.gogogogochecker=', '/verify', '/login', '/register']
```

相关配置：`autoVerifyConfig`

### 自动筛矿

实现文件： [features/sieve.js](/F:/Code/mineflyer/MineBot/features/sieve.js)

功能：

- 打开指定容器拿取材料
- 按固定顺序点击指定方块
- 按循环持续执行

相关配置：`sieveConfig`

### 自动挖掘

实现文件： [features/autoDig.js](/F:/Code/mineflyer/MineBot/features/autoDig.js)

功能：

- 按固定坐标列表轮询方块
- 直接发送挖掘协议包
- 支持黑名单 / 白名单模式
- 不依赖寻路

相关配置：`autoDigConfig`

## 配置说明

主配置文件：

- [config.js](/F:/Code/mineflyer/MineBot/config.js)

重要配置项：

- `serverConfig`：默认服务器地址、端口、版本、用户名、登录方式
- `protocolConfig`：协议兼容补丁
- `timingConfig`：进服后自动命令的发送间隔
- `spawnCommands`：进服后自动执行的命令列表
- `autoFishConfig`：自动钓鱼配置
- `antiAfkConfig`：反挂机配置
- `autoVerifyConfig`：自动聊天验证配置
- `sieveConfig`：自动筛矿配置
- `autoDigConfig`：自动挖掘配置

## 项目结构

- [index.js](/F:/Code/mineflyer/MineBot/index.js)：程序入口，负责连接、命令行参数解析、本地命令分发、聊天输出
- [config.js](/F:/Code/mineflyer/MineBot/config.js)：项目配置
- [features/autoFish.js](/F:/Code/mineflyer/MineBot/features/autoFish.js)：自动钓鱼模块
- [features/antiAfk.js](/F:/Code/mineflyer/MineBot/features/antiAfk.js)：反挂机模块
- [features/autoVerify.js](/F:/Code/mineflyer/MineBot/features/autoVerify.js)：自动聊天验证模块
- [features/sieve.js](/F:/Code/mineflyer/MineBot/features/sieve.js)：自动筛矿模块
- [features/autoDig.js](/F:/Code/mineflyer/MineBot/features/autoDig.js)：自动挖掘模块
- [start_bot.cmd](/F:/Code/mineflyer/MineBot/start_bot.cmd)：通用启动脚本
- [start_Arthas.cmd](/F:/Code/mineflyer/MineBot/start_Arthas.cmd)：Arthas 启动脚本
- [start_muck.cmd](/F:/Code/mineflyer/MineBot/start_muck.cmd)：muck 启动脚本
- [start_MrBobin.cmd](/F:/Code/mineflyer/MineBot/start_MrBobin.cmd)：MrBobin 启动脚本

## 说明

- 控制台默认会输出聊天信息。
- 如果服务器版本不同，可以通过命令行参数覆盖 `version`，也可以修改 [config.js](/F:/Code/mineflyer/MineBot/config.js) 中的 `serverConfig.version`。
- 如果需要查看聊天点击验证的原始信息，可以使用 `/autoverify debug on`。
