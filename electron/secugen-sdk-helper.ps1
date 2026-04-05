param(
  [Parameter(Mandatory = $true)]
  [string]$Action
)

$ErrorActionPreference = "Stop"

function Read-Payload {
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return @{}
  }

  $convertFromJsonCommand = Get-Command ConvertFrom-Json -ErrorAction Stop
  $supportsDepth = $convertFromJsonCommand.Parameters.ContainsKey("Depth")

  if ($supportsDepth) {
    return $raw | ConvertFrom-Json -Depth 20
  }

  return $raw | ConvertFrom-Json
}

function Resolve-SecuGenSdk {
  $dllCandidates = @()

  if ($env:SECUGEN_SDK_DLL_PATH) {
    $dllCandidates += $env:SECUGEN_SDK_DLL_PATH
  }

  $dllCandidates += @(
    "C:\Program Files (x86)\SecuGen\SecuBSP SDK Pro\SecuBSP.NET\Bin\x64\SecuBSPMx.NET.dll",
    "C:\Program Files (x86)\SecuGen\SecuBSP SDK Pro\SecuBSP.NET\Bin\SecuBSPMx.NET.dll"
  )

  $dllPath = $dllCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $dllPath) {
    throw "Could not find SecuBSPMx.NET.dll. Install the SecuGen SDK or set SECUGEN_SDK_DLL_PATH."
  }

  $binCandidates = @()
  if ($env:SECUGEN_SDK_BIN_DIR) {
    $binCandidates += $env:SECUGEN_SDK_BIN_DIR
  }

  $dllDirectory = Split-Path -Parent $dllPath
  $binCandidates += @(
    $dllDirectory,
    "C:\Program Files (x86)\SecuGen\SecuBSP SDK Pro\Bin\x64",
    "C:\Program Files (x86)\SecuGen\SecuBSP SDK Pro\Bin"
  )

  $binDirectory = $binCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $binDirectory) {
    throw "Could not find the SecuGen SDK native bin directory."
  }

  return @{
    DllPath = $dllPath
    BinPath = $binDirectory
  }
}

function Load-SecuGenSdk {
  $sdkPaths = Resolve-SecuGenSdk
  $env:PATH = "$($sdkPaths.BinPath);$env:PATH"
  Add-Type -Path $sdkPaths.DllPath
  return $sdkPaths
}

function Convert-DeviceSerialToString {
  param([byte[]]$DeviceSerial)

  if (-not $DeviceSerial) {
    return ""
  }

  return ([System.Text.ASCIIEncoding]::new()).GetString($DeviceSerial).Trim([char]0).Trim()
}

function Get-SecuGenErrorMessage {
  param([int]$ErrorCode)

  switch ($ErrorCode) {
    0 { return "Success" }
    51 { return "No fingerprint image was captured. Place your finger on the scanner and try again." }
    52 { return "The fingerprint quality was too low. Clean the scanner and try again." }
    53 { return "The fingerprint template could not be created. Try scanning again." }
    54 { return "The fingerprint capture timed out. Try again." }
    default { return "SDK error $ErrorCode." }
  }
}

function Throw-SecuGenError {
  param(
    [string]$Operation,
    [int]$ErrorCode
  )

  if ($ErrorCode -eq 0) {
    return
  }

  throw "$Operation failed. $(Get-SecuGenErrorMessage -ErrorCode $ErrorCode)"
}

function Get-FirFormatName {
  param($Payload)

  $format = [string]$Payload.templateFormat
  if ([string]::IsNullOrWhiteSpace($format)) {
    return "STANDARDPRO"
  }

  switch ($format.Trim().ToUpperInvariant()) {
    "ANSI378" { return "ANSI378" }
    "ISO" { return "STANDARDPRO" }
    "STANDARD" { return "STANDARD" }
    "STANDARDPRO" { return "STANDARDPRO" }
    default { return "STANDARDPRO" }
  }
}

