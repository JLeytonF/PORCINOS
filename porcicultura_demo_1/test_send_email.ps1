#!/usr/bin/env powershell
# Test script para verificar data flow del email con approvedProtocols

# URL del backend
$backendUrl = "http://localhost:3005"
$caseId = "test-case-$(Get-Date -Format 'yyyyMMddHHmmss')"

# Crear array de catálogo completo (45+ productos)
$protocolosCompletos = @()
for ($i = 1; $i -le 45; $i++) {
    $protocolosCompletos += @{
        id = "cat-$i"
        producto = "Catálogo Producto $i"
        dosis = "$i mg/kg"
    }
}

# Simular payload como lo enviaría el frontend
$testPayload = @{
    id = $caseId
    approvedProtocols = @(
        @{
            id = "prod-1"
            viaAprobada = "Oral"
            aprobado = $true
            producto = "Producto Aprobado 1"
            dosis = "10 mg/kg"
        },
        @{
            id = "prod-2"
            viaAprobada = "Inyectable"
            aprobado = $true
            producto = "Producto Aprobado 2"
            dosis = "5 mg/kg"
        }
    )
    protocolos = $protocolosCompletos
    emailCliente = "test@example.com"
    emailBioara = "bioara@example.com"
    financiero = @{
        roi = 35.5
        inversionTotal = 1000000
    }
    technicalApprovalRows = @(
        @{ aprobado = $true; viaAprobada = "Oral"; producto = "P1" }
        @{ aprobado = $true; viaAprobada = "Inyectable"; producto = "P2" }
    )
} | ConvertTo-Json -Depth 10

Write-Host "======================================"
Write-Host "TEST: Enviar email con approvedProtocols"
Write-Host "======================================"
Write-Host "Backend URL: $backendUrl"
Write-Host "Case ID: $caseId"
Write-Host ""
Write-Host "Payload Summary:"
Write-Host "  - approvedProtocols: 2 productos (ESPERADO en el email)"
Write-Host "  - protocolos: 45+ productos (CATÁLOGO COMPLETO - NO debe usarse)"
Write-Host ""
Write-Host "Enviando POST /api/porc/cases..."

try {
    $response = Invoke-WebRequest `
        -Uri "$backendUrl/api/porc/cases" `
        -Method POST `
        -ContentType "application/json" `
        -Body $testPayload `
        -ErrorAction Stop

    Write-Host "✅ Status: $($response.StatusCode)"
    Write-Host ""
    Write-Host "Response:"
    Write-Host $response.Content
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Response Status: $($_.Exception.Response.StatusCode)"
        Write-Host "Response Content: $($_.Exception.Response.Content)"
    }
}

Write-Host ""
Write-Host "======================================"
Write-Host "Revisa los logs del backend:"
Write-Host "  [resolveProtocolRows] debe mostrar:"
Write-Host "  ✅ Usando approvedProtocols (2 productos)"
Write-Host "  ❌ FALLBACK a protocolos COMPLETO (45+ productos)"
Write-Host "======================================"
