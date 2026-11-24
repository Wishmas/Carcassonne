param([switch]$Check)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

# Prefer a system Node.js, then the runtime already shipped with the Codex app.
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if ($nodeCommand) { $nodePath = $nodeCommand.Source } else {
    $runtimeRoot = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\runtimes\cua_node'
    $nodePath = Get-ChildItem -LiteralPath $runtimeRoot -Filter node.exe -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
}
if (-not $nodePath) { throw 'Install Node.js 22+ (https://nodejs.org), reopen PowerShell, and run npm install; npm run dev.' }
$env:Path = "$(Split-Path -Parent $nodePath);$env:Path"
$env:npm_config_cache = Join-Path $PSScriptRoot '.tools\npm-cache'
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npmCommand) { $npmLauncher = $npmCommand.Source; $npmPrefix = @() } else {
    $npmLauncher = $nodePath
    $npmPrefix = @((Join-Path $PSScriptRoot '.tools\package\bin\npm-cli.js'))
    if (-not (Test-Path -LiteralPath $npmPrefix[0])) {
        New-Item -ItemType Directory -Path '.tools' -Force | Out-Null
        & $nodePath -e "const fs=require('fs'),crypto=require('crypto');(async()=>{const r=await fetch('https://registry.npmjs.org/npm/11.11.0');if(!r.ok)throw Error('npm metadata');const m=await r.json();const t=await fetch(m.dist.tarball);if(!t.ok)throw Error('npm download');const b=Buffer.from(await t.arrayBuffer());if('sha512-'+crypto.createHash('sha512').update(b).digest('base64')!==m.dist.integrity)throw Error('Integrity mismatch');fs.writeFileSync('.tools/npm.tgz',b)})().catch(e=>{console.error(e);process.exitCode=1})"
        if ($LASTEXITCODE -ne 0) { throw 'Could not download npm.' }
        & "$env:SystemRoot\System32\tar.exe" -xzf '.tools/npm.tgz' -C '.tools'
        if ($LASTEXITCODE -ne 0) { throw 'Could not unpack npm.' }
    }
}
if (-not (Test-Path -LiteralPath 'node_modules\.package-lock.json')) {
    & $npmLauncher @npmPrefix install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
if ($Check) {
    & $npmLauncher @npmPrefix test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $npmLauncher @npmPrefix run build
} else {
    & $npmLauncher @npmPrefix run dev
}
exit $LASTEXITCODE
