param(
    [Parameter(Mandatory = $true)][string]$Project,
    [Parameter(Mandatory = $true)][string]$OutputDir,
    [string]$EnvFile = '.env.app'
)

$ErrorActionPreference = 'Stop'
if ($Project -notmatch '^[a-z0-9][a-z0-9_-]*$') {
    throw 'Project must be a lowercase Docker Compose project name.'
}

$root = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $root 'compose.app.yml'
$envPath = (Resolve-Path -LiteralPath $EnvFile).Path
$outputPath = [IO.Path]::GetFullPath($OutputDir)
if (Test-Path -LiteralPath $outputPath) {
    throw "Backup destination already exists: $outputPath"
}

$composeArgs = @('compose', '--env-file', $envPath, '-p', $Project, '-f', $composeFile)
& docker @composeArgs config -q
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose configuration is invalid.' }

$databaseId = (& docker @composeArgs ps -q database | Out-String).Trim()
$apiId = (& docker @composeArgs ps -q api | Out-String).Trim()
if (-not $databaseId -or -not $apiId) {
    throw 'Database and API must be running before backup.'
}

New-Item -ItemType Directory -Path $outputPath | Out-Null
$uploadsPath = Join-Path $outputPath 'uploads'
New-Item -ItemType Directory -Path $uploadsPath | Out-Null
$dumpPath = "/tmp/appdb-backup-$([guid]::NewGuid().ToString('N')).dump"
$stopped = $false
try {
    $stopped = $true
    & docker @composeArgs stop web api
    if ($LASTEXITCODE -ne 0) { throw 'Could not stop web and API for a consistent backup.' }

    & docker exec $databaseId pg_dump -U app -d appdb -Fc -f $dumpPath
    if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed.' }
    & docker cp "${databaseId}:${dumpPath}" (Join-Path $outputPath 'database.dump')
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy database dump.' }
    & docker cp "${apiId}:/app/uploads/." $uploadsPath
    if ($LASTEXITCODE -ne 0) { throw 'Could not copy uploads.' }

    $files = @(Get-ChildItem -LiteralPath $uploadsPath -Recurse -File | ForEach-Object {
        [ordered]@{
            path = $_.FullName.Substring($uploadsPath.Length + 1).Replace('\', '/')
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    } | Sort-Object path)
    $manifest = [ordered]@{
        version = 1
        sourceProject = $Project
        createdAt = (Get-Date).ToUniversalTime().ToString('o')
        databaseSha256 = (Get-FileHash -LiteralPath (Join-Path $outputPath 'database.dump') -Algorithm SHA256).Hash.ToLowerInvariant()
        uploads = $files
    }
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $outputPath 'manifest.json') -Encoding utf8
    Write-Output "Backup created: $outputPath"
} finally {
    & docker exec $databaseId rm -f $dumpPath | Out-Null
    if ($stopped) {
        & docker @composeArgs start api web
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Backup finished, but API/web did not restart cleanly.' }
    }
}
