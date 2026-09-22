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

    doc.end();

    writeStream.on('finish', () => resolve({ fileName, absolutePath: pdfPath }));
    writeStream.on('error', reject);
  });
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

    const mailText = [
      'Estimado/a:',
      '',
      `Adjunto la propuesta técnica de ${caseRecord.payload.cliente || 'Cliente'}.`,
      `Granja: ${caseRecord.payload.granja || 'N/A'}`,
      `Vía aprobada: ${caseRecord.approval?.viaAprobada || caseRecord.payload.viaPreferida}`,
      `Dosis aprobada: ${caseRecord.approval?.dosisAprobada || 'Sin dosis'}`,
      `Observaciones del veterinario: ${caseRecord.approval?.observaciones || 'Sin observaciones'}`,
      '',
      'Saludos,',
      'Equipo BioARA AI'
    ].join('\n');

    const emailRecord = {
      caseId: req.params.id,
      to: recipient,
      cc: ccRecipients,
      subject: `Propuesta técnica BioARA AI - ${caseRecord.payload.cliente || 'Cliente'}`,
      body: mailText,
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
      text: mailText,
      attachments: [{
        filename: path.basename(caseRecord.pdf.fileName),
        path: caseRecord.pdf.absolutePath
      }]
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
