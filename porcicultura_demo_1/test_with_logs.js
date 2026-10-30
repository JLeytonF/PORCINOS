#!/usr/bin/env node
/**
 * E2E Test con Log Capture: Verify approvedProtocols workflow
 */

const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:3005';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : data,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('\n========== E2E TEST WITH LOG CAPTURE ==========\n');

  try {
    // Create case
    const casePayload = {
      caseId: `test-${Date.now()}`,
      cliente: 'Test Cliente',
      granja: 'Test Granja',
      fase: 'INICIO',
      viaPreferida: 'Agua',
      desafio: 'Coccidiosis',
      animalesTratar: 1000,
      pesoPromedio: 2.5,
      edadDias: 21,
      consumoAguaRealKgDia: 50,
      approvedProtocols: [
        { id: 'prod-1', producto: 'APROBADO 1', dosisAprobada: '10 mg/kg', viaAprobada: 'Agua' },
        { id: 'prod-2', producto: 'APROBADO 2', dosisAprobada: '20 mg/kg', viaAprobada: 'Agua' }
      ],
      protocolos: Array.from({ length: 45 }, (_, i) => ({
        id: `cat-${i+1}`,
        producto: `Catalogo-${i+1}`,
        dosis: `${i+1} mg/kg`
      }))
    };

    console.log('📌 Step 1: Creating case...');
    const createRes = await request('POST', '/api/cases', casePayload);
    const caseId = createRes.body?.case?.id;
    console.log(`✓ Case: ${caseId}`);

    // Approve
    console.log('\n📌 Step 2: Approving case...');
    const approveRes = await request('POST', `/api/cases/${caseId}/approve`, {
      veterinarianName: 'Dr. Test',
      viaAprobada: 'Agua',
      dosisAprobada: '10 mg/kg',
      diasAprobados: 5
    });
    console.log(`✓ Approved`);

    // Render PDF
    console.log('\n📌 Step 3: Rendering PDF...');
    const pdfRes = await request('POST', `/api/cases/${caseId}/render-pdf`);
    console.log(`✓ PDF: ${pdfRes.status === 200 ? 'OK' : 'FAILED'}`);

    // Send email - THIS WILL LOG approvedProtocols count
    console.log('\n📌 Step 4: Sending email (check backend logs!)...');
    console.log('   └─ Look for: "[buildMailContent] approvedProtocols length=2"');
    console.log('   └─ Should NOT see "approvedProtocols length=0" or "approvedProtocols length=45"');
    
    const emailRes = await request('POST', `/api/cases/${caseId}/send-email`);
    console.log(`✓ Email: ${emailRes.status === 200 ? 'OK' : 'FAILED'}`);

    // Analysis
    console.log('\n========== ANALYSIS ==========');
    console.log('✅ Workflow completed successfully!');
    console.log('\nExpected log lines in backend:');
    console.log('  [resolveProtocolRows] Usando approvedProtocols (2 productos)');
    console.log('  [buildMailContent] payload.approvedProtocols length=2');
    console.log('  [buildMailContent] payload.protocolos length=45');
    console.log('\n⚠️  If you see "approvedProtocols length=0", the filtering is broken!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

test();
