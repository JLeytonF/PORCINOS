#!/usr/bin/env node
/**
 * E2E Test: Verify approvedProtocols workflow
 * Tests: Case creation → PDF rendering → Email sending
 */

const http = require('http');

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
  console.log('\n========== E2E TEST: Approved Protocols Workflow ==========\n');

  try {
    // STEP 1: Create case
    console.log('📌 STEP 1: Create case with approvedProtocols...');
    
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
      companyName: 'Test Company',
      evaluationDate: new Date().toISOString().split('T')[0],
      evaluationType: 'INICIAL',
      approvedProtocols: [
        { id: 'prod-1', producto: 'Producto Aprobado 1', dosisAprobada: '10 mg/kg', viaAprobada: 'Agua' },
        { id: 'prod-2', producto: 'Producto Aprobado 2', dosisAprobada: '20 mg/kg', viaAprobada: 'Agua' }
      ],
      protocolos: Array.from({ length: 45 }, (_, i) => ({
        id: `cat-${i+1}`,
        producto: `Catálogo Producto ${i+1}`,
        dosis: `${i+1} mg/kg`
      }))
    };

    const createRes = await request('POST', '/api/cases', casePayload);
    console.log(`✓ Status: ${createRes.status}`);
    
    if (createRes.status !== 201 && createRes.status !== 200) {
      console.error('Error response:', JSON.stringify(createRes.body, null, 2));
      throw new Error(`Failed to create case: ${createRes.status}`);
    }

    const caseId = createRes.body?.case?.id;
    console.log(`✓ Case created: ${caseId}`);

    // STEP 1.5: Approve case
    console.log('\n📌 STEP 1.5: Approve case...');
    
    const approveRes = await request('POST', `/api/cases/${caseId}/approve`, {
      veterinarianName: 'Dr. Test Veterinarian',
      viaAprobada: 'Agua',
      dosisAprobada: '10 mg/kg',
      diasAprobados: 5,
      observaciones: 'Caso de prueba aprobado'
    });
    
    console.log(`✓ Status: ${approveRes.status}`);
    if (approveRes.status !== 200) {
      console.error('Approval Error response:', JSON.stringify(approveRes.body, null, 2));
      throw new Error(`Failed to approve case: ${approveRes.status}`);
    }
    console.log(`✓ Case approved`);

    // STEP 2: Render PDF
    console.log('\n📌 STEP 2: Render PDF...');
    
    const pdfRes = await request('POST', `/api/cases/${caseId}/render-pdf`);
    console.log(`✓ Status: ${pdfRes.status}`);
    
    if (pdfRes.status !== 200) {
      console.error('PDF Error response:', JSON.stringify(pdfRes.body, null, 2));
      throw new Error(`Failed to render PDF: ${pdfRes.status}`);
    }
    
    console.log(`✓ PDF size: ${pdfRes.body.length || 'unknown'} bytes`);

    // STEP 3: Send email
    console.log('\n📌 STEP 3: Send email...');
    
    const emailRes = await request('POST', `/api/cases/${caseId}/send-email`);
    console.log(`✓ Status: ${emailRes.status}`);
    
    if (emailRes.status !== 200) {
      throw new Error(`Failed to send email: ${emailRes.status}`);
    }
    
    console.log(`✓ Email sent successfully`);

    // RESULTS
    console.log('\n========== TEST RESULTS ==========');
    console.log('✅ All tests passed!');
    console.log(`   - Case created: ${caseId}`);
    console.log(`   - PDF rendered: OK`);
    console.log(`   - Email sent: OK`);
    console.log('\nVerify in backend logs:');
    console.log('  - approvedProtocols count: 2 (not 45)');
    console.log('  - Email body contains only approved products');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

test();
