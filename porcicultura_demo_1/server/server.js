import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';

import { evaluateJEV } from './src/jev.js';
import {
  createCase,
  getCaseById,
  listCases,
  savePdfArtifact,
  saveEmailRecord,
  updateCase,
  writeAudit,
  getPdfBaseDir
} from './src/store.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3005);
const HOST = process.env.HOST || '0.0.0.0';

const ALLOWED_ORIGINS = [
  'https://poultryia.com',
  'https://www.poultryia.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin(origin, callback) {
    // Sin origin = petición desde el mismo servidor (nginx proxy o curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

function prettyCurrency(value) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function buildPdfFileName(caseId, cliente) {
  const safe = String(cliente || 'cliente').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `propuesta_${safe || 'bioara'}_${caseId}.pdf`;
}

function validateRequiredFields(payload) {
  const required = ['cliente', 'granja', 'fase', 'viaPreferida', 'desafio'];
  const missing = required.filter((field) => !String(payload[field] || '').trim());

  if (missing.length) {
    return { ok: false, missing };
  }

  if (['Alimento', 'Agua+Alimento'].includes(String(payload.viaPreferida || '').trim()) && Number(payload.consumoAlimentoRealKgDia || 0) <= 0) {
    return { ok: false, missing: ['consumoAlimentoRealKgDia'] };
  }

  return { ok: true, missing: [] };
}

function ensureSmtpTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: { user, pass }
  });
}