function Configure-CaptureOptions {
  param($Sdk, $Payload)

  $showImage = $true
  if ($null -ne $Payload.showImage) {
    $showImage = [bool]$Payload.showImage
  }

  $windowStyle = "POPUP"
  if ($Payload.windowStyle) {
    $candidate = [string]$Payload.windowStyle
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
      $windowStyle = $candidate.Trim().ToUpperInvariant()
    }
  }

  if ($windowStyle -ne "INVISIBLE") {
    $windowStyle = "POPUP"
  }

  $Sdk.CaptureWindowOption.WindowStyle = [int][SecuGen.SecuBSPPro.Windows.WindowStyle]::$windowStyle
  $Sdk.CaptureWindowOption.ShowFPImage = $showImage
  $Sdk.CaptureWindowOption.FingerWindow = [IntPtr]::Zero
  $Sdk.CaptureWindowOption.ParentWindow = [IntPtr]::Zero
  $Sdk.EnrollWindowOption.WelcomePage = $false

  if ($null -ne $Payload.welcomePage) {
    $Sdk.EnrollWindowOption.WelcomePage = [bool]$Payload.welcomePage
  }
}

function New-SecuGenSession {
  param($Payload)

  Load-SecuGenSdk | Out-Null

  $sdk = New-Object SecuGen.SecuBSPPro.Windows.SecuBSPMx
  $enumErr = $sdk.EnumerateDevice()
  Throw-SecuGenError -Operation "EnumerateDevice" -ErrorCode ([int]$enumErr)

  if ($sdk.DeviceNum -lt 1) {
    throw "No SecuGen fingerprint device detected."
  }

  $deviceId = [int16]$sdk.GetDeviceID(0)
  if ($null -ne $Payload.deviceId) {
    $deviceId = [int16]$Payload.deviceId
  }

  $sdk.DeviceID = $deviceId

  $openErr = $sdk.OpenDevice()
  Throw-SecuGenError -Operation "OpenDevice" -ErrorCode ([int]$openErr)

  $formatName = Get-FirFormatName -Payload $Payload
  $setFormatErr = $sdk.SetFIRFormat([SecuGen.SecuBSPPro.Windows.FIRFormat]::$formatName)
  Throw-SecuGenError -Operation "SetFIRFormat" -ErrorCode ([int]$setFormatErr)

  Configure-CaptureOptions -Sdk $sdk -Payload $Payload

  $deviceInfo = New-Object SecuGen.SecuBSPPro.Windows.DeviceInfo
  $deviceInfoErr = $sdk.GetDeviceInfo($deviceInfo)
  Throw-SecuGenError -Operation "GetDeviceInfo" -ErrorCode ([int]$deviceInfoErr)

  return @{
    Sdk = $sdk
    DeviceId = [int]$deviceId
    DeviceName = [string]($sdk.GetDeviceName($deviceId))
    DeviceInfo = $deviceInfo
    TemplateFormat = $formatName
  }
}

function Close-SecuGenSession {
  param($Session)

  if ($Session -and $Session.Sdk) {
    try {
      $Session.Sdk.CloseDevice() | Out-Null
    } catch {
    }
  }
}

function New-CaptureResponse {
  param(
    $Session,
    [string]$Mode
  )

  $templateText = [string]$Session.Sdk.FIRTextData
  if ([string]::IsNullOrWhiteSpace($templateText)) {
    throw "The SecuGen SDK did not return fingerprint template data."
  }

  $quality = $null
  try {
    $quality = [int]$Session.Sdk.FIRInfo.Quality
  } catch {
  }

  return @{
    mode = $Mode
    templateText = $templateText
    templateFormat = $Session.TemplateFormat
    imageQuality = $quality
    imageBase64 = ""
    deviceId = $Session.DeviceId
    deviceName = $Session.DeviceName
    deviceSerial = Convert-DeviceSerialToString -DeviceSerial $Session.DeviceInfo.DeviceSN
    imageWidth = [int]$Session.DeviceInfo.ImageWidth
    imageHeight = [int]$Session.DeviceInfo.ImageHeight
    imageDpi = [int]$Session.DeviceInfo.ImageDPI
  }
}

