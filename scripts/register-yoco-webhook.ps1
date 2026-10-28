$ErrorActionPreference = 'Stop'
$webhookUrl = 'https://brnshmmsyfitmotauaud.supabase.co/functions/v1/yoco-webhook'
Write-Host 'Register GymIQ payment notifications with Yoco.'
Write-Host 'Run this once, then save the returned webhook secret in Supabase.'
$secureKey = Read-Host 'Paste the same Yoco secret API key you saved in Supabase' -AsSecureString
$requestKey = [System.Net.NetworkCredential]::new('', $secureKey).Password
try {
    $payload = @{ name = 'GymIQ payment confirmation'; url = $webhookUrl } | ConvertTo-Json
    $webhook = Invoke-RestMethod -Method Post -Uri 'https://payments.yoco.com/api/webhooks' -ContentType 'application/json' -Headers @{ Authorization = "Bearer $requestKey" } -Body $payload
    if (-not $webhook.secret) { throw 'Yoco did not return a webhook secret. Check the response in your Yoco account.' }
    Write-Host ''
    Write-Host "Webhook registered in $($webhook.mode) mode."
    Write-Host 'Supabase secret name: YOCO_WEBHOOK_SECRET'
    Write-Host 'Supabase secret value (copy the entire value below):'
    Write-Host $webhook.secret
    Write-Host ''
    Write-Host 'Yoco displays this secret only once. Save it before closing this window.'
} finally {
    $requestKey = $null
    $secureKey.Dispose()
}
