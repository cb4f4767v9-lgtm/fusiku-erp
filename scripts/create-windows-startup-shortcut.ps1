param(
  [Parameter(Mandatory = $true)]
  [string] $RepoRoot
)

$RepoRoot = [System.IO.Path]::GetFullPath(($RepoRoot.TrimEnd('\', '/')))
$target = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot 'start-fusiku-erp.bat'))

if (-not (Test-Path -LiteralPath $target)) {
  Write-Error "start-fusiku-erp.bat not found: $target"
  exit 1
}

$startup = [Environment]::GetFolderPath('Startup')
$linkPath = Join-Path $startup 'Fusiku ERP.lnk'

$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($linkPath)
$sc.TargetPath = $target
$sc.WorkingDirectory = $RepoRoot
$sc.Arguments = ''
$sc.WindowStyle = 7
$sc.Description = 'Fusiku ERP — Express API + web UI (logs: logs\startup.log)'
$sc.Save()

Write-Host "[Fusiku] Startup shortcut: $linkPath"
Write-Host "[Fusiku] Target (full path): $target"
Write-Host "[Fusiku] Start in: $RepoRoot"
