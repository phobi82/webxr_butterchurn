param(
	[string]$OutputPfxPath = "$(Join-Path $PSScriptRoot 'local-dev-cert.pfx')",
	[string]$Password = "webxr-local"
)

$ErrorActionPreference = "Stop"
$resolvedOutputPfxPath = [System.IO.Path]::GetFullPath($OutputPfxPath)

$ipv4Addresses = @(
	Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
	Where-Object {
		$_.IPAddress -and
		$_.IPAddress -ne "127.0.0.1" -and
		$_.IPAddress -notlike "169.254.*"
	} |
	Select-Object -ExpandProperty IPAddress -Unique
)
if (-not $ipv4Addresses.Count) {
	$ipv4Addresses = @(
		Get-CimInstance Win32_NetworkAdapterConfiguration -ErrorAction SilentlyContinue |
		Where-Object { $_.IPEnabled } |
		ForEach-Object { $_.IPAddress } |
		Where-Object {
			$_ -and
			$_ -match '^\d+\.\d+\.\d+\.\d+$' -and
			$_ -ne "127.0.0.1" -and
			$_ -notlike "169.254.*"
		} |
		Select-Object -Unique
	)
}

$dnsNames = @("localhost")
if ($env:COMPUTERNAME) {
	$dnsNames += $env:COMPUTERNAME
}
$dnsNames = $dnsNames | Where-Object { $_ } | Select-Object -Unique

$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$hashAlgorithm = [System.Security.Cryptography.HashAlgorithmName]::SHA256
$padding = [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=localhost", $rsa, $hashAlgorithm, $padding)

$request.CertificateExtensions.Add(
	[System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $false)
)
$request.CertificateExtensions.Add(
	[System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
		[System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor
		[System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment,
		$false
	)
)

$eku = [System.Security.Cryptography.OidCollection]::new()
$null = $eku.Add([System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.1", "Server Authentication"))
$request.CertificateExtensions.Add(
	[System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($eku, $false)
)

$sanBuilder = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
foreach ($dnsName in $dnsNames) {
	$sanBuilder.AddDnsName($dnsName)
}
foreach ($ipv4Address in $ipv4Addresses) {
	$sanBuilder.AddIpAddress([System.Net.IPAddress]::Parse($ipv4Address))
}
$request.CertificateExtensions.Add($sanBuilder.Build($false))
$request.CertificateExtensions.Add(
	[System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($request.PublicKey, $false)
)

$notBefore = [System.DateTimeOffset]::Now.AddMinutes(-5)
$notAfter = $notBefore.AddYears(2)
$certificate = $request.CreateSelfSigned($notBefore, $notAfter)
$pfxBytes = $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $Password)
[System.IO.File]::WriteAllBytes($resolvedOutputPfxPath, $pfxBytes)

$certificate.Dispose()
$rsa.Dispose()

Write-Host ""
Write-Host "Generated local HTTPS certificate:"
Write-Host "  $resolvedOutputPfxPath"
Write-Host ""
Write-Host "Certificate names:"
foreach ($dnsName in $dnsNames) {
	Write-Host "  DNS: $dnsName"
}
foreach ($ipv4Address in $ipv4Addresses) {
	Write-Host "  IP : $ipv4Address"
}
Write-Host ""
Write-Host "PFX password:"
Write-Host "  $Password"
