[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$LanAddress,
  [switch]$PreflightOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$statePath = Join-Path $repoRoot '.data/fiscal-qa/lan-web-20261013/runtime.json'
$startScript = Join-Path $PSScriptRoot 'start-local-lan.ps1'
$webBuild = Join-Path $repoRoot 'apps/web/build/server/index.js'
$expectedDatabase = 'postgres://postgres@127.0.0.1:5432/fiscalhot_preview_test'

function Get-Listeners([int]$Port) {
  return @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Assert-Rfc1918([string]$Address) {
  $parsed = $null
  if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsed) -or
      $parsed.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'LanAddress must be an RFC1918 IPv4 address.'
  }
  $octets = $parsed.GetAddressBytes()
  $private = ($octets[0] -eq 10) -or
    ($octets[0] -eq 172 -and $octets[1] -ge 16 -and $octets[1] -le 31) -or
    ($octets[0] -eq 192 -and $octets[1] -eq 168)
  if (-not $private) { throw 'LanAddress must be RFC1918.' }
}

function Get-CurrentDefaultRouteAddress {
  $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
    Sort-Object RouteMetric, InterfaceMetric | Select-Object -First 1
  if (-not $route) { throw 'No default IPv4 route is available.' }
  $address = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop |
    Where-Object { $_.AddressState -eq 'Preferred' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress
  if (-not $address) { throw 'The default-route interface has no preferred IPv4 address.' }
  return $address
}

function Get-VerifiedNodeProcess([int]$Id, [string]$EntryPoint) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $Id" -ErrorAction SilentlyContinue
  if (-not $process -or $process.Name -ne 'node.exe' -or [string]::IsNullOrWhiteSpace($process.CommandLine)) {
    throw "Cannot verify the recorded MYHOT node process PID $Id; refusing to stop it."
  }
  if ($process.ExecutablePath) {
    $expectedNode = (Get-Command node -ErrorAction Stop).Source
    if (-not [string]::Equals($process.ExecutablePath, $expectedNode, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Recorded PID $Id is not running the current node executable; refusing to stop it."
    }
  }
  $expectedEntry = [regex]::Escape((Join-Path $repoRoot $EntryPoint))
  if ($process.CommandLine -notmatch "(?i)$expectedEntry(?:\s|`"|$)") {
    throw "Recorded PID $Id does not match the expected MYHOT entry point; refusing to stop it."
  }
  return $process
}

Assert-Rfc1918 $LanAddress
$assignedAddress = @(Get-NetIPAddress -AddressFamily IPv4 -IPAddress $LanAddress -ErrorAction SilentlyContinue)
if ($assignedAddress.Count -eq 0 -or (Get-CurrentDefaultRouteAddress) -ne $LanAddress) {
  throw 'LanAddress must be the current default-route IPv4 address assigned to this machine.'
}
if (-not (Test-Path -LiteralPath $statePath)) { throw "No recorded MYHOT LAN runtime state: $statePath" }
if (-not (Test-Path -LiteralPath $startScript)) { throw "Existing guarded launcher is missing: $startScript" }
if (-not (Test-Path -LiteralPath $webBuild)) { throw "Built web server is missing: $webBuild" }

$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
if ($state.database -ne $expectedDatabase -or $state.apiBind -ne '127.0.0.1:3001' -or $state.webBind -ne '0.0.0.0:3000') {
  throw 'Recorded runtime is not the expected isolated MYHOT preview instance.'
}
if (-not $state.apiPid -or -not $state.webPid -or [int]$state.apiPid -eq [int]$state.webPid) {
  throw 'Recorded API/Web PID pair is incomplete or ambiguous.'
}
$apiPid = [int]$state.apiPid
$webPid = [int]$state.webPid
$apiListeners = Get-Listeners 3001
$webListeners = Get-Listeners 3000
$recordedRunning = @(
  Get-Process -Id $apiPid -ErrorAction SilentlyContinue
  Get-Process -Id $webPid -ErrorAction SilentlyContinue
).Count

if ($recordedRunning -eq 2) {
  $apiProcess = Get-VerifiedNodeProcess $apiPid 'apps/api/src/main.ts'
  $webProcess = Get-VerifiedNodeProcess $webPid 'apps/web/server.ts'
  if ($apiListeners.Count -ne 1 -or $apiListeners[0].OwningProcess -ne $apiPid -or $apiListeners[0].LocalAddress -notin @('127.0.0.1', '::1')) {
    throw 'API listener does not exactly match the recorded loopback MYHOT PID.'
  }
  if ($webListeners.Count -ne 1 -or $webListeners[0].OwningProcess -ne $webPid -or $webListeners[0].LocalAddress -notin @('0.0.0.0', '::')) {
    throw 'Web listener does not exactly match the recorded MYHOT PID.'
  }
  $processState = 'verified_recorded_api_and_web_running'
} elseif ($recordedRunning -eq 0 -and $apiListeners.Count -eq 0 -and $webListeners.Count -eq 0) {
  $apiProcess = $null
  $webProcess = $null
  $processState = 'recorded_processes_already_stopped_and_ports_free'
} else {
  throw 'Runtime PIDs and listeners are mixed or unowned; refusing to stop or replace any process.'
}

$preflight = [pscustomobject]@{
  result = 'LOCAL_LAN_REFRESH_PREFLIGHT_OK_NO_STOP_NO_BUILD_NO_START'
  repo = $repoRoot
  lanAddress = $LanAddress
  database = $expectedDatabase
  processState = $processState
  apiPid = $apiPid
  webPid = $webPid
  apiEntryVerified = [bool]$apiProcess
  webEntryVerified = [bool]$webProcess
  postgresTouched = $false
  firewallTouched = $false
  preflightOnly = [bool]$PreflightOnly
}
if ($PreflightOnly) {
  $preflight | ConvertTo-Json -Depth 4
  exit 0
}

if ($apiProcess) {
  Stop-Process -Id @($webPid, $apiPid) -ErrorAction Stop
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 250
    $remainingApi = Get-Process -Id $apiPid -ErrorAction SilentlyContinue
    $remainingWeb = Get-Process -Id $webPid -ErrorAction SilentlyContinue
  } while (($remainingApi -or $remainingWeb) -and [DateTime]::UtcNow -lt $deadline)
  if ((Get-Process -Id $apiPid -ErrorAction SilentlyContinue) -or (Get-Process -Id $webPid -ErrorAction SilentlyContinue)) {
    throw 'A verified MYHOT process did not exit cleanly; no force-kill was attempted.'
  }
}
if ((Get-Listeners 3000).Count -ne 0 -or (Get-Listeners 3001).Count -ne 0) {
  throw 'Ports 3000/3001 are still occupied after stopping only recorded MYHOT PIDs.'
}

Push-Location $repoRoot
try {
  & npm run build -w @aihot/web
  if ($LASTEXITCODE -ne 0) { throw "Web build failed with exit code $LASTEXITCODE; launcher was not called." }
} finally {
  Pop-Location
}

& $startScript -LanAddress $LanAddress
if ($LASTEXITCODE -ne 0) { throw "Guarded MYHOT LAN launcher failed with exit code $LASTEXITCODE." }
