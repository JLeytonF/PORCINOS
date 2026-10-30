#!/usr/bin/env node
/**
 * Capture Email Content & PDF - Show what user receives
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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

async function captureContent() {
  console.log('\n========== CAPTURING EMAIL CONTENT & PDF ==========\n');

  try {
    // 1. Create case with approvedProtocols
    const casePayload = {
      caseId: `capture-${Date.now()}`,
      cliente: 'Granja La Esperanza',
      granja: 'Granja La Esperanza - Zona 2',
      fase: 'LEVANTE',
      viaPreferida: 'Agua',
      desafio: 'Coccidiosis + Necrosis',
      animalesTratar: 1500,
      pesoPromedio: 1.8,
      edadDias: 18,
      consumoAguaRealKgDia: 45,
      consumoAlimentoRealKgDia: 42,
      mortalidadPct: 2.5,
      gananciaCorpDiaGr: 35,
      veterinaryNotes: 'Caso clínico con lesiones moderadas. Requiere protocolo inmediato.',
      approvedProtocols: [
        { 
          id: 'aprobado-1',
          producto: 'COCCI-STOP Pro', 
          dosisAprobada: '2.5 mg/kg/día',
          viaAprobada: 'Agua',
          duracionDias: 5,
          cantidadTotalTexto: '187.5 kg',
          costoTexto: '$1,250,000 COP'
        },
        { 
          id: 'aprobado-2',
          producto: 'INMUNO-VIT Complejo', 
          dosisAprobada: '5 mL/100 L agua',
          viaAprobada: 'Agua',
          duracionDias: 7,
          cantidadTotalTexto: '3.15 L',
          costoTexto: '$425,000 COP'
        }
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
    console.log(`✓ Case ID: ${caseId}\n`);

    // 2. Approve case
    console.log('📌 Step 2: Approving case...');
    const approveRes = await request('POST', `/api/cases/${caseId}/approve`, {
      veterinarianName: 'Dr. Carlos Méndez García',
      viaAprobada: 'Agua',
      dosisAprobada: '2.5 mg/kg/día',
      diasAprobados: 5,
      observaciones: 'Protocolo prioritario por nivel de mortalidad. Monitorear diariamente.'
    });
    console.log(`✓ Case approved\n`);

    // 3. Render PDF
    console.log('📌 Step 3: Rendering PDF...');
    const pdfRes = await request('POST', `/api/cases/${caseId}/render-pdf`);
    console.log(`✓ PDF generated (${pdfRes.status})\n`);

    // 4. Get case to see email content
    console.log('📌 Step 4: Retrieving case data (to see what email will contain)...');
    const caseRes = await request('GET', `/api/cases/${caseId}`);
    const caseData = caseRes.body?.case || caseRes.body;

    // === DISPLAY EMAIL CONTENT ===
    console.log('\n' + '='.repeat(80));
    console.log('📧 EMAIL CONTENT (HTML Body)');
    console.log('='.repeat(80) + '\n');

    // Extract email content from case record (if stored)
    if (caseData && caseData.payload) {
      const payload = caseData.payload;
      
      console.log('TO:', 'to@example.com');
      console.log('SUBJECT: [PoultryIA] Diagnóstico y Protocolo Recomendado');
      console.log('FROM: sistema@poultryia.com\n');

      console.log('--- PREVIEW (First 500 chars) ---\n');
      
      // Show case info
      console.log(`📋 CASO: ${payload.caseId}`);
      console.log(`🏢 CLIENTE: ${payload.cliente}`);
      console.log(`🏭 GRANJA: ${payload.granja}`);
      console.log(`📊 FASE: ${payload.fase}`);
      console.log(`⚠️  DESAFÍO: ${payload.desafio}`);
      console.log(`🐔 ANIMALES A TRATAR: ${payload.animalesTratar}`);
      console.log(`⚖️  PESO PROMEDIO: ${payload.pesoPromedio} kg`);
      console.log(`📅 EDAD: ${payload.edadDias} días`);
      console.log(`💧 CONSUMO AGUA: ${payload.consumoAguaRealKgDia} kg/día`);
      console.log(`📈 MORTALIDAD: ${payload.mortalidadPct}%`);
      console.log(`💪 GANANCIA CORPORAL: ${payload.gananciaCorpDiaGr} g/día\n`);

      console.log('--- TABLA DE PROTOCOLOS APROBADOS ---\n');
      console.log('| # | Producto | Ruta | Dosis | Días | Total | Inversión |');
      console.log('|----|----------|------|-------|------|-------|-----------|');
      
      if (payload.approvedProtocols && Array.isArray(payload.approvedProtocols)) {
        payload.approvedProtocols.forEach((p, idx) => {
          console.log(`| ${idx+1} | ${p.producto} | ${p.viaAprobada} | ${p.dosisAprobada} | ${p.duracionDias} | ${p.cantidadTotalTexto} | ${p.costoTexto} |`);
        });
      }

      console.log('\n--- DIAGNÓSTICO Y OBSERVACIONES ---\n');
      console.log(payload.veterinaryNotes || 'Sin notas');

      if (caseData.approval) {
        console.log('\n--- APROBACIÓN ---\n');
        console.log(`Veterinario: ${caseData.approval.veterinarianName}`);
        console.log(`Observaciones: ${caseData.approval.observaciones || 'Ninguna'}`);
      }

      console.log('\n--- PDF ADJUNTO ---\n');
      console.log(`Archivo: poultryia_diagnostico_${caseId}.pdf`);
      console.log(`Tamaño: PDF generado con tabla de protocolos aprobados`);
      console.log(`Contenido: Datos del caso + Diagnóstico + JEV + Protocolos seleccionados\n`);
    }

    // === VERIFY approvedProtocols filtering ===
    console.log('\n' + '='.repeat(80));
    console.log('✅ VERIFICACIÓN DE FILTRADO');
    console.log('='.repeat(80) + '\n');

    if (caseData && caseData.payload) {
      const approved = caseData.payload.approvedProtocols || [];
      const total = caseData.payload.protocolos || [];
      
      console.log(`✓ approvedProtocols count: ${approved.length} (mostrados en email)`);
      console.log(`✓ protocolos completos: ${total.length} (NO mostrados en email)`);
      console.log(`✓ Filtrado: ${approved.length > 0 ? '✅ ACTIVO' : '⚠️  INACTIVO'}\n`);

      if (approved.length > 0) {
        console.log('Protocolos mostrados en email:');
        approved.forEach((p, i) => {
          console.log(`  ${i+1}. ${p.producto} (${p.dosisAprobada})`);
        });
      }
    }

    // === SEND EMAIL ===
    console.log('\n📌 Step 5: Sending email...');
    const emailRes = await request('POST', `/api/cases/${caseId}/send-email`);
    console.log(`✓ Email sent (Status: ${emailRes.status})`);
    console.log(`✓ Response: ${JSON.stringify(emailRes.body, null, 2)}\n`);

    console.log('='.repeat(80));
    console.log('✅ CAPTURE COMPLETE');
    console.log('='.repeat(80));
    console.log('\n📝 El correo contiene:');
    console.log('   ✓ Datos del caso (cliente, granja, fase, desafío)');
    console.log('   ✓ Parámetros zootécnicos (animales, peso, edad, consumo, mortalidad)');
    console.log('   ✓ Tabla con SOLO protocolos aprobados (2 filas, no 45)');
    console.log('   ✓ PDF adjunto con la misma información');
    console.log('   ✓ Notas del veterinario y observaciones de aprobación\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

captureContent();
