[CmdletBinding()]
param(
  [string]$LanAddress,
  [switch]$PreflightOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$stateDir = Join-Path $repoRoot '.data/fiscal-qa/lan-web-20261013'
$statePath = Join-Path $stateDir 'runtime.json'
$databaseUrl = 'postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test'
$pgReady = Join-Path $repoRoot '.data/test-pg/pgsql/bin/pg_isready.exe'
$apiEntry = Join-Path $repoRoot 'apps/api/src/main.ts'
$webEntry = Join-Path $repoRoot 'apps/web/server.ts'
$webBuild = Join-Path $repoRoot 'apps/web/build/server/index.js'
$ports = @(3000, 3001)
$disabledFlags = @(
  'COLLECT_ENABLED', 'MODEL_CALLS_ENABLED', 'JINA_BODY_FALLBACK',
  'INDEXNOW_SUBMIT_ENABLED', 'FEISHU_CONTENT_PUSH_ENABLED',
  'FEISHU_INTERNAL_ENABLED', 'ALLOW_PRIVATE_NETWORK_FETCH', 'EMBEDDINGS_ENABLED'
)

function Get-SelectedLanAddress {
  $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
    Sort-Object RouteMetric, InterfaceMetric | Select-Object -First 1
  if (-not $route) { throw 'No default IPv4 route is available.' }
  $address = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop |
    Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if (-not $address) { throw 'The default-route interface has no preferred IPv4 address.' }
  return [pscustomobject]@{ Address = $address; InterfaceIndex = $route.InterfaceIndex }
}

function Test-Rfc1918Address([string]$Address) {
  $parsed = $null
  if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsed) -or $parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) { return $false }
  $bytes = $parsed.GetAddressBytes()
  return ($bytes[0] -eq 10) -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
}

function Test-PortFree([int]$Port) {
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  return $listeners.Count -eq 0
}

function Get-ExistingRuntimePids {
  if (-not (Test-Path -LiteralPath $statePath)) { return @() }
  try {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    return @($state.apiPid, $state.webPid | Where-Object { $_ })
  } catch {
    throw "Runtime state exists but cannot be read; inspect or move it manually: $statePath"
  }
}

$node = (Get-Command node -ErrorAction Stop).Source
$selected = Get-SelectedLanAddress
if ([string]::IsNullOrWhiteSpace($LanAddress)) { $LanAddress = $selected.Address }
if (-not (Test-Rfc1918Address $LanAddress)) { throw "LanAddress must be an RFC1918 IPv4 address: $LanAddress" }
$localAddress = @(Get-NetIPAddress -AddressFamily IPv4 -IPAddress $LanAddress -ErrorAction SilentlyContinue)
if ($localAddress.Count -eq 0) { throw "LanAddress is not assigned to this machine: $LanAddress" }
if ($LanAddress -ne $selected.Address) { throw "LanAddress must be the current default-route interface address ($($selected.Address)); refusing to widen the LAN scope." }

if (-not (Test-Path -LiteralPath $apiEntry)) { throw "API entry point is missing: $apiEntry" }
if (-not (Test-Path -LiteralPath $webEntry)) { throw "Web entry point is missing: $webEntry" }
if (-not (Test-Path -LiteralPath $webBuild)) { throw "Web build is missing; build @aihot/web before starting: $webBuild" }
if (-not (Test-Path -LiteralPath $pgReady)) { throw "PostgreSQL readiness tool is missing: $pgReady" }

$portStatus = foreach ($port in $ports) {
  [pscustomobject]@{ Port = $port; Free = (Test-PortFree $port) }
}
$runtimePids = @(Get-ExistingRuntimePids)
$liveRuntimePids = @($runtimePids | Where-Object { Get-Process -Id ([int]$_) -ErrorAction SilentlyContinue })
if ($liveRuntimePids.Count -gt 0) { throw "A local LAN preview process is already recorded (PID $($liveRuntimePids -join ', ')); stop it manually before retrying." }
if (@($portStatus | Where-Object { -not $_.Free }).Count -gt 0) {
  $occupiedPorts = ($portStatus | Where-Object { -not $_.Free } | ForEach-Object { $_.Port }) -join ', '
  throw "Port(s) already occupied: $occupiedPorts"
}

& $pgReady -h 127.0.0.1 -p 5432 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL is not ready on 127.0.0.1:5432; this launcher does not start PostgreSQL.' }

$preflight = [ordered]@{
  repo = $repoRoot
  lanUrl = "http://${LanAddress}:3000"
  lanAddress = $LanAddress
  interfaceAlias = (Get-NetIPAddress -AddressFamily IPv4 -IPAddress $LanAddress | Get-NetIPInterface -AddressFamily IPv4).InterfaceAlias
  webBind = '0.0.0.0:3000'
  apiBind = '127.0.0.1:3001'
  database = $databaseUrl
  postgres = 'ready on 127.0.0.1:5432'
  sideEffectFlags = 'false'
  devAuth = 'unset'
  worker = 'not launched'
  providerCredentials = 'scrubbed from child environment'
  ports = $portStatus
  preflightOnly = [bool]$PreflightOnly
}
if ($PreflightOnly) {
  $preflight | ConvertTo-Json -Depth 5
  exit 0
}

