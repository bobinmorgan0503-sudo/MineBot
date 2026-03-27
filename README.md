# MineBot

MineBot is a Mineflayer-based Minecraft bot project for repetitive server tasks.

Current built-in features:

- Auto fish
- Anti AFK
- Auto sieve
- Auto dig
- Multi-account startup scripts
- Runtime username / host / port overrides from command line

## Requirements

- Node.js 18+
- npm
- Windows `cmd` scripts are included for quick startup

## Install

```powershell
npm install
```

## Start

Use the default config:

```powershell
npm start
```

Pass username, host, and port from the command line:

```powershell
npm start -- Arthas azrxjh.cn 25568
```

Or use explicit flags:

```powershell
npm start -- --username Arthas --host azrxjh.cn --port 25568
```

You can also start directly with Node:

```powershell
node index.js Arthas azrxjh.cn 25568
```

## Windows Startup Scripts

General script:

- `start_bot.cmd <username> <host> <port>`

Examples:

```cmd
start_bot.cmd Arthas azrxjh.cn 25568
start_bot.cmd muck 127.0.0.1 25565
```

Fixed-account scripts:

- `start_Arthas.cmd`
- `start_muck.cmd`

These also support optional host and port arguments:

```cmd
start_Arthas.cmd azrxjh.cn 25568
start_muck.cmd 127.0.0.1 25565
```

## Local Commands

These commands are handled by MineBot locally:

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

Any other `/...` command is sent to the Minecraft server normally.

## Features

### Auto Fish

The auto fish module is implemented in [features/autoFish.js](/F:/Code/mineflyer/MineBot/features/autoFish.js).

Behavior:

- Equips a fishing rod from inventory automatically
- Uses Mineflayer's fishing cycle
- Reels in on stop when a nearby bobber is detected
- Supports optional delayed auto-start

Related config is in [config.js](/F:/Code/mineflyer/MineBot/config.js) under `autoFishConfig`.

### Anti AFK

The anti AFK module is implemented in [features/antiAfk.js](/F:/Code/mineflyer/MineBot/features/antiAfk.js).

Behavior:

- Periodically takes a tiny random step and returns
- Uses direct control states, not pathfinding
- Can be enabled by config or local command

Related config is in [config.js](/F:/Code/mineflyer/MineBot/config.js) under `antiAfkConfig`.

### Auto Verify

The auto verify module is implemented in [features/autoVerify.js](/F:/Code/mineflyer/MineBot/features/autoVerify.js).

Behavior:

- Scans chat components for clickable `run_command` or `suggest_command` actions
- Filters by visible verification text and command keywords
- Executes matching verification commands automatically
- Supports debug logging for raw click event inspection

Related config is in [config.js](/F:/Code/mineflyer/MineBot/config.js) under `autoVerifyConfig`.

### Auto Sieve

The sieve module is implemented in [features/sieve.js](/F:/Code/mineflyer/MineBot/features/sieve.js).

Behavior:

- Interacts with configured gravel container and target blocks
- Runs in a loop
- Current loop interval is `100ms`, which is about 2 ticks

Related config is in [config.js](/F:/Code/mineflyer/MineBot/config.js) under `sieveConfig`.

### Auto Dig

The auto dig module is implemented in [features/autoDig.js](/F:/Code/mineflyer/MineBot/features/autoDig.js).

Behavior:

- Manual start only
- Uses configured fixed positions
- Sends digging packets directly
- Does not use Mineflayer pathing or distance checks
- Iterates all configured dig positions each cycle

Related config is in [config.js](/F:/Code/mineflyer/MineBot/config.js) under `autoDigConfig`.

## Configuration

Main config file:

- [config.js](/F:/Code/mineflyer/auto_SieveOre/config.js)

Important sections:

- `serverConfig`: default host, port, version, username, auth
- `protocolConfig`: protocol workarounds for server packet compatibility
- `timingConfig`: delay between configured spawn commands
- `spawnCommands`: commands sent after spawn
- `autoFishConfig`: auto fishing behavior
- `antiAfkConfig`: anti idle movement behavior
- `autoVerifyConfig`: clickable chat verification behavior
- `sieveConfig`: auto sieve positions and timing
- `autoDigConfig`: auto dig behavior and target positions

## Project Structure

- [index.js](/F:/Code/mineflyer/MineBot/index.js): entry point, bot setup, CLI args, terminal commands
- [config.js](/F:/Code/mineflyer/MineBot/config.js): project configuration
- [features/autoFish.js](/F:/Code/mineflyer/MineBot/features/autoFish.js): auto fish feature module
- [features/antiAfk.js](/F:/Code/mineflyer/MineBot/features/antiAfk.js): anti AFK feature module
- [features/autoVerify.js](/F:/Code/mineflyer/MineBot/features/autoVerify.js): auto verify feature module
- [features/sieve.js](/F:/Code/mineflyer/MineBot/features/sieve.js): sieve feature module
- [features/autoDig.js](/F:/Code/mineflyer/MineBot/features/autoDig.js): auto dig feature module
- [start_bot.cmd](/F:/Code/mineflyer/MineBot/start_bot.cmd): generic Windows startup script
- [start_Arthas.cmd](/F:/Code/mineflyer/MineBot/start_Arthas.cmd): Arthas startup script
- [start_muck.cmd](/F:/Code/mineflyer/MineBot/start_muck.cmd): muck startup script

## Notes

- Chat is printed to the console by default.
- The bot can auto-send configured `spawnCommands` after spawn.
- If your server version changes, update `serverConfig.version` in [config.js](/F:/Code/mineflyer/MineBot/config.js).
