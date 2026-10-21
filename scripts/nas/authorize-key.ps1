[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
  [string]$SshConfigPath = (Join-Path $env:USERPROFILE '.ssh/config.txt'),
  [string]$KnownHostsPath = (Join-Path $env:USERPROFILE '.ssh/known_hosts'),
  [string]$PublicKeyPath = (Join-Path $env:USERPROFILE '.ssh/id_ed25519_nas.pub'),
  [string]$Alias = 'fnnas'
)

$ErrorActionPreference = 'Stop'
$expectedHost = '192.168.3.100'
$expectedUser = 'codex'
$expectedPort = '22'
$expectedIdentity = '~/.ssh/id_ed25519_nas'

function Get-SshConfigValue([string[]]$Lines, [string]$Name) {
  $match = $Lines | Where-Object { $_ -match "^$([regex]::Escape($Name))\s+" } | Select-Object -First 1
  if (-not $match) { return $null }
  return ($match -split '\s+', 2)[1].Trim()
}

$ssh = Get-Command ssh -ErrorAction Stop
$sshKeygen = Get-Command ssh-keygen -ErrorAction Stop
foreach ($file in @($SshConfigPath, $KnownHostsPath, $PublicKeyPath)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required local file is missing: $file" }
}

$pubRaw = Get-Content -LiteralPath $PublicKeyPath -Raw
$pubLine = $pubRaw.TrimEnd("`r", "`n")
if ($pubLine -match '[\r\n]' -or $pubLine -notmatch '^ssh-ed25519\s+[A-Za-z0-9+/]+={0,2}(?:\s+[^\r\n]*)?$') {
  throw 'The selected public-key file must contain exactly one valid ssh-ed25519 public-key line.'
}
$pubParts = $pubLine -split '\s+'
try { [void][Convert]::FromBase64String($pubParts[1]) } catch { throw 'The public-key payload is not valid base64.' }
$publicKeyType = $pubParts[0]
$publicKeyBlob = $pubParts[1]
$fingerprintOutput = @(& $sshKeygen.Source -lf $PublicKeyPath 2>$null)
if ($LASTEXITCODE -ne 0 -or $fingerprintOutput.Count -ne 1 -or $fingerprintOutput[0] -notmatch '\bSHA256:[A-Za-z0-9+/]+') {
  throw 'ssh-keygen could not verify the selected public key fingerprint.'
}
$fingerprint = $Matches[0]

$fixedSshOptions = @(
  '-F', $SshConfigPath,
  '-o', 'StrictHostKeyChecking=yes',
  '-o', 'IdentitiesOnly=yes',
  '-o', 'IdentityAgent=none',
  '-o', 'ForwardAgent=no',
  '-o', 'ProxyCommand=none',
  '-o', 'ProxyJump=none',
  '-o', ('HostKeyAlias=' + $expectedHost),
  '-o', 'CheckHostIP=yes',
  '-o', ('UserKnownHostsFile=' + $KnownHostsPath),
  '-o', 'GlobalKnownHostsFile=none'
)
$effectiveConfig = @(& $ssh.Source -G @fixedSshOptions $Alias 2>$null)
if ($LASTEXITCODE -ne 0) { throw 'OpenSSH could not resolve the configured NAS alias.' }
$resolvedHost = Get-SshConfigValue $effectiveConfig 'hostname'
$resolvedUser = Get-SshConfigValue $effectiveConfig 'user'
$resolvedPort = Get-SshConfigValue $effectiveConfig 'port'
$resolvedIdentities = @($effectiveConfig | Where-Object { $_ -match '^identityfile\s+' } | ForEach-Object { ($_ -split '\s+', 2)[1].Trim() })
$resolvedIdentity = if ($resolvedIdentities.Count -eq 1) { $resolvedIdentities[0] } else { $null }
$effectiveKnownHosts = Get-SshConfigValue $effectiveConfig 'userknownhostsfile'
if ($resolvedHost -ne $expectedHost -or $resolvedUser -ne $expectedUser -or $resolvedPort -ne $expectedPort -or $resolvedIdentity -ne $expectedIdentity -or
    (Get-SshConfigValue $effectiveConfig 'stricthostkeychecking') -notin @('yes', 'true') -or
    (Get-SshConfigValue $effectiveConfig 'identitiesonly') -ne 'yes' -or
    (Get-SshConfigValue $effectiveConfig 'identityagent') -ne 'none' -or
    (Get-SshConfigValue $effectiveConfig 'forwardagent') -ne 'no' -or
    (Get-SshConfigValue $effectiveConfig 'proxycommand') -notin @($null, 'none') -or
    (Get-SshConfigValue $effectiveConfig 'proxyjump') -notin @($null, 'none') -or
    (Get-SshConfigValue $effectiveConfig 'hostkeyalias') -ne $expectedHost -or
    (Get-SshConfigValue $effectiveConfig 'checkhostip') -ne 'yes' -or
    $effectiveKnownHosts -ne [IO.Path]::GetFullPath($KnownHostsPath)) {
  throw 'The fnnas alias or fixed SSH safeguards no longer match the reviewed host, user, port, key, and known_hosts file.'
}