New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$apiStdout = Join-Path $stateDir 'api.stdout.log'
$apiStderr = Join-Path $stateDir 'api.stderr.log'
$webStdout = Join-Path $stateDir 'web.stdout.log'
$webStderr = Join-Path $stateDir 'web.stderr.log'
$originalEnvironment = [System.Environment]::GetEnvironmentVariables('Process')
$apiProcess = $null
$webProcess = $null

try {
  foreach ($key in @($originalEnvironment.Keys)) {
    $name = [string]$key
    if ($name -match '^(DEV_AUTH_|FEISHU_|(OPENAI|ANTHROPIC|DASHSCOPE|JINA|GOOGLE|GEMINI|AZURE|AWS|CLOUDFLARE|SENTRY)_|.*(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS_DIR|_BASE_URL|_ENDPOINT|_URL)$)' -or
        $name -in @('ADMIN_PASSWORD','ADMIN_EMAILS','ADMIN_FEISHU_UNION_IDS','AIHOT_CREDENTIALS_DIR','INDEXNOW_KEY','EGRESS_PROXY_URL','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','NODE_OPTIONS','NODE_PATH')) {
      [System.Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
  }

  $common = @{
    NODE_ENV = 'development'
    AIHOT_ENVIRONMENT = 'local-preview'
    DATABASE_URL = $databaseUrl
    SITE_URL = "http://${LanAddress}:3000"
    API_BASE_URL = 'http://127.0.0.1:3001'
    API_HOST = '127.0.0.1'
    API_PORT = '3001'
    LOCAL_PREVIEW_ENABLED = 'false'
    LOCAL_PREVIEW_LAN_ENABLED = 'false'
    COLLECT_ENABLED = 'false'
    MODEL_CALLS_ENABLED = 'false'
    JINA_BODY_FALLBACK = 'false'
    INDEXNOW_SUBMIT_ENABLED = 'false'
    FEISHU_CONTENT_PUSH_ENABLED = 'false'
    FEISHU_INTERNAL_ENABLED = 'false'
    ALLOW_PRIVATE_NETWORK_FETCH = 'false'
    EMBEDDINGS_ENABLED = 'false'
    TRUST_PROXY = 'false'
  }
  foreach ($entry in $common.GetEnumerator()) { [System.Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }

  $apiProcess = Start-Process -FilePath $node -ArgumentList @('apps/api/src/main.ts') -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $apiStdout -RedirectStandardError $apiStderr
  $state = [ordered]@{ startedAt = (Get-Date).ToString('o'); apiPid = $apiProcess.Id; webPid = $null; lanUrl = "http://${LanAddress}:3000"; apiBind = '127.0.0.1:3001'; webBind = '0.0.0.0:3000'; database = $databaseUrl }
  $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
  Start-Sleep -Seconds 2
  if ($apiProcess.HasExited) { throw "API exited during startup (code $($apiProcess.ExitCode)); see $apiStderr" }
  $apiListening = @(Get-NetTCPConnection -State Listen -LocalPort 3001 -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -in @('127.0.0.1','::1') })
  if ($apiListening.Count -eq 0) { throw "API did not bind loopback port 3001; inspect $apiStdout and $apiStderr before retrying." }

  $webEnvironment = @{
    LOCAL_PREVIEW_ENABLED = 'true'
    LOCAL_PREVIEW_LAN_ENABLED = 'true'
    DATABASE_URL = $databaseUrl
    SITE_URL = "http://${LanAddress}:3000"
    API_BASE_URL = 'http://127.0.0.1:3001'
    WEB_HOST = '0.0.0.0'
    WEB_PORT = '3000'
  }
  foreach ($entry in $webEnvironment.GetEnumerator()) { [System.Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
  $webProcess = Start-Process -FilePath $node -ArgumentList @('apps/web/server.ts') -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $webStdout -RedirectStandardError $webStderr
  $state.webPid = $webProcess.Id
  $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
  Start-Sleep -Seconds 2
  if ($webProcess.HasExited) { throw "Web exited during startup (code $($webProcess.ExitCode)); see $webStderr" }
  $webListening = @(Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -in @('0.0.0.0','::') })
  if ($webListening.Count -eq 0) { throw "Web did not bind 0.0.0.0:3000; inspect $webStdout and $webStderr before retrying." }

  [pscustomobject]@{
    started = $true
    lanUrl = "http://${LanAddress}:3000"
    apiPid = $apiProcess.Id
    webPid = $webProcess.Id
    state = $statePath
    logs = @($apiStdout, $apiStderr, $webStdout, $webStderr)
    note = 'Firewall is not changed by this script. Run the separately reviewed administrator command only if LAN clients cannot connect.'
  } | ConvertTo-Json -Depth 4
} catch {
  if ($apiProcess -and -not $apiProcess.HasExited) {
    $state = [ordered]@{ startedAt = (Get-Date).ToString('o'); apiPid = $apiProcess.Id; webPid = if ($webProcess) { $webProcess.Id } else { $null }; partialFailure = $_.Exception.Message; lanUrl = "http://${LanAddress}:3000"; database = $databaseUrl }
    $state | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
  }
  throw
} finally {
  $currentEnvironment = [System.Environment]::GetEnvironmentVariables('Process')
  foreach ($key in @($currentEnvironment.Keys)) {
    if (-not $originalEnvironment.Contains([string]$key)) { [System.Environment]::SetEnvironmentVariable([string]$key, $null, 'Process') }
  }
  foreach ($key in $originalEnvironment.Keys) { [System.Environment]::SetEnvironmentVariable([string]$key, [string]$originalEnvironment[$key], 'Process') }
}
