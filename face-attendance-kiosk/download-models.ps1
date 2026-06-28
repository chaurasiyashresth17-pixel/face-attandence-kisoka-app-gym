# download-models.ps1
# Downloads face-api.js model files required for the Face Attendance Kiosk.
# Run this script ONCE from the face-attendance-kiosk directory:
#   .\download-models.ps1

$modelsDir = Join-Path $PSScriptRoot "public\models"

Write-Host "Creating models directory at: $modelsDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

$files = @(
  "tiny_face_detector_model-shard1",
  "tiny_face_detector_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
  "face_recognition_model-weights_manifest.json"
)

$totalFiles = $files.Count
$i = 0

foreach ($file in $files) {
  $i++
  $url = "$baseUrl/$file"
  $dest = Join-Path $modelsDir $file
  Write-Host "[$i/$totalFiles] Downloading $file..." -ForegroundColor Yellow
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
    Write-Host "  OK: $file" -ForegroundColor Green
  } catch {
    Write-Host "  FAILED: $_" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Model download complete!" -ForegroundColor Green
Write-Host "Files saved to: $modelsDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run: npm run dev"