function Invoke-SecuGenEnroll {
  param($Payload)

  $session = $null
  try {
    $session = New-SecuGenSession -Payload $Payload
    $userId = ""
    if ($Payload.userId) {
      $userId = [string]$Payload.userId
    }

    $err = $session.Sdk.Enroll($userId)
    Throw-SecuGenError -Operation "Enroll" -ErrorCode ([int]$err)

    return New-CaptureResponse -Session $session -Mode "enroll"
  } finally {
    Close-SecuGenSession -Session $session
  }
}

function Invoke-SecuGenCapture {
  param($Payload)

  $session = $null
  try {
    $session = New-SecuGenSession -Payload $Payload
    $err = $session.Sdk.Capture([SecuGen.SecuBSPPro.Windows.FIRPurpose]::VERIFY)
    Throw-SecuGenError -Operation "Capture" -ErrorCode ([int]$err)

    return New-CaptureResponse -Session $session -Mode "capture"
  } finally {
    Close-SecuGenSession -Session $session
  }
}

function Invoke-SecuGenVerify {
  param($Payload)

  $templates = @($Payload.templates)
  if ($templates.Count -lt 1) {
    throw "No fingerprint templates were provided for verification."
  }

  $session = $null
  try {
    $session = New-SecuGenSession -Payload $Payload
    $captureErr = $session.Sdk.Capture([SecuGen.SecuBSPPro.Windows.FIRPurpose]::VERIFY)
    Throw-SecuGenError -Operation "Capture" -ErrorCode ([int]$captureErr)

    $capturedTemplateText = [string]$session.Sdk.FIRTextData
    if ([string]::IsNullOrWhiteSpace($capturedTemplateText)) {
      throw "Capture succeeded but no fingerprint template was returned."
    }

    foreach ($candidate in $templates) {
      $candidateTemplate = [string]$candidate.templateText
      if ([string]::IsNullOrWhiteSpace($candidateTemplate)) {
        continue
      }

      $matchErr = $session.Sdk.VerifyMatch($capturedTemplateText, $candidateTemplate)
      if ([int]$matchErr -ne 0) {
        continue
      }

      if ($session.Sdk.IsMatched) {
        return @{
          matched = $true
          matchedCandidate = $candidate
          capturedTemplateText = $capturedTemplateText
        }
      }
    }

    return @{
      matched = $false
      capturedTemplateText = $capturedTemplateText
    }
  } finally {
    Close-SecuGenSession -Session $session
  }
}

function Invoke-SecuGenProbe {
  param($Payload)

  $session = $null
  try {
    $session = New-SecuGenSession -Payload $Payload
    return @{
      connected = $true
      sdkVersion = [string]$session.Sdk.BSPVersion
      deviceId = $session.DeviceId
      deviceName = $session.DeviceName
      deviceSerial = Convert-DeviceSerialToString -DeviceSerial $session.DeviceInfo.DeviceSN
      imageWidth = [int]$session.DeviceInfo.ImageWidth
      imageHeight = [int]$session.DeviceInfo.ImageHeight
      imageDpi = [int]$session.DeviceInfo.ImageDPI
      templateFormat = $session.TemplateFormat
    }
  } finally {
    Close-SecuGenSession -Session $session
  }
}

try {
  $payload = Read-Payload

  switch ($Action.Trim().ToLowerInvariant()) {
    "probe" {
      $result = Invoke-SecuGenProbe -Payload $payload
      break
    }
    "enroll" {
      $result = Invoke-SecuGenEnroll -Payload $payload
      break
    }
    "capture" {
      $result = Invoke-SecuGenCapture -Payload $payload
      break
    }
    "verify" {
      $result = Invoke-SecuGenVerify -Payload $payload
      break
    }
    default {
      throw "Unsupported action '$Action'."
    }
  }

  $result | ConvertTo-Json -Compress -Depth 10
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
