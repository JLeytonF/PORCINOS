import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const dataDir = process.env.DATA_DIR || './storage';
const casesFile = path.join(dataDir, 'cases.json');
const auditFile = path.join(dataDir, 'audit.json');
const pdfDir = path.join(dataDir, 'generated-pdfs');

function ensureStorage() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(pdfDir, { recursive: true });

  if (!fs.existsSync(casesFile)) {
    fs.writeFileSync(casesFile, JSON.stringify([], null, 2));
  }

  if (!fs.existsSync(auditFile)) {
    fs.writeFileSync(auditFile, JSON.stringify([], null, 2));
  }
}

export function readJson(filePath) {
  ensureStorage();
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

export function writeJson(filePath, data) {
  ensureStorage();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function listCases() {
  return readJson(casesFile);
}

export function getCaseById(id) {
  return listCases().find((item) => item.id === id) || null;
}

export function createCase(payload) {
  const cases = listCases();
  const id = payload.id || `CASO-${Date.now()}-${uuidv4().slice(0, 6)}`;
  const caseRecord = {
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    version: 1,
    payload,
    jev: payload.jev || {},
    approval: null,
    pdf: null,
    email: null
  };

  cases.unshift(caseRecord);
  writeJson(casesFile, cases);
  writeAudit('case_created', { caseId: id, payload: payload.cliente || 'cliente' });
  return caseRecord;
}

export function updateCase(id, patch) {
  const cases = listCases();
  const index = cases.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated = {
    ...cases[index],
    ...patch,
    updatedAt: new Date().toISOString()
  };

  cases[index] = updated;
  writeJson(casesFile, cases);
  return updated;
}

export function listAudit() {
  return readJson(auditFile);
}

export function writeAudit(event, data = {}) {
  ensureStorage();
  const logs = listAudit();
  logs.unshift({
    id: uuidv4(),
    event,
    timestamp: new Date().toISOString(),
    data
  });
  writeJson(auditFile, logs);
  return logs[0];
}

export function savePdfArtifact(caseId, fileName, absolutePath) {
  const cases = listCases();
  const index = cases.findIndex((item) => item.id === caseId);
  if (index === -1) return null;

  const updated = {
    ...cases[index],
    pdf: {
      fileName,
      absolutePath,
      generatedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };

  cases[index] = updated;
  writeJson(casesFile, cases);
  return updated;
}

export function saveEmailRecord(caseId, payload) {
  const cases = listCases();
  const index = cases.findIndex((item) => item.id === caseId);
  if (index === -1) return null;

  const updated = {
    ...cases[index],
    email: {
      ...payload,
      sentAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
  };

  cases[index] = updated;
  writeJson(casesFile, cases);
  return updated;
}

export function getPdfBaseDir() {
  ensureStorage();
  return pdfDir;
}
