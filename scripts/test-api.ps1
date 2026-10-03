param(
  [string]$BaseUrl = "http://127.0.0.1:3000"
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd("/")

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [int]$ExpectedStatus,
    [hashtable]$Headers = @{},
    [object]$Body
  )

  $request = @{
    Method = $Method
    Uri = "$BaseUrl$Path"
    Headers = $Headers
    TimeoutSec = 20
    UseBasicParsing = $true
  }
  if ($PSBoundParameters.ContainsKey("Body")) {
    $request.ContentType = "application/json"
    $request.Body = $Body | ConvertTo-Json -Depth 10
  }

  try {
    $response = Invoke-WebRequest @request
    $statusCode = [int]$response.StatusCode
    $content = $response.Content
  }
  catch {
    $webResponse = $_.Exception.Response
    if (-not $webResponse) {
      throw "Request $Method $Path failed before receiving an HTTP response: $($_.Exception.Message)"
    }
    $statusCode = [int]$webResponse.StatusCode
    $reader = [System.IO.StreamReader]::new($webResponse.GetResponseStream())
    try {
      $content = $reader.ReadToEnd()
    }
    finally {
      $reader.Dispose()
    }
  }

  if ($statusCode -ne $ExpectedStatus) {
    throw "$Method $Path returned HTTP $statusCode; expected $ExpectedStatus. Response: $content"
  }

  $data = $null
  if ($content) {
    $data = $content | ConvertFrom-Json
  }
  return $data
}

function Assert-Equal {
  param(
    [object]$Actual,
    [object]$Expected,
    [string]$Description
  )
  if ($Actual -ne $Expected) {
    throw "$Description; expected '$Expected', got '$Actual'."
  }
  Write-Host "PASS: $Description"
}

$health = Invoke-Api -Method "GET" -Path "/api/health" -ExpectedStatus 200
Assert-Equal $health.status "ok" "API health check"
Assert-Equal $health.database "connected" "Database connection"

$suffix = [guid]::NewGuid().ToString("N")
$email = "api-smoke-$suffix@example.test"
$password = "Smoke-$suffix-Aa1!"
$registration = Invoke-Api -Method "POST" -Path "/api/auth/register" -ExpectedStatus 201 -Body @{
  username = "api-smoke-$suffix"
  email = $email
  password = $password
}
if (-not $registration.token) {
  throw "Registration response did not include a JWT."
}
Assert-Equal ([bool]($registration.user.PSObject.Properties.Name -contains "password")) $false "Registration does not expose password"

$login = Invoke-Api -Method "POST" -Path "/api/auth/login" -ExpectedStatus 200 -Body @{
  email = $email
  password = $password
}
if (-not $login.token) {
  throw "Login response did not include a JWT."
}
$authorizationScheme = "Be" + "arer"
$headers = @{ Authorization = "$authorizationScheme $($login.token)" }

$show = Invoke-Api -Method "POST" -Path "/api/shows" -ExpectedStatus 201 -Body @{
  title = "API smoke test $suffix"
  hall = "Smoke test hall"
  showTime = (Get-Date).AddHours(1).ToUniversalTime().ToString("o")
}
if (-not $show.id) {
  throw "Create-show response did not include a show ID."
}

$seats = Invoke-Api -Method "POST" -Path "/api/shows/$($show.id)/seats" -ExpectedStatus 201 -Body @{
  seats = @(
    @{ seatNumber = "A1"; section = "Smoke test"; price = 1 },
    @{ seatNumber = "A2"; section = "Smoke test"; price = 1 }
  )
}
Assert-Equal $seats.Count 2 "Create two seats"

$unauthenticatedResponse = Invoke-Api -Method "POST" -Path "/api/reservations" -ExpectedStatus 401 -Body @{
  showId = $show.id
  seatIds = @($seats[0].id)
}

$held = Invoke-Api -Method "POST" -Path "/api/reservations" -ExpectedStatus 201 -Headers $headers -Body @{
  showId = $show.id
  seatIds = @($seats[0].id)
}
Assert-Equal $held.reservation.status "HELD" "Create an authenticated seat hold"

$duplicateHold = Invoke-Api -Method "POST" -Path "/api/reservations" -ExpectedStatus 409 -Headers $headers -Body @{
  showId = $show.id
  seatIds = @($seats[0].id)
}

$confirmed = Invoke-Api -Method "POST" -Path "/api/reservations/$($held.reservation.id)/confirm" -ExpectedStatus 200 -Headers $headers
Assert-Equal $confirmed.reservation.status "CONFIRMED" "Confirm a held reservation"

$confirmedSeatConflict = Invoke-Api -Method "POST" -Path "/api/reservations" -ExpectedStatus 409 -Headers $headers -Body @{
  showId = $show.id
  seatIds = @($seats[0].id)
}

$secondHold = Invoke-Api -Method "POST" -Path "/api/reservations" -ExpectedStatus 201 -Headers $headers -Body @{
  showId = $show.id
  seatIds = @($seats[1].id)
}
$cancelled = Invoke-Api -Method "POST" -Path "/api/reservations/$($secondHold.reservation.id)/cancel" -ExpectedStatus 200 -Headers $headers
Assert-Equal $cancelled.reservation.status "CANCELLED" "Cancel a held reservation"

Write-Host ""
Write-Host "API smoke test passed."
Write-Host "Test user: $email"
Write-Host "Test show: $($show.id)"
Write-Host "The test user, show, seats, and reservations remain in the database."
