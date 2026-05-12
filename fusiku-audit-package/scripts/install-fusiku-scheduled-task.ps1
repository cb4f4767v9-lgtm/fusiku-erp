#Requires -RunAsAdministrator
<#
  Registers "Fusiku ERP" scheduled task:
  - At user log on
  - Highest privileges (interactive user)
  - Restarts up to 3 times, 1 minute apart, if the task fails
  - Runs: cmd /c call "<repo>\start-fusiku-erp.bat" (no extra "start" — keeps Node under the task so failures are visible to the scheduler)

  "Run whether user is logged on or not" is not used: Node + Prisma + .env in the user profile need an interactive logon.
#>
param(
  [string] $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot.TrimEnd('\', '/'))
$bat = Join-Path $RepoRoot 'start-fusiku-erp.bat'
if (-not (Test-Path -LiteralPath $bat)) {
  Write-Error "start-fusiku-erp.bat not found: $bat"
  exit 1
}

$taskName = 'Fusiku ERP'
Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false

# Remove legacy Startup-folder shortcut if present (avoid double launch)
$lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'Fusiku ERP.lnk'
if (Test-Path -LiteralPath $lnk) {
  Remove-Item -LiteralPath $lnk -Force
  Write-Host "[Fusiku] Removed old Startup shortcut: $lnk"
}

$arg = "/c call `"$bat`""
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument $arg -WorkingDirectory $RepoRoot

$userId = if ($env:USERDOMAIN -and $env:USERDOMAIN -ne $env:COMPUTERNAME) {
  "$($env:USERDOMAIN)\$($env:USERNAME)"
} else {
  "$($env:COMPUTERNAME)\$($env:USERNAME)"
}

$trigger = New-ScheduledTaskTrigger -AtLogOn

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal `
  -UserId $userId `
  -LogonType InteractiveToken `
  -RunLevel Highest

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Write-Host "[Fusiku] Scheduled task registered: $taskName"
Write-Host "[Fusiku] Action: cmd.exe $arg"
Write-Host "[Fusiku] Start in: $RepoRoot"
Write-Host "[Fusiku] Log: $(Join-Path $RepoRoot 'logs\startup.log')"
Write-Host "[Fusiku] Test: schtasks /Run /TN `"$taskName`""
