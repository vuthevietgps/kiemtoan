param(
    [Parameter(Mandatory = $true)][string]$Project,
    [Parameter(Mandatory = $true)][string]$BackupDir,
    [string]$EnvFile = '.env.app'
)

$ErrorActionPreference = 'Stop'
if ($Project -notmatch '^[a-z0-9][a-z0-9_-]*$') {
    throw 'Project must be a lowercase Docker Compose project name.'
}

$root = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $root 'compose.app.yml'
$envPath = (Resolve-Path -LiteralPath $EnvFile).Path
$backupPath = (Resolve-Path -LiteralPath $BackupDir).Path
$manifestPath = Join-Path $backupPath 'manifest.json'
$dumpFile = Join-Path $backupPath 'database.dump'
$uploadsPath = Join-Path $backupPath 'uploads'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $dumpFile -PathType Leaf) -or
    -not (Test-Path -LiteralPath $uploadsPath -PathType Container)) {
    throw 'Backup is missing manifest.json, database.dump, or uploads directory.'
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.version -ne 1 -or $manifest.sourceProject -eq $Project) {
    throw 'Unsupported backup or restore target matches the source project.'
}
$actualDumpHash = (Get-FileHash -LiteralPath $dumpFile -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualDumpHash -ne $manifest.databaseSha256) { throw 'Database checksum mismatch.' }

$actualFiles = @(Get-ChildItem -LiteralPath $uploadsPath -Recurse -File | ForEach-Object {
    '{0}:{1}' -f $_.FullName.Substring($uploadsPath.Length + 1).Replace('\', '/'),
        (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
} | Sort-Object)
$expectedFiles = @($manifest.uploads | ForEach-Object { '{0}:{1}' -f $_.path, $_.sha256 } | Sort-Object)
if (($actualFiles -join "`n") -ne ($expectedFiles -join "`n")) {
    throw 'Upload file checksum mismatch.'
}

$existingContainers = @(& docker ps -a --filter "label=com.docker.compose.project=$Project" --format '{{.ID}}')
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker containers.' }
$existingVolumes = @(& docker volume ls --filter "label=com.docker.compose.project=$Project" --format '{{.Name}}')
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker volumes.' }
$existingNetworks = @(& docker network ls --filter "label=com.docker.compose.project=$Project" --format '{{.ID}}')
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker networks.' }
if ($existingContainers.Count -gt 0 -or $existingVolumes.Count -gt 0 -or $existingNetworks.Count -gt 0) {
    throw 'Restore target already has Docker resources. Use a new project name.'
}

$composeArgs = @('compose', '--env-file', $envPath, '-p', $Project, '-f', $composeFile)
& docker @composeArgs config -q
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid.' }

& docker @composeArgs up -d --wait --wait-timeout 60 database
if ($LASTEXITCODE -ne 0) { throw 'Could not start restore database.' }
$databaseId = (& docker @composeArgs ps -q database | Out-String).Trim()
$restoreDump = "/tmp/appdb-restore-$([guid]::NewGuid().ToString('N')).dump"
try {
    & docker cp $dumpFile "${databaseId}:${restoreDump}"
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy database dump into container.' }
    & docker exec $databaseId pg_restore -U app -d appdb --no-owner --no-privileges $restoreDump
    if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed.' }
} finally {
    & docker exec $databaseId rm -f $restoreDump | Out-Null
}

& docker @composeArgs up -d --build --no-deps api
if ($LASTEXITCODE -ne 0) { throw 'Could not start restored API.' }
$apiId = (& docker @composeArgs ps -q api | Out-String).Trim()
& docker cp "${uploadsPath}/." "${apiId}:/app/uploads/"
if ($LASTEXITCODE -ne 0) { throw 'Could not copy uploads into restored API.' }
& docker exec -u root $apiId chown -R node:node /app/uploads
if ($LASTEXITCODE -ne 0) { throw 'Could not set upload ownership.' }
& docker @composeArgs up -d --build web
if ($LASTEXITCODE -ne 0) { throw 'Could not start restored web.' }
Write-Output "Restore completed in project: $Project"
