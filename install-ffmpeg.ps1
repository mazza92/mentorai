# FFmpeg Installation Script for Windows
# This script downloads and installs FFmpeg for Windows

Write-Host "FFmpeg Windows Installation Script" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: Not running as Administrator. PATH changes will be for current user only." -ForegroundColor Yellow
    Write-Host ""
}

# Set installation directory
$installDir = "$env:USERPROFILE\ffmpeg"
$binDir = "$installDir\bin"

# Create installation directory
Write-Host "Creating installation directory: $installDir" -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

# Download FFmpeg
Write-Host ""
Write-Host "Downloading FFmpeg Windows build..." -ForegroundColor Green
Write-Host "This may take a few minutes..." -ForegroundColor Yellow

$ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$zipFile = "$env:TEMP\ffmpeg-essentials.zip"

try {
    # Download using Invoke-WebRequest
    Invoke-WebRequest -Uri $ffmpegUrl -OutFile $zipFile -UseBasicParsing
    
    Write-Host "Download complete!" -ForegroundColor Green
    Write-Host ""
    
    # Extract FFmpeg
    Write-Host "Extracting FFmpeg..." -ForegroundColor Green
    Expand-Archive -Path $zipFile -DestinationPath "$env:TEMP\ffmpeg-extract" -Force
    
    # Find the bin directory in the extracted files
    $extractedBin = Get-ChildItem -Path "$env:TEMP\ffmpeg-extract" -Recurse -Directory -Filter "bin" | Select-Object -First 1
    
    if ($extractedBin) {
        # Copy files to installation directory
        Copy-Item -Path "$($extractedBin.FullName)\*" -Destination $binDir -Recurse -Force
        Write-Host "FFmpeg extracted to: $binDir" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Could not find bin directory in extracted files" -ForegroundColor Red
        exit 1
    }
    
    # Clean up
    Remove-Item -Path $zipFile -Force -ErrorAction SilentlyContinue
    Remove-Item -Path "$env:TEMP\ffmpeg-extract" -Recurse -Force -ErrorAction SilentlyContinue
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to download FFmpeg automatically." -ForegroundColor Red
    Write-Host "Please download manually from: https://www.gyan.dev/ffmpeg/builds/" -ForegroundColor Yellow
    Write-Host "Or use: https://github.com/BtbN/FFmpeg-Builds/releases" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Add to PATH
Write-Host ""
Write-Host "Adding FFmpeg to PATH..." -ForegroundColor Green

$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$binDir", "User")
    Write-Host "Added $binDir to user PATH" -ForegroundColor Green
} else {
    Write-Host "FFmpeg is already in PATH" -ForegroundColor Yellow
}

# Verify installation
Write-Host ""
Write-Host "Verifying installation..." -ForegroundColor Green
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

try {
    $ffmpegVersion = & "$binDir\ffmpeg.exe" -version 2>&1 | Select-Object -First 1
    if ($ffmpegVersion -like "*ffmpeg version*") {
        Write-Host ""
        Write-Host "SUCCESS! FFmpeg is installed!" -ForegroundColor Green
        Write-Host $ffmpegVersion -ForegroundColor Cyan
        Write-Host ""
        Write-Host "NOTE: You may need to restart your terminal or IDE for PATH changes to take effect." -ForegroundColor Yellow
        Write-Host "After restarting, verify with: ffmpeg -version" -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: FFmpeg files are installed but may not be working correctly." -ForegroundColor Yellow
    }
} catch {
    Write-Host "WARNING: Could not verify FFmpeg installation. Please restart your terminal and run: ffmpeg -version" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green

