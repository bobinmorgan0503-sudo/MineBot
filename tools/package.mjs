import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const selectedPlatform = process.argv.includes('--platform')
  ? process.argv[process.argv.indexOf('--platform') + 1]
  : null
const platforms = selectedPlatform ? [selectedPlatform] : ['win', 'linux']
const nodeVersion = '22.16.0'
const settings = {
  win: {
    folder: 'windows',
    archive: `node-v${nodeVersion}-win-x64.zip`,
    url: `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-win-x64.zip`,
    extractedFolder: `node-v${nodeVersion}-win-x64`,
    nodePath: 'node.exe'
  },
  linux: {
    folder: 'linux',
    archive: `node-v${nodeVersion}-linux-x64.tar.xz`,
    url: `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-linux-x64.tar.xz`,
    extractedFolder: `node-v${nodeVersion}-linux-x64`,
    nodePath: 'bin/node'
  }
}

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

for (const platform of platforms) {
  const setting = settings[platform]
  if (!setting) throw new Error(`Unsupported platform: ${platform}. Use win or linux.`)

  const outputDir = join(projectRoot, 'dist', setting.folder)
  const cacheDir = join(projectRoot, 'dist', '.cache')
  const archivePath = join(cacheDir, setting.archive)
  const extractDir = join(cacheDir, setting.extractedFolder)

  if (existsSync(outputDir)) rmSync(outputDir, { recursive: true, force: true })
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(cacheDir, { recursive: true })

  for (const item of ['index.js', 'config.js', 'package.json', 'package-lock.json', 'USAGE.md', 'features']) {
    cpSync(join(projectRoot, item), join(outputDir, item), { recursive: true })
  }

  // 仅安装生产依赖；发布包不含打包工具和开发依赖。
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  run(process.execPath, [npmCli, 'ci', '--omit=dev', '--ignore-scripts'], { cwd: outputDir })

  if (!existsSync(archivePath)) {
    console.log(`Downloading Node.js ${nodeVersion} for ${platform}...`)
    const response = await fetch(setting.url)
    if (!response.ok || !response.body) throw new Error(`Download failed: ${response.status} ${setting.url}`)
    writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()))
  }

  if (platform === 'win') {
    if (existsSync(extractDir)) rmSync(extractDir, { recursive: true, force: true })
    run('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${cacheDir}' -Force`])
    renameSync(join(extractDir, setting.nodePath), join(outputDir, 'MineBot.exe'))
    rmSync(extractDir, { recursive: true, force: true })
  } else {
    // Windows 上解压完整 Linux 包会因 npm/npx/corepack 符号链接失败；发布包只需 node 二进制。
    const extractedNodePath = join(cacheDir, 'node')
    if (existsSync(extractedNodePath)) rmSync(extractedNodePath, { force: true })
    run('tar', ['-xJf', archivePath, '-C', cacheDir, '--strip-components=2', `${setting.extractedFolder}/bin/node`])
    renameSync(extractedNodePath, join(outputDir, 'MineBot'))
  }

  if (platform === 'win') {
    writeFileSync(join(outputDir, 'start.cmd'), '@echo off\r\ncd /d "%~dp0"\r\nMineBot.exe index.js %*\r\npause\r\n')
  } else {
    writeFileSync(join(outputDir, 'start.sh'), '#!/usr/bin/env sh\nset -eu\ncd "$(dirname "$0")"\nexec ./MineBot index.js "$@"\n')
  }

  console.log(`Created portable release: ${outputDir}`)
}
