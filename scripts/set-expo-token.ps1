# Saves your Expo access token as the EXPO_TOKEN secret in the SurfPlace repo.
# The token is typed here and sent straight to GitHub; it is not stored on this PC.
$gh = 'C:\Program Files\GitHub CLI\gh.exe'
$secure = Read-Host 'Paste your Expo access token (it will not show) and press Enter' -AsSecureString
$token = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if (-not $token) { Write-Host 'No token entered, nothing saved.'; exit 1 }
$token | & $gh secret set EXPO_TOKEN --repo theprojectmaker/surfplace-ios
if ($LASTEXITCODE -eq 0) { Write-Host 'Saved to theprojectmaker/surfplace-ios' } else { Write-Host 'FAILED' }
$token = $null
