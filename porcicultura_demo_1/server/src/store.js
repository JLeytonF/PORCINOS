import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const dataDir = process.env.DATA_DIR || './storage';
const casesFile = path.join(dataDir, 'cases.json');
const auditFile = path.join(dataDir, 'audit.json');
const pageViewsFile = path.join(dataDir, 'page_views.json');
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

  if (!fs.existsSync(pageViewsFile)) {
    fs.writeFileSync(pageViewsFile, JSON.stringify([], null, 2));
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

export function listPageViews() {
  return readJson(pageViewsFile);
}

export function recordPageView(entry = {}) {
  ensureStorage();
  const pageViews = listPageViews();
  const record = {
    id: entry.id || `pageview-${Date.now()}-${uuidv4().slice(0, 8)}`,
    event: 'page_view',
    timestamp: entry.timestamp || new Date().toISOString(),
    path: entry.path || '/',
    ip_hash: entry.ip_hash || null,
    user_agent_hash: entry.user_agent_hash || null,
    campaign_token: entry.campaign_token || null,
    source: entry.source || 'poultryia-web',
    referrer: entry.referrer || null,
    session_id: entry.session_id || null
  };

  pageViews.unshift(record);
  writeJson(pageViewsFile, pageViews);
  writeAudit('page_view', { ...record });
  return record;
}

export function getPageViewSummary() {
  const pageViews = listPageViews();
  const audit = listAudit();

  const uniqueVisitors = new Set(
    pageViews
      .filter((item) => item.ip_hash && item.user_agent_hash)
      .map((item) => `${item.ip_hash}|${item.user_agent_hash}`)
  ).size;

  const queriesInitiated = audit.filter((item) => item.event === 'case_created').length;
  const queriesCompleted = audit.filter((item) => item.event === 'case_approved').length;
  const conversionRate = pageViews.length > 0 ? (queriesCompleted / pageViews.length) * 100 : 0;

  return {
    total_visits: pageViews.length,
    unique_visitors_approx: uniqueVisitors,
    queries_initiated: queriesInitiated,
    queries_completed: queriesCompleted,
    conversion_rate_pct: Number(conversionRate.toFixed(2))
  };
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
