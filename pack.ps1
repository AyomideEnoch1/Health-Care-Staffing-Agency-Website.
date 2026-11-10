$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$dist = Join-Path $root 'dist_temp'
$desktopZip = "C:\Users\Ayomide Enoch\Desktop\hostinger-frontend-update.zip"

if (Test-Path $dist) { Remove-Item -Path $dist -Recurse -Force }
if (Test-Path $desktopZip) { Remove-Item -Path $desktopZip -Force }

New-Item -ItemType Directory -Path (Join-Path $dist 'assets\images') -Force | Out-Null

# Copy root web assets (HTML, JS, CSS, config)
Get-ChildItem -Path (Join-Path $root 'frontend\src') -File | ForEach-Object {
    Copy-Item $_.FullName -Destination $dist
}

# Copy essential brand images & updated assets
$brandImages = @(
    'team_expertise.jpg',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'brand_emblem.png',
    'logo.png',
    'logo_icon.png',
    'default_avatar.svg'
)

foreach ($img in $brandImages) {
    $src = Join-Path $root "frontend\src\assets\images\$img"
    if (Test-Path $src) {
        Copy-Item $src -Destination (Join-Path $dist 'assets\images\') -Force
    }
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($dist, $desktopZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)

Remove-Item -Path $dist -Recurse -Force

$item = Get-Item $desktopZip
Write-Host "SUCCESS: Created $desktopZip ($($item.Length) bytes, $($item.LastWriteTime))"
