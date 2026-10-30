#!/usr/bin/env powershell
# Test script for complete flow: create case -> render PDF -> send email
# Verifies that approvedProtocols (2 items) is used instead of protocolos (45 items)

param(
    [string]$BackendUrl = "http://localhost:3005",
    [string]$TestMode = "full"
)

$ErrorActionPreference = "Stop"
$global:testResults = @{
    passedTests = 0
    failedTests = 0
    logs = @()
}

function Test-Result {
    param([string]$name, [bool]$condition, [string]$message)
    
    if ($condition) {
        Write-Host "[PASS] $name" -ForegroundColor Green
        $global:testResults.passedTests++
    } else {
        Write-Host "[FAIL] $name" -ForegroundColor Red
        Write-Host "   Details: $message" -ForegroundColor Yellow
        $global:testResults.failedTests++
    }
}

function Log-Test {
    param([string]$message)
    $global:testResults.logs += $message
    Write-Host $message -ForegroundColor Cyan
}

# --- CREATE TEST PAYLOAD ---
Log-Test "==================================================="
Log-Test "STEP 1: Create Test Case with approvedProtocols"
Log-Test "==================================================="

$caseId = "e2e-test-$(Get-Date -Format 'yyyyMMddHHmmss')"

# Create 45 catalog items (full protocolos)
$catalogProtocols = @()
for ($i = 1; $i -le 45; $i++) {
    $catalogProtocols += @{
        id = "cat-$i"
        producto = "Catálogo Producto $i"
        dosis = "$i mg/kg"
        via = "Oral"
    }
}

# Create 2 approved items (what should be in email)
$approvedProtocols = @(
    @{
        id = "prod-1"
        producto = "Producto Aprobado 1"
        viaAprobada = "Oral"
        dosisAprobada = "10 mg/kg"
        aprobado = $true
    },
    @{
        id = "prod-2"
        producto = "Producto Aprobado 2"
        viaAprobada = "Inyectable"
        dosisAprobada = "5 mg/kg"
        aprobado = $true
    }
)

# Build payload matching what frontend sends
$testPayload = @{
    id = $caseId
    cliente = "Test Client $caseId"
    granja = "Test Granja"
    fase = "LEVANTE"
    viaPreferida = "Agua"
    desafio = "Coccidiosis"
    consumoAlimentoRealKgDia = 50
    emailCliente = "client@test.com"
    emailBioara = "bioara@test.com"
    
    # THIS IS THE KEY: approvedProtocols should be used (2 items)
    approvedProtocols = $approvedProtocols
    
    # protocolos is full catalog (45 items) - should NOT be used in email
    protocolos = $catalogProtocols
    
    financiero = @{
        inversionTotal = 1000000
        roi = 35.5
    }
    
    technicalApprovalRows = $approvedProtocols
}

Log-Test "Payload created:"
Log-Test "  - approvedProtocols: $($approvedProtocols.Count) items"
Log-Test "  - protocolos: $($catalogProtocols.Count) items"

$payloadJson = $testPayload | ConvertTo-Json -Depth 10

# --- POST CREATE CASE ---
Log-Test ""
Log-Test "────────────────────────────────────────────────────────────"
Log-Test "Sending: POST $BackendUrl/api/cases"
Log-Test "────────────────────────────────────────────────────────────"

