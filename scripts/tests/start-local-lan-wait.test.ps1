$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$launcher = Join-Path $repoRoot 'scripts/start-local-lan.ps1'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw ($parseErrors | Out-String) }
$definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-ForOwnedListener' }, $true)
if (-not $definition) { throw 'Wait-ForOwnedListener was not found in the launcher.' }
. ([scriptblock]::Create($definition.Extent.Text))

$node = (Get-Command node -ErrorAction Stop).Source
$testDir = Join-Path $repoRoot '.data/fiscal-qa/lan-wait-test'
New-Item -ItemType Directory -Force -Path $testDir | Out-Null
$serverScript = Join-Path $testDir 'loopback-server.mjs'
[System.IO.File]::WriteAllText($serverScript, "import { createServer } from 'node:net'; createServer().listen(Number(process.argv[2]), '127.0.0.1');`n")

function Get-FreeLoopbackPort {
  $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $probe.Start()
  try { return ([System.Net.IPEndPoint]$probe.LocalEndpoint).Port }
  finally { $probe.Stop() }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

# Delayed successful bind must be accepted only when the spawned process owns it.
$successPort = Get-FreeLoopbackPort
$server = Start-Process -FilePath $node -ArgumentList @($serverScript, [string]$successPort) -WindowStyle Hidden -PassThru
try {
  $found = @(Wait-ForOwnedListener $server $successPort @('127.0.0.1','::1') 5000)
  Assert-True ($found.Count -eq 1) 'Expected the child process listener to become ready.'
  Assert-True ($found[0].OwningProcess -eq $server.Id) 'Listener PID did not match the spawned child.'
  'delayed-owned-bind: PASS'
} finally {
  if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}

# An exited child must fail promptly instead of consuming the whole deadline.
$exiting = Start-Process -FilePath $node -ArgumentList @('-e', 'process.exit(7)') -WindowStyle Hidden -PassThru
$exitFailed = $false
try { [void]@(Wait-ForOwnedListener $exiting (Get-FreeLoopbackPort) @('127.0.0.1') 3000) }
catch { $exitFailed = $_.Exception.Message -match 'exited during startup' }
Assert-True $exitFailed 'An early-exited child was not reported.'
'early-exit: PASS'

# A live process with no listener must return empty at the finite deadline.
$idle = Start-Process -FilePath $node -ArgumentList @('-e', 'setTimeout(()=>{},10000)') -WindowStyle Hidden -PassThru
try {
  $timer = [System.Diagnostics.Stopwatch]::StartNew()
  $none = @(Wait-ForOwnedListener $idle (Get-FreeLoopbackPort) @('127.0.0.1') 500)
  $timer.Stop()
  Assert-True ($none.Count -eq 0) 'A child with no listener must time out.'
  Assert-True (-not $idle.HasExited) 'Timeout case child should remain alive during the wait.'
  Assert-True ($timer.ElapsedMilliseconds -ge 400 -and $timer.ElapsedMilliseconds -lt 2500) 'Wait did not honor its bounded deadline.'
  'bounded-timeout: PASS'
} finally {
  if (-not $idle.HasExited) { Stop-Process -Id $idle.Id -Force }
}
