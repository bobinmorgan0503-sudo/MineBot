# MineBot

MineBot 是一个基于 `mineflayer` 的 Minecraft 机器人项目，用于挂机、自动化操作、导航、挖掘、战斗辅助和登录流程兼容。

## 功能概览

- 坐标导航：`/goto`
- 自动挖掘固定坐标方块
- 自动挖矿
- 自动钓鱼
- 自动攻击
- 自动死亡返回
- 反挂机
- 自动聊天验证
- 自动筛矿
- SOCKS5 代理连接
- 断线自动重连，并重新执行登录和进服命令
- Paper 1.21 Dialog 登录界面兼容，包括 KaLogin 登录框

## 环境要求

- Node.js 22 或更高版本
- npm
- Windows 下可以直接使用仓库内的 `.cmd` 启动脚本

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
npm start -- muck 4u4n.qiunaruto.top 25565 1.21.11
```

通过显式参数启动：

```powershell
npm start -- --username muck --host 4u4n.qiunaruto.top --port 25565 --version 1.21.11
```

使用 SOCKS5 代理启动：

```powershell
npm start -- --username muck --host 4u4n.qiunaruto.top --port 25565 --version 1.21.11 --proxy-host 127.0.0.1 --proxy-port 1080 --proxy-username minebot --proxy-password your_password
```

直接使用 Node 启动：

```powershell
node index.js muck 4u4n.qiunaruto.top 25565 1.21.11
```

## Windows 启动脚本

通用脚本：

- `start_bot.cmd <username> <host> <port> <version>`

固定账号脚本：

- `start_Arthas.cmd [host] [port] [version]`
- `start_MrBobin.cmd [host] [port] [version]`
- `start_muck.cmd [host] [port] [version]`
- `start_Bobot01.cmd [host] [port] [version]`

`start_muck.cmd` 和 `start_Bobot01.cmd` 当前默认连接参数一致：

- 服务器：`4u4n.qiunaruto.top:25565`
- 版本：`1.21.11`
- 用户名：分别为 `muck` 和 `Bobot01`

## 登录兼容

项目会自动处理常见登录流程：

- 聊天中的验证 clickEvent
- 服务器要求“单击左键以加入”时自动挥手进入
- Paper 1.21 `show_dialog` 登录窗口
- KaLogin 的 `loginpool:auth_login` 登录窗口

KaLogin 登录密码会从 `config.js` 的 `spawnCommands` 中提取，例如：

```js
const spawnCommands = [
  '/login cui159478',
  '/home home'
]
```

如果服务器已经提示自动登录成功，MineBot 会跳过后续重复的 `/login` 命令，只继续执行其他进服命令。

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
- `/autoattack start`
- `/autoattack stop`
- `/autoattack status`
- `/autoafk start`
- `/autoafk stop`
- `/autosieve start`
- `/autosieve stop`
- `/useblock [x,y,z]`
- `/quit`
- `/reconnect`（立即重连并重新登录，等待重试或尚未进服时也可使用）

其他输入会按普通聊天消息发送到服务器。

## 配置

主配置文件是 `config.js`，主要配置项包括：

- `serverConfig`：服务器地址、端口、版本、用户名、认证方式
- `autoReconnectConfig`：自动重连开关、重试间隔、退避倍率和连接超时
- `protocolConfig`：协议兼容补丁
- `timingConfig`：进服后自动命令发送间隔
- `spawnCommands`：进服后自动执行的命令列表，也用于提取 KaLogin 登录密码
- `antiAfkConfig`
- `autoAttackConfig`
- `autoBackConfig`
- `autoDigConfig`
- `autoFishConfig`
- `autoMineConfig`
- `autoFarmConfig`
- `autoVerifyConfig`
- `sieveConfig`

## 项目结构

- `index.js`：程序入口，负责连接、登录兼容、命令行解析和本地命令分发
- `config.js`：主配置
- `features/goto.js`：坐标导航
- `features/autoDig.js`：自动挖掘
- `features/autoMine.js`：自动挖矿
- `features/autoFarm.js`：自动收获与补种
- `features/autoFish.js`：自动钓鱼
- `features/autoAttack.js`：自动攻击
- `features/autoBack.js`：自动死亡返回
- `features/autoReconnect.js`：连接生命周期、断线重试与手动退出
- `features/antiAfk.js`：反挂机
- `features/autoVerify.js`：自动聊天验证
- `features/sieve.js`：自动筛矿

## 补充说明

自动重连默认启用。断线、被踢出、首次连接失败或进服超时后，MineBot 会使用原有服务器、账号和代理设置重新连接。默认首次等待 5 秒，连续失败时按 2 倍增加间隔，最多等待 60 秒；进入游戏后稳定在线 30 秒会重置失败计数。阅读公告后服务器要求重连时，至少等待 90 秒。

在本地终端输入 `/reconnect` 可立即断开当前连接并重新登录，也可跳过等待中的重试间隔。即使关闭自动重连，当前连接仍可手动重连。该命令使用进程启动时加载的连接和登录配置。

每次连接都会重新处理登录窗口、聊天验证和 `spawnCommands`，并按配置启动自动功能。手动启动的任务需在重连后重新启动。`/quit`、`/exit` 和 Ctrl+C 会取消待执行的重连并退出；将 `config.js` 中的 `autoReconnectConfig.enabled` 设为 `false` 可关闭自动重连。重连期间配置沿用进程启动时加载的值，修改配置后需要重启 MineBot。

- 控制台默认会输出聊天消息。
- 进服后自动执行的命令来自 `config.js` 里的 `spawnCommands`。
- 如果服务器版本不同，可以通过命令行参数覆盖 `version`。
- 如果需要代理，请通过 `--proxy-host`、`--proxy-port`、`--proxy-username`、`--proxy-password` 传入。