try {
    $createResp = Invoke-WebRequest `
        -Uri "$BackendUrl/api/cases" `
        -Method POST `
        -ContentType "application/json" `
        -Body $payloadJson `
        -UseBasicParsing `
        -TimeoutSec 10 `
        -ErrorAction Stop

    Log-Test ""
    $caseResult = $createResp.Content | ConvertFrom-Json
    
    Test-Result "Case created successfully" ($createResp.StatusCode -eq 201) `
        "Status: $($createResp.StatusCode)"
    
    if ($caseResult.ok -and $caseResult.case.id) {
        $createdCaseId = $caseResult.case.id
        Log-Test "[OK] Case ID: $createdCaseId"
        
        # --- RENDER PDF ---
        Log-Test ""
        Log-Test "------------------------------------------"
        Log-Test "STEP 2: Render PDF"
        Log-Test "------------------------------------------"
        Log-Test "Sending: POST $BackendUrl/api/cases/$createdCaseId/render-pdf"
        
        $pdfResp = Invoke-WebRequest `
            -Uri "$BackendUrl/api/cases/$createdCaseId/render-pdf" `
            -Method POST `
            -ContentType "application/json" `
            -UseBasicParsing `
            -TimeoutSec 15 `
            -ErrorAction Stop
        
        Test-Result "PDF rendered successfully" ($pdfResp.StatusCode -eq 200) `
            "Status: $($pdfResp.StatusCode)"
        
        # --- SEND EMAIL ---
        Log-Test ""
        Log-Test "------------------------------------------"
        Log-Test "STEP 3: Send Email (CRITICAL TEST)"
        Log-Test "------------------------------------------"
        Log-Test "Sending: POST $BackendUrl/api/cases/$createdCaseId/send-email"
        Log-Test ""
        Log-Test "[WARN] KEY VERIFICATION:"
        Log-Test "   - Email should contain ONLY 2 approved products"
        Log-Test "   - Email should NOT contain all 45 catalog products"
        Log-Test "   - Server logs must show [resolveProtocolRows] using approvedProtocols"
        
        $emailResp = Invoke-WebRequest `
            -Uri "$BackendUrl/api/cases/$createdCaseId/send-email" `
            -Method POST `
            -ContentType "application/json" `
            -UseBasicParsing `
            -TimeoutSec 15 `
            -ErrorAction Stop
        
        Log-Test ""
        $emailResult = $emailResp.Content | ConvertFrom-Json
        
        Test-Result "Email sent successfully" ($emailResp.StatusCode -eq 200 -and $emailResult.ok) `
            "Status: $($emailResp.StatusCode), OK: $($emailResult.ok)"
        
        Log-Test "Email provider: $($emailResult.email.provider)"
        Log-Test "Email sent to: $($emailResult.email.to)"
        Log-Test "Email CC: $($emailResult.email.cc -join ', ')"
        
    } else {
        Test-Result "Case creation response validation" $false "Response: $($caseResult | ConvertTo-Json)"
    }
    
} catch {
    Test-Result "Request successful" $false "Error: $($_.Exception.Message)"
    Log-Test ""
    Log-Test "Response: $($_.Exception.Response.StatusCode)"
    Log-Test "Details: $(($_ | ConvertTo-Json -Depth 3) | Out-String)"
}

# --- VERIFICATION INSTRUCTIONS ---
Log-Test ""
Log-Test "==================================================="
Log-Test "TEST SUMMARY"
Log-Test "==================================================="
Log-Test "Passed: $($global:testResults.passedTests)"
Log-Test "Failed: $($global:testResults.failedTests)"
Log-Test ""
Log-Test "[NOTE] MANUAL VERIFICATION REQUIRED:"
Log-Test ""
Log-Test "1. Check server logs for lines containing [resolveProtocolRows]:"
Log-Test "   Should show: 'using approvedProtocols (2 products)'"
Log-Test "   Should NOT show: '45 products' or 'full catalog'"
Log-Test ""
Log-Test "2. Check email content (if SMTP configured):"
Log-Test "   - Should list ONLY: 'Producto Aprobado 1' and 'Producto Aprobado 2'"
Log-Test "   - Should NOT contain 'Catálogo Producto 1' through '45'"
Log-Test ""
Log-Test "3. If dry_run mode:"
Log-Test "   - Check server audit logs at: /audit/"
Log-Test "   - Check email records stored in memory"
Log-Test ""
Log-Test "==================================================="

if ($global:testResults.failedTests -gt 0) {
    Log-Test "[FAIL] Some tests failed. Review above."
    exit 1
} else {
    Log-Test "[OK] All transport tests passed. Check logs for protocol verification."
    exit 0
}