$hostKeyEntries = @(& $sshKeygen.Source -F $expectedHost -f $KnownHostsPath 2>$null | Where-Object { $_ -and $_ -notmatch '^#' })
if ($LASTEXITCODE -ne 0 -or $hostKeyEntries.Count -eq 0) {
  throw 'No existing known_hosts entry matches the NAS hostname; refusing unknown-host-key access.'
}

$identityPath = Join-Path $env:USERPROFILE '.ssh/id_ed25519_nas'
if (-not (Test-Path -LiteralPath $identityPath -PathType Leaf)) { throw 'The configured private-key file is missing; no alternate key will be tried.' }
$encodedPublicKey = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pubLine))
$remoteScript = @'
set -eu
key_b64=${1-}
case "$key_b64" in
  ""|*[!A-Za-z0-9+/=]*) printf "%s\n" "invalid public-key input" >&2; exit 20 ;;
esac
key=$(printf "%s" "$key_b64" | base64 -d 2>/dev/null) || { printf "%s\n" "cannot decode public key" >&2; exit 21; }
case "$key" in
  ssh-ed25519\ *) ;;
  *) printf "%s\n" "unexpected public-key type" >&2; exit 22 ;;
esac
if [ "${#key}" -gt 4096 ]; then printf "%s\n" "public key exceeds limit" >&2; exit 23; fi
key_type=${key%% *}
key_blob=$(printf "%s" "$key" | awk '{print $2}')
if [ "$key_type" != "ssh-ed25519" ] || [ -z "$key_blob" ]; then printf "%s\n" "unexpected key identity" >&2; exit 29; fi
if [ -z "${HOME:-}" ]; then printf "%s\n" "remote home directory is unavailable" >&2; exit 24; fi
ssh_dir="$HOME/.ssh"
keys="$ssh_dir/authorized_keys"
if [ -L "$ssh_dir" ] || [ -L "$keys" ]; then printf "%s\n" "refusing symlinked SSH path" >&2; exit 25; fi
if [ -e "$ssh_dir" ] && [ ! -d "$ssh_dir" ]; then printf "%s\n" "SSH path is not a directory" >&2; exit 26; fi
if [ ! -d "$ssh_dir" ]; then (umask 077; mkdir "$ssh_dir"); fi
has_key_identity() {
  awk -v wanted_type="$key_type" -v wanted_blob="$key_blob" '{ for (i=1; i<NF; i++) if ($i == wanted_type && $(i+1) == wanted_blob) found=1 } END { exit !found }' "$keys"
}
if [ -e "$keys" ]; then
  if [ ! -f "$keys" ]; then printf "%s\n" "authorized_keys is not a regular file" >&2; exit 27; fi
  if has_key_identity; then printf "%s\n" "ALREADY_PRESENT"; exit 0; fi
  if [ -s "$keys" ]; then
    last_byte=$(tail -c 1 "$keys" | od -An -t x1 | tr -d ' \n')
    if [ "$last_byte" != "0a" ]; then printf "\n" >> "$keys"; fi
  fi
  printf "%s\n" "$key" >> "$keys"
else
  (umask 077; set -C; printf "%s\n" "$key" > "$keys")
fi
if has_key_identity; then printf "%s\n" "ADDED"; else printf "%s\n" "append verification failed" >&2; exit 28; fi
'@
# Use a quote-free command so Windows native argument passing cannot alter shell quotes.
$encodedRemoteScript = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript.Replace("`r`n", "`n")))
$remoteCommand = 'printf %s ' + $encodedRemoteScript + ' | base64 -d | sh -s -- ' + $encodedPublicKey

$preview = [pscustomobject]@{
  result = 'LOCAL_PREFLIGHT_OK_NO_NETWORK'
  alias = $Alias
  host = $resolvedHost
  user = $resolvedUser
  port = [int]$resolvedPort
  configuredIdentity = $resolvedIdentity
  effectiveKnownHosts = $effectiveKnownHosts
  safeguards = [ordered]@{ strictHostKeyChecking = 'yes'; identitiesOnly = 'yes'; identityAgent = 'none'; forwardAgent = 'no'; proxyCommand = 'none'; proxyJump = 'none' }
  publicKeyAlgorithm = $pubParts[0]
  publicKeyFingerprint = $fingerprint
  matchingKnownHostEntries = $hostKeyEntries.Count
  privateKeyContentRead = $false
  remoteCommand = 'Append only if the same key type and base64 identity is absent, including rows with restricted options; preserve existing rows and permissions.'
  whatIf = [bool]$WhatIfPreference
}
if ($WhatIfPreference) {
  $preview | ConvertTo-Json -Depth 3
  return
}

if (-not $PSCmdlet.ShouldProcess("$expectedUser@$expectedHost`:$expectedPort", 'Append the existing ssh-ed25519 public key to ~/.ssh/authorized_keys if absent')) {
  $preview | ConvertTo-Json -Depth 3
  return
}

& $ssh.Source @fixedSshOptions -o 'BatchMode=no' -o 'ConnectTimeout=10' $Alias $remoteCommand
if ($LASTEXITCODE -ne 0) { throw "SSH authorization helper failed with exit code $LASTEXITCODE; inspect the NAS manually before any retry." }
