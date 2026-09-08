# setup.ps1 - Porcicultura Demo 1 / BioARA
# Copia archivos base de demo_bioara_v1 a porcicultura_demo_1
# Sin sobreescribir archivos especificos de Demo 1 ya creados.
# Ejecutar: cd PORCICULTURA ; .\porcicultura_demo_1\setup.ps1

$ErrorActionPreference = "Stop"

$SRC  = Join-Path $PSScriptRoot "..\demo_bioara_v1"
$DEST = $PSScriptRoot

Write-Host ""
Write-Host "=== Porcicultura Demo 1 - Setup ===" -ForegroundColor Cyan
Write-Host "Origen:  $SRC"
Write-Host "Destino: $DEST"
Write-Host ""

if (-not (Test-Path $SRC)) {
    Write-Error "No se encontro demo_bioara_v1 en: $SRC"
    exit 1
}

$items = @(
    "styles.css",
    "sw.js",
    "manifest.webmanifest",
    "app\main.js",
    "app\calc.js",
    "app\config.js",
    "app\csv.js",
    "app\db.js",
    "app\ui.js",
    "data",
    "logos",
    "assets"
)

$copied  = 0
$skipped = 0

foreach ($item in $items) {
    $srcPath  = Join-Path $SRC  $item
    $destPath = Join-Path $DEST $item

    if (-not (Test-Path $srcPath)) {
        Write-Host "  [SKIP-NOEXIST] $item" -ForegroundColor DarkGray
        continue
    }

    if (Test-Path $destPath) {
        Write-Host "  [SKIP-EXISTS]  $item" -ForegroundColor Yellow
        $skipped++
        continue
    }

    if (Test-Path $srcPath -PathType Container) {
        Copy-Item -Path $srcPath -Destination $destPath -Recurse -Force
        Write-Host "  [COPIED-DIR]   $item" -ForegroundColor Green
    } else {
        $parentDir = Split-Path $destPath -Parent
        if (-not (Test-Path $parentDir)) {
            New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        }
        Copy-Item -Path $srcPath -Destination $destPath -Force
        Write-Host "  [COPIED-FILE]  $item" -ForegroundColor Green
    }
    $copied++
}

Write-Host ""
Write-Host "Resultado: $copied copiado(s), $skipped omitido(s)." -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos pasos:"
Write-Host "  1. Completar DEMO_SHEETS_CONFIG en porcicultura_demo_1/index.html"
Write-Host "  2. Desplegar apps-script/Code.gs en script.google.com"
Write-Host "  3. Publicar: vercel --cwd ./porcicultura_demo_1"
Write-Host ""
Write-Host "Ver README_DEPLOY.md para instrucciones completas."