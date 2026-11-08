Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$baseDir = "c:\Users\migue\Antigravity\SpotiLocal"
$apkSrc = "$baseDir\apk-build\android\app\build\outputs\apk\debug\app-debug.apk"
$apkDest = "$baseDir\SpotiPirata_v1.3.apk"

Copy-Item $apkSrc $apkDest -Force

$zip = [System.IO.Compression.ZipFile]::Open($apkDest, [System.IO.Compression.ZipArchiveMode]::Update)

$filesToUpdate = @(
    "index.html",
    "app.js",
    "db.js",
    "audio-engine.js",
    "id3-parser.js",
    "styles.css",
    "app-version.json",
    "manifest.json",
    "sw.js",
    "icon-192.png",
    "icon-512.png",
    "icon.svg"
)

foreach ($f in $filesToUpdate) {
    $entryName = "assets/public/$f"
    $existing = $zip.GetEntry($entryName)
    if ($existing) {
        $existing.Delete()
    }
    $localFile = "$baseDir\$f"
    if (Test-Path $localFile) {
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $localFile, $entryName) | Out-Null
        Write-Host "Updated: $entryName"
    }
}

$zip.Dispose()

Copy-Item $apkDest "$baseDir\SpotiPirata.apk" -Force
Write-Host "Successfully packaged SpotiPirata_v1.3.apk"
