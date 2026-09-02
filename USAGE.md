# MineBot 可执行版使用说明

## 1. 打包结果

在项目根目录执行：

```powershell
npm install
npm run package
```

将生成以下可直接分发的目录：

```text
dist/
  windows/                 # Windows x64
    MineBot.exe            # 随发布包携带的 Node.js 运行时
    config.js              # 可编辑配置；须与主程序放在同一目录
    start.cmd              # 可选启动器
    USAGE.md
  linux/                   # Linux x64（glibc）
    MineBot                # 随发布包携带的 Node.js 运行时
    config.js
    start.sh               # 可选启动器
    USAGE.md
```

`dist/windows` 或 `dist/linux` 整个目录就是对应平台的发布包：Node.js 运行时、项目代码和生产依赖均已附带。运行发布包不需要在目标机器安装 Node.js 或 npm，但请勿删除其中的 `node_modules`。

若只需某个平台，可使用 `npm run package:win` 或 `npm run package:linux`。打包机需要网络连接一次，以便打包器取得对应平台的 Node.js 运行时；之后分发和运行均不需要网络（但机器人连接 Minecraft 服务器仍需要网络）。

## 2. Windows 运行

1. 将 `dist/windows` 整个文件夹复制到目标 Windows x64 电脑。
2. 用文本编辑器修改同目录 `config.js` 中的 `serverConfig`，至少确认 `host`、`port`、`version`、`username` 与 `auth`。
3. 双击 `start.cmd`，或在该目录打开 PowerShell：

```powershell
.\start.cmd
```

带命令行参数启动（参数优先于 `config.js`）：

```powershell
.\start.cmd --username BotName --host example.com --port 25565 --version 1.21.11
```

也可使用位置参数：

```powershell
.\start.cmd BotName example.com 25565 1.21.11
```

## 3. Linux 运行

发布包面向 **Linux x64 / glibc**（Ubuntu、Debian、CentOS/RHEL 等常见发行版）。将 `dist/linux` 整个目录复制到服务器后：

```bash
cd linux
chmod +x MineBot start.sh
./start.sh
```

或通过启动器传递参数：

```bash
./start.sh --username BotName --host example.com --port 25565 --version 1.21.11
```

若出现 `Permission denied`，重新执行 `chmod +x MineBot start.sh`。Alpine Linux 使用 musl libc，不能直接使用此构建产物；请在 glibc 环境运行，或在 Alpine 环境中重新打包适配版本。

## 4. 配置与数据文件

`config.js` 是运行时配置，必须保留在可执行文件旁边。主程序启动时会在同目录创建 `config-backups/`，其中保存最近一次和带时间戳的配置备份；这两个目录都应具有写权限。

坐标配置沿用 `new Vec3(x, y, z)`，例如：

```js
gravelContainerPos: new Vec3(100, 64, -200)
```

敏感信息（例如 `/login` 命令中的密码）会保存在 `config.js`，请勿把该文件公开或提交到公共仓库。建议为每个机器人实例复制一份独立发布目录和配置文件。

## 5. 常用启动参数

| 参数 | 说明 |
| --- | --- |
| `--username`, `-u` | 机器人用户名 |
| `--host`, `-h` | Minecraft 服务器地址 |
| `--port`, `-p` | 服务器端口 |
| `--version`, `-v` | Minecraft 协议版本 |
| `--proxy-host` | SOCKS5 代理地址 |
| `--proxy-port` | SOCKS5 代理端口 |
| `--proxy-username` | SOCKS5 用户名（可选） |
| `--proxy-password` | SOCKS5 密码（可选） |

SOCKS5 示例：

```bash
./start.sh --username BotName --host example.com --port 25565 --version 1.21.11 --proxy-host 127.0.0.1 --proxy-port 1080
```

## 6. 本地控制台命令

程序运行后在控制台输入以下命令。这些命令只由本地 MineBot 处理，不会作为聊天消息发送给服务器：

```text
/goto <x> <y> <z>       /goto stop
/autodig start|stop
/automine start <方块名...>   /automine stop|status
/autofarm start [作物名...]   /autofarm stop|status
/autofish start|stop
/autoattack start|stop|status
/autoafk start|stop
/autosieve start|stop
/useblock [x,y,z]
/quit
```

其他输入会按普通聊天消息发到服务器。

## 7. 更新、排错与重新打包

- 更新程序：用新发布包替换旧发布目录，保留并检查旧的 `config.js`；新版本新增配置项时，以新模板为准合并。
- 配置报错：先检查 `config.js` 是否为有效 JavaScript，随后查看同目录 `config-backups/config.latest.js` 恢复最近可用内容。
- 无法连接：确认服务器地址、端口、协议版本、认证方式，以及防火墙/代理设置。
- Linux 启动失败：确认为 x64 glibc 系统，且可执行权限已设置。
- 打包后启动时报模块缺失：请记录完整错误并重新执行 `npm install` 后 `npm run package`；不要只复制二进制构建缓存。