function buildPdf(caseId, payload) {
  const fileName = buildPdfFileName(caseId, payload.cliente);
  const pdfPath = path.join(getPdfBaseDir(), fileName);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const writeStream = fs.createWriteStream(pdfPath);
    doc.pipe(writeStream);

    doc.fontSize(18).text('BioARA AI - Propuesta técnica veterinaria', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Caso: ${caseId}`);
    doc.text(`Cliente: ${payload.cliente || 'Sin cliente'}`);
    doc.text(`Granja: ${payload.granja || 'Sin granja'}`);
    doc.text(`Fase: ${payload.fase || 'Sin fase'}`);
    doc.text(`Vía: ${payload.viaPreferida || 'Sin vía'}`);
    doc.text(`Desafío: ${payload.desafio || 'Sin desafío'}`);
    doc.text(`Consumo real del lote: ${Number(payload.consumoAlimentoRealKgDia || 0).toFixed(2)} kg/día`);
    doc.moveDown();

    doc.fontSize(14).text('JEV - Justificación / Evidencia / Verificación');
    const jev = evaluateJEV(payload);
    doc.fontSize(11).text(`Justificación: ${jev.justification.razon}`);
    doc.text(`Estado JEV: ${jev.status}`);
    doc.text(`Resumen verificación: ${jev.verification.summary}`);

    const checks = (jev.verification.checks || []).map((check) => `- ${check.name}: ${check.ok ? 'OK' : 'FALLA'} / ${check.detail}`).join('\n');
    doc.text(checks, { width: 500, align: 'left' });

    doc.moveDown();
    doc.fontSize(12).text('Resumen financiero');
    doc.text(`Inversión estimada: ${prettyCurrency(payload.inversionTotalCop || 0)}`);
    doc.text(`ROI estimado: ${Number(payload.roiPct || 0).toFixed(2)}%`);
    doc.text(`Correo contacto: business@poultryia.com`);

    const protocolos = Array.isArray(payload.approvedProtocols) && payload.approvedProtocols.length
      ? payload.approvedProtocols
      : Array.isArray(payload.protocolos) ? payload.protocolos : [];

    if (protocolos.length) {
      doc.moveDown();
      doc.fontSize(14).text('Protocolo recomendado aprobado');
      doc.moveDown(0.4);
      protocolos.forEach((item, index) => {
        const nombre = item.producto || `Producto ${index + 1}`;
        const ruta = item.ruta || item.viaAprobada || 'Definir';
        const dosis = item.cantidadDiaTexto || item.dosisAprobada || item.doseUnit || item.dosisUnidad || 'Dosis MVZ';
        const dias = item.duracionDias || item.diasAprobados || 'ND';
        const total = item.cantidadTotalTexto || item.totalTexto || 'Validar con criterio MVZ';
        const costo = item.costoTexto || prettyCurrency(item.costo || 0);
        doc.fontSize(10).text(`${index + 1}. ${nombre}`);
        doc.fontSize(9).text(`   Ruta: ${ruta} | Dosis: ${dosis} | Dias: ${dias} | Total: ${total} | Inversion: ${costo}`);
      });
    }

    if (payload.veterinaryNotes) {
      doc.moveDown();
      doc.fontSize(12).text('Observaciones del veterinario');
      doc.fontSize(10).text(String(payload.veterinaryNotes), { width: 500 });
    }

    doc.end();

    writeStream.on('finish', () => resolve({ fileName, absolutePath: pdfPath }));
    writeStream.on('error', reject);
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolveProtocolRows(payload = {}) {
  if (Array.isArray(payload.approvedProtocols) && payload.approvedProtocols.length) {
    return payload.approvedProtocols;
  }
  if (Array.isArray(payload.protocolos) && payload.protocolos.length) {
    return payload.protocolos;
  }
  return [];
}

function buildMailContent(caseRecord) {
  const payload = caseRecord?.payload || {};
  const approval = caseRecord?.approval || {};
  const jev = payload.jev || evaluateJEV(payload);
  const protocolos = resolveProtocolRows(payload);
  const approvedPriority = Array.isArray(payload.approvedPriorityOne) && payload.approvedPriorityOne.length
    ? payload.approvedPriorityOne
    : (Array.isArray(payload.unifiedPriorityOne) ? payload.unifiedPriorityOne.filter((item) => Number(item.prioridad || 0) === 1) : []);
  const includesFullProposalInBody = /Protocolo recomendado|JEV \(Justificaci[oó]n \/ Evidencia \/ Verificaci[oó]n\)|Resumen financiero/i.test(JSON.stringify({ text: payload?.veterinaryNotes || "", jev, protocolos, approvedPriority }));
  const shouldAttachPdf = Boolean(caseRecord.pdf) && !includesFullProposalInBody;

  const consumoAgua = Number(payload?.consumo?.aguaLote || 0).toFixed(2);
  const consumoAlimento = Number(payload?.consumo?.alimLote || 0).toFixed(2);
  const consumoReal = Number(payload.consumoAlimentoRealKgDia || 0).toFixed(2);
  const inversion = prettyCurrency(payload.inversionTotalCop || payload?.financiero?.inversionTotal || 0);
  const roi = Number(payload.roiPct || payload?.financiero?.roi || 0).toFixed(2);

  const protocolText = protocolos.length
    ? protocolos.map((item, index) => {
        const nombre = item.producto || `Producto ${index + 1}`;
        const ruta = item.ruta || item.viaAprobada || 'Definir';
        const dosis = item.cantidadDiaTexto || item.dosisAprobada || item.doseUnit || item.dosisUnidad || 'Dosis MVZ';
        const dias = item.duracionDias || item.diasAprobados || 'ND';
        const total = item.cantidadTotalTexto || item.totalTexto || 'Validar con criterio MVZ';
        const costo = item.costoTexto || prettyCurrency(item.costo || 0);
        return `${index + 1}. ${nombre} | Ruta: ${ruta} | Dosis: ${dosis} | Días: ${dias} | Total: ${total} | Inversión: ${costo}`;
      }).join('\n')
    : 'Sin protocolo detallado disponible.';

  const protocolRowsHtml = protocolos.length
    ? protocolos.map((item, index) => {
        const nombre = item.producto || `Producto ${index + 1}`;
        const ruta = item.ruta || item.viaAprobada || 'Definir';
        const dosis = item.cantidadDiaTexto || item.dosisAprobada || item.doseUnit || item.dosisUnidad || 'Dosis MVZ';
        const dias = item.duracionDias || item.diasAprobados || 'ND';
        const total = item.cantidadTotalTexto || item.totalTexto || 'Validar con criterio MVZ';
        const costo = item.costoTexto || prettyCurrency(item.costo || 0);
        return `<tr>
          <td style="border:1px solid #d8e6df; padding:8px;">${escapeHtml(String(index + 1))}</td>
          <td style="border:1px solid #d8e6df; padding:8px;">${escapeHtml(nombre)}</td>
          <td style="border:1px solid #d8e6df; padding:8px;">${escapeHtml(ruta)}</td>
          <td style="border:1px solid #d8e6df; padding:8px;">${escapeHtml(dosis)}</td>
          <td style="border:1px solid #d8e6df; padding:8px;">${escapeHtml(String(dias))}</td>
          <td style="border:1px solid #d8e6df; padding:8px;">${escapeHtml(total)}</td>
          <td style="border:1px solid #d8e6df; padding:8px;">${escapeHtml(costo)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="7" style="border:1px solid #d8e6df; padding:8px;">Sin protocolo detallado disponible.</td></tr>`;

  const priorityText = approvedPriority.length
    ? approvedPriority.map((item) => `- ${item.producto} (${item.categoria || 'Categoría N/D'})`).join('\n')
    : '- Sin prioridad 1 registrada';

  const jevChecksText = (jev.verification?.checks || [])
    .map((check) => `- ${check.name}: ${check.ok ? 'OK' : 'FALLA'} / ${check.detail}`)
    .join('\n');

  const subject = `Propuesta técnica BioARA AI - ${payload.cliente || 'Cliente'} - Caso ${caseRecord.id}`;
  const attachmentNote = shouldAttachPdf
    ? `Adjunto encontrará la propuesta técnica completa del caso ${caseRecord.id}.`
    : `La propuesta técnica del caso ${caseRecord.id} se presenta en el cuerpo del correo para evitar duplicar el contenido del PDF.`;

  const text = [
    'Estimado/a:',
    '',
    attachmentNote,
    '',
    'Datos del caso',
    `- Cliente: ${payload.cliente || 'N/A'}`,
    `- Granja: ${payload.granja || 'N/A'}`,
    `- Fase: ${payload.fase || 'N/A'}`,
    `- Vía preferida: ${payload.viaPreferida || 'N/A'}`,
    `- Desafío: ${payload.desafio || 'N/A'}`,
    `- Consumo agua lote/día: ${consumoAgua} L`,
    `- Consumo alimento lote/día: ${consumoAlimento} kg`,
    `- Consumo real del lote: ${consumoReal} kg/día`,
    '',
    'Aprobación veterinaria',
    `- Veterinario: ${approval.veterinarianName || 'Médico Veterinario BioARA'}`,
    `- Vía aprobada: ${approval.viaAprobada || payload.viaPreferida || 'N/A'}`,
    `- Dosis aprobada: ${approval.dosisAprobada || 'Sin dosis'}`,
    `- Días aprobados: ${approval.diasAprobados || 'N/D'}`,
    `- Observaciones: ${approval.observaciones || payload.veterinaryNotes || 'Sin observaciones'}`,
    '',
    'Prioridad 1',
    priorityText,
    '',
    'Protocolo recomendado',
    protocolText,
    '',
    'JEV (Justificación / Evidencia / Verificación)',
    `- Estado: ${jev.status}`,
    `- Justificación: ${jev.justification?.razon || 'N/A'}`,
    `- Resumen: ${jev.verification?.summary || 'N/A'}`,
    jevChecksText || '- Sin checks JEV',
    '',
    'Resumen financiero',
    `- Inversión estimada: ${inversion}`,
    `- ROI estimado: ${roi}%`,
    '',
    'Saludos,',
    'Equipo BioARA AI',
    'business@poultryia.com'
  ].join('\n');

  const html = `
    <div style="font-family:Segoe UI, Arial, sans-serif; color:#17312b; line-height:1.5;">
      <h2 style="margin:0 0 8px; color:#0b5d47;">Propuesta técnica BioARA AI</h2>
      <p style="margin:0 0 14px;">Caso <strong>${escapeHtml(caseRecord.id)}</strong></p>

      <h3 style="margin:18px 0 8px; color:#0b5d47;">Datos del caso</h3>
      <ul style="margin-top:0;">
        <li><strong>Cliente:</strong> ${escapeHtml(payload.cliente || 'N/A')}</li>
        <li><strong>Granja:</strong> ${escapeHtml(payload.granja || 'N/A')}</li>
        <li><strong>Fase:</strong> ${escapeHtml(payload.fase || 'N/A')}</li>
        <li><strong>Vía preferida:</strong> ${escapeHtml(payload.viaPreferida || 'N/A')}</li>
        <li><strong>Desafío:</strong> ${escapeHtml(payload.desafio || 'N/A')}</li>
        <li><strong>Consumo agua lote/día:</strong> ${escapeHtml(consumoAgua)} L</li>
        <li><strong>Consumo alimento lote/día:</strong> ${escapeHtml(consumoAlimento)} kg</li>
        <li><strong>Consumo real del lote:</strong> ${escapeHtml(consumoReal)} kg/día</li>
      </ul>

      <h3 style="margin:18px 0 8px; color:#0b5d47;">Aprobación veterinaria</h3>
      <ul style="margin-top:0;">
        <li><strong>Veterinario:</strong> ${escapeHtml(approval.veterinarianName || 'Médico Veterinario BioARA')}</li>
        <li><strong>Vía aprobada:</strong> ${escapeHtml(approval.viaAprobada || payload.viaPreferida || 'N/A')}</li>
        <li><strong>Dosis aprobada:</strong> ${escapeHtml(approval.dosisAprobada || 'Sin dosis')}</li>
        <li><strong>Días aprobados:</strong> ${escapeHtml(String(approval.diasAprobados || 'N/D'))}</li>
        <li><strong>Observaciones:</strong> ${escapeHtml(approval.observaciones || payload.veterinaryNotes || 'Sin observaciones')}</li>
      </ul>

      <h3 style="margin:18px 0 8px; color:#0b5d47;">Protocolo recomendado</h3>
      <table style="border-collapse:collapse; width:100%; font-size:12px;">
        <thead>
          <tr style="background:#edf7f2;">
            <th style="border:1px solid #d8e6df; padding:8px;">#</th>
            <th style="border:1px solid #d8e6df; padding:8px;">Producto</th>
            <th style="border:1px solid #d8e6df; padding:8px;">Ruta</th>
            <th style="border:1px solid #d8e6df; padding:8px;">Dosis</th>
            <th style="border:1px solid #d8e6df; padding:8px;">Días</th>
            <th style="border:1px solid #d8e6df; padding:8px;">Total tratamiento</th>
            <th style="border:1px solid #d8e6df; padding:8px;">Inversión</th>
          </tr>
        </thead>
        <tbody>${protocolRowsHtml}</tbody>
      </table>

      <h3 style="margin:18px 0 8px; color:#0b5d47;">JEV (Justificación / Evidencia / Verificación)</h3>
      <ul style="margin-top:0;">
        <li><strong>Estado:</strong> ${escapeHtml(jev.status)}</li>
        <li><strong>Justificación:</strong> ${escapeHtml(jev.justification?.razon || 'N/A')}</li>
        <li><strong>Resumen:</strong> ${escapeHtml(jev.verification?.summary || 'N/A')}</li>
      </ul>

      <h3 style="margin:18px 0 8px; color:#0b5d47;">Resumen financiero</h3>
      <ul style="margin-top:0;">
        <li><strong>Inversión estimada:</strong> ${escapeHtml(inversion)}</li>
        <li><strong>ROI estimado:</strong> ${escapeHtml(roi)}%</li>
      </ul>

      <p style="margin-top:20px;">${shouldAttachPdf ? 'Adjunto: PDF oficial de la propuesta técnica.' : 'La propuesta técnica se presenta en el cuerpo del correo para evitar duplicar el contenido del PDF.'}</p>
      <p style="margin-top:16px;">Saludos,<br/><strong>Equipo BioARA AI</strong><br/>business@poultryia.com</p>
    </div>
  `;

  return { subject, text, html, shouldAttachPdf };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: process.env.APP_NAME || 'Porcicultura Hostinger Backend', timestamp: new Date().toISOString() });
});

app.post('/api/cases/validate', (req, res) => {
  const payload = req.body || {};
  const validation = validateRequiredFields(payload);

  if (!validation.ok) {
    return res.status(400).json({ ok: false, errors: validation.missing, message: 'Faltan campos obligatorios o consumo real del lote no válido.' });
  }

  const jev = evaluateJEV(payload);
  return res.json({ ok: true, validation, jev });
});

app.post('/api/cases', async (req, res) => {
  try {
    const payload = req.body || {};
    const validation = validateRequiredFields(payload);

    if (!validation.ok) {
      return res.status(400).json({ ok: false, errors: validation.missing, message: 'Faltan campos obligatorios' });
    }

    const jev = evaluateJEV(payload);
    if (jev.status !== 'jev_ready') {
      writeAudit('jev_blocked', { casePayload: payload, jev });
      return res.status(422).json({ ok: false, message: 'El caso no cumple validación JEV', jev });
    }

    const caseRecord = createCase({ ...payload, jev });
    writeAudit('case_created', { caseId: caseRecord.id, jev });

    return res.status(201).json({ ok: true, case: caseRecord });
  } catch (error) {
    console.error('create case error', error);
    return res.status(500).json({ ok: false, message: 'Error creando caso', details: String(error.message || error) });
  }
});

app.get('/api/cases', (req, res) => {
  res.json({ ok: true, cases: listCases() });
});

app.get('/api/cases/:id', (req, res) => {
  const caseRecord = getCaseById(req.params.id);
  if (!caseRecord) {
    return res.status(404).json({ ok: false, message: 'Caso no encontrado' });
  }
  return res.json({ ok: true, case: caseRecord });
});

app.post('/api/cases/:id/approve', async (req, res) => {
  try {
    const { veterinarianName, viaAprobada, dosisAprobada, diasAprobados, observaciones } = req.body || {};
    const caseRecord = getCaseById(req.params.id);
    if (!caseRecord) {
      return res.status(404).json({ ok: false, message: 'Caso no encontrado' });
    }

    if (!veterinarianName || !viaAprobada || !dosisAprobada || !Number(diasAprobados) || Number(diasAprobados) <= 0) {
      return res.status(400).json({ ok: false, message: 'La aprobación debe incluir veterinario, vía, dosis y días.' });
    }

    const finalApproval = {
      veterinarianName,
      viaAprobada,
      dosisAprobada,
      diasAprobados: Number(diasAprobados),
      observaciones: observaciones || 'Sin observaciones adicionales',
      approvedAt: new Date().toISOString(),
      signed: true
    };

    const updated = updateCase(req.params.id, {
      status: 'approved',
      approval: finalApproval,
      version: Number(caseRecord.version || 1) + 1
    });

    writeAudit('case_approved', { caseId: req.params.id, approval: finalApproval });
    return res.json({ ok: true, case: updated });
  } catch (error) {
    console.error('approve case error', error);
    return res.status(500).json({ ok: false, message: 'Error aprobando caso', details: String(error.message || error) });
  }
});

app.post('/api/cases/:id/render-pdf', async (req, res) => {
  try {
    const caseRecord = getCaseById(req.params.id);
    if (!caseRecord) {
      return res.status(404).json({ ok: false, message: 'Caso no encontrado' });
    }

    if (!caseRecord.approval || !caseRecord.approval.signed) {
      return res.status(422).json({ ok: false, message: 'El caso debe estar aprobado antes de generar PDF.' });
    }

    const result = await buildPdf(req.params.id, caseRecord.payload);
    const updated = savePdfArtifact(req.params.id, result.fileName, result.absolutePath);
    writeAudit('pdf_generated', { caseId: req.params.id, pdf: result.fileName });

    res.json({ ok: true, case: updated, pdf: result });
  } catch (error) {
    console.error('render pdf error', error);
    return res.status(500).json({ ok: false, message: 'Error generando PDF', details: String(error.message || error) });
  }
});

app.post('/api/cases/:id/send-email', async (req, res) => {
  try {
    const caseRecord = getCaseById(req.params.id);
    if (!caseRecord) {
      return res.status(404).json({ ok: false, message: 'Caso no encontrado' });
    }

    if (!caseRecord.pdf) {
      return res.status(422).json({ ok: false, message: 'Debe generarse antes el PDF del caso.' });
    }

    const transport = ensureSmtpTransport();
    const recipient = String(caseRecord.payload.emailCliente || process.env.EMAIL_TO_DEFAULT || 'business@poultryia.com').trim();
    const ccRecipients = [
      process.env.SMTP_FROM || 'business@poultryia.com',
      caseRecord.payload.emailBioara || 'business@poultryia.com'
    ].filter(Boolean);

    const mailContent = buildMailContent(caseRecord);
    const attachments = mailContent.shouldAttachPdf && caseRecord.pdf
      ? [{
          filename: path.basename(caseRecord.pdf.fileName),
          path: caseRecord.pdf.absolutePath
        }]
      : [];

    const emailRecord = {
      caseId: req.params.id,
      to: recipient,
      cc: ccRecipients,
      subject: mailContent.subject,
      body: mailContent.text,
      provider: transport ? 'smtp' : 'dry_run'
    };

    if (!transport) {
      saveEmailRecord(req.params.id, { ...emailRecord, status: 'dry_run', trackingId: `dry-${uuidv4()}` });
      writeAudit('email_dry_run', { caseId: req.params.id, emailRecord });
      return res.json({ ok: true, message: 'Sin SMTP configurado; correo en modo dry_run.', email: emailRecord });
    }

    const result = await transport.sendMail({
      from: process.env.SMTP_FROM || 'business@poultryia.com',
      to: recipient,
      cc: ccRecipients,
      subject: emailRecord.subject,
      text: mailContent.text,
      html: mailContent.html,
      attachments
    });

    const updated = saveEmailRecord(req.params.id, {
      ...emailRecord,
      status: 'sent',
      trackingId: result?.messageId || `smtp-${uuidv4()}`
    });

    writeAudit('email_sent', { caseId: req.params.id, emailRecord, smtpMessageId: result?.messageId });
    res.json({ ok: true, message: 'Correo enviado desde SMTP real de Hostinger.', email: updated.email });
  } catch (error) {
    console.error('send-email error', error);
    return res.status(500).json({ ok: false, message: 'Error enviando correo', details: String(error.message || error) });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Porcicultura Hostinger backend active on http://${HOST}:${PORT}`);
  console.log(`SMTP configured: ${Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)}`);
});
