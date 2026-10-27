import type { DisagreementCase, FairShiftData, Industry, ResolutionAuditEvent, WorkReceipt, WorkerRecord, WorksiteRecord } from './receiptTypes'
import { createDemoReceipts } from './receiptService'
import { createDemoDisagreements } from './disagreementService'
import { seedAuditEvents } from './resolutionTrailService'

const STORAGE_KEY = 'fairshift.shared-data.v1'
const INDUSTRIES: Industry[] = ['Construction', 'Contract Housekeeping']

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function workersFor(receipts: WorkReceipt[]): WorkerRecord[] {
  const map = new Map<string, WorkerRecord>()
  receipts.forEach((r) => {
    if (!map.has(r.workerId)) map.set(r.workerId, { id: r.workerId, name: r.workerName, industry: r.industry, phoneLabel: 'Demo contact · not verified' })
  })
  return [...map.values()]
}
function worksitesFor(receipts: WorkReceipt[]): WorksiteRecord[] {
  const map = new Map<string, WorksiteRecord>()
  receipts.forEach((r) => {
    const id = `${r.industry}:${r.worksite}`
    if (!map.has(id)) map.set(id, { id, name: r.worksite, industry: r.industry, addressLabel: 'Demo worksite · location not independently verified' })
  })
  return [...map.values()]
}

export function createSeedData(): FairShiftData {
  const receipts = createDemoReceipts()
  const disagreements = createDemoDisagreements(receipts)
  return {
    schemaVersion: 1, industries: INDUSTRIES, workers: workersFor(receipts), worksites: worksitesFor(receipts),
    receipts, disagreements, auditEvents: seedAuditEvents(disagreements), updatedAt: new Date().toISOString(),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function validData(value: unknown): value is FairShiftData {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.receipts) || !Array.isArray(value.disagreements) || !Array.isArray(value.auditEvents) || !Array.isArray(value.workers) || !Array.isArray(value.worksites)) return false
  const receiptIds = new Set<string>()
  for (const r of value.receipts as unknown[]) {
    if (!isRecord(r) || typeof r.id !== 'string' || receiptIds.has(r.id) || typeof r.workerName !== 'string' || typeof r.workerId !== 'string' || !INDUSTRIES.includes(r.industry as Industry) || typeof r.workDescription !== 'string' || typeof r.worksite !== 'string' || typeof r.workerReportedHours !== 'number' || !Number.isFinite(r.workerReportedHours) || typeof r.employerReportedHours !== 'number' || !Number.isFinite(r.employerReportedHours) || typeof r.hourlyRate !== 'number' || !Number.isFinite(r.hourlyRate)) return false
    receiptIds.add(r.id)
  }
  const caseIds = new Set<string>()
  for (const c of value.disagreements as unknown[]) {
    if (!isRecord(c) || typeof c.id !== 'string' || caseIds.has(c.id) || typeof c.receiptId !== 'string' || !receiptIds.has(c.receiptId) || !Array.isArray(c.activity) || !Array.isArray(c.evidenceDescriptions)) return false
    caseIds.add(c.id)
  }
  const auditIds = new Set<string>()
  for (const e of value.auditEvents as unknown[]) {
    if (!isRecord(e) || typeof e.id !== 'string' || auditIds.has(e.id) || typeof e.caseId !== 'string' || !caseIds.has(e.caseId) || typeof e.receiptId !== 'string' || !receiptIds.has(e.receiptId) || typeof e.at !== 'string' || typeof e.summary !== 'string') return false
    auditIds.add(e.id)
  }
  return true
}

function normalizeData(data: FairShiftData): FairShiftData {
  const receipts = uniqueById(data.receipts)
  const receiptIds = new Set(receipts.map((r) => r.id))
  const disagreements = uniqueById(data.disagreements).filter((c) => receiptIds.has(c.receiptId))
  const caseIds = new Set(disagreements.map((c) => c.id))
  const auditEvents = uniqueById(data.auditEvents).filter((e) => caseIds.has(e.caseId) && receiptIds.has(e.receiptId)).sort((a, b) => a.at.localeCompare(b.at))
  const derivedWorkers = workersFor(receipts)
  const derivedWorksites = worksitesFor(receipts)
  return { ...data, schemaVersion: 1, industries: INDUSTRIES, receipts, disagreements, auditEvents,
    workers: uniqueById([...(Array.isArray(data.workers) ? data.workers : []), ...derivedWorkers]),
    worksites: uniqueById([...(Array.isArray(data.worksites) ? data.worksites : []), ...derivedWorksites]), updatedAt: data.updatedAt || new Date().toISOString() }
}

export function loadAppData(): { data: FairShiftData; storageAvailable: boolean; recovered: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      if (validData(parsed)) return { data: normalizeData(parsed), storageAvailable: true, recovered: false }
      return { data: createSeedData(), storageAvailable: true, recovered: true }
    }
    // One-time migration from the Stage 1–4 split keys.
    const oldReceipts = window.localStorage.getItem('fairshift.workReceipts.v1')
    const oldCases = window.localStorage.getItem('fairshift.disagreements.v1')
    const oldAudit = window.localStorage.getItem('fairshift.resolutionAudit.v1')
    if (oldReceipts || oldCases || oldAudit) {
      const seeded = createSeedData()
      let receipts = seeded.receipts
      let disagreements = seeded.disagreements
      let auditEvents = seeded.auditEvents
      try { const v: unknown = oldReceipts ? JSON.parse(oldReceipts) : null; if (Array.isArray(v) && v.every((r) => isRecord(r) && typeof r.id === 'string')) receipts = uniqueById([...(v as WorkReceipt[]), ...seeded.receipts]) } catch { /* recover using seeds */ }
      try { const v: unknown = oldCases ? JSON.parse(oldCases) : null; if (Array.isArray(v) && v.every((c) => isRecord(c) && typeof c.id === 'string')) disagreements = uniqueById([...(v as DisagreementCase[]), ...seeded.disagreements]).filter((c) => receipts.some((r) => r.id === c.receiptId)) } catch { /* recover using seeds */ }
      try { const v: unknown = oldAudit ? JSON.parse(oldAudit) : null; if (Array.isArray(v) && v.every((e) => isRecord(e) && typeof e.id === 'string')) auditEvents = uniqueById([...(v as ResolutionAuditEvent[]), ...seeded.auditEvents]).filter((e) => disagreements.some((c) => c.id === e.caseId) && receipts.some((r) => r.id === e.receiptId)) } catch { /* recover using seeds */ }
      return { data: normalizeData({ ...seeded, receipts, disagreements, auditEvents, workers: workersFor(receipts), worksites: worksitesFor(receipts) }), storageAvailable: true, recovered: true }
    }
    return { data: createSeedData(), storageAvailable: true, recovered: false }
  } catch { return { data: createSeedData(), storageAvailable: false, recovered: true } }
}

export function saveAppData(data: FairShiftData): boolean {
  try {
    const normalized = normalizeData({ ...data, updatedAt: new Date().toISOString() })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    return true
  } catch { return false }
}
export function resetAppData(): FairShiftData { return createSeedData() }
export const sharedStorageKey = STORAGE_KEY
