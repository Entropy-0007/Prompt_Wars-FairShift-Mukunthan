import type { DisagreementCase, DisagreementStatus, ResolutionAuditEvent, Role, WorkReceipt } from './receiptTypes'

const STORAGE_KEY = 'fairshift.resolutionAudit.v1'
const identities: Record<Role, string> = { Worker: 'Arun Kumar (demo worker)', Employer: 'R. Subramanian (demo site supervisor)', Reviewer: 'Priya Nair (demo reviewer)' }

export function actorIdentity(role: Role): string { return identities[role] }
export function nextAuditId(events: ResolutionAuditEvent[]): string {
  const largest = events.reduce((max, event) => {
    const match = event.id.match(/^AUD-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `AUD-${String(largest + 1).padStart(5, '0')}`
}
export function makeAuditEvent(events: ResolutionAuditEvent[], item: DisagreementCase, role: Role | 'System', actionType: string, summary: string, previousValues?: Record<string, string | number | null>, newValues?: Record<string, string | number | null>): ResolutionAuditEvent {
  return { id: nextAuditId(events), caseId: item.id, receiptId: item.receiptId, actionType, actorRole: role, actorIdentity: role === 'System' ? 'FairShift application' : identities[role], at: new Date().toISOString(), summary, ...(previousValues ? { previousValues } : {}), ...(newValues ? { newValues } : {}) }
}
function validEvent(value: unknown): value is ResolutionAuditEvent {
  if (!value || typeof value !== 'object') return false
  const e = value as Partial<ResolutionAuditEvent>
  return typeof e.id === 'string' && typeof e.caseId === 'string' && typeof e.receiptId === 'string' && typeof e.actionType === 'string' && typeof e.actorIdentity === 'string' && typeof e.at === 'string' && typeof e.summary === 'string'
}
export function loadAuditEvents(): { events: ResolutionAuditEvent[]; storageAvailable: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { events: [], storageAvailable: true }
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every(validEvent) ? { events: parsed, storageAvailable: true } : { events: [], storageAvailable: true }
  } catch { return { events: [], storageAvailable: false } }
}
export function saveAuditEvents(events: ResolutionAuditEvent[]): boolean {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); return true } catch { return false }
}
export function normalizeCaseStatus(status: DisagreementStatus): DisagreementStatus {
  if (status === 'Unresolved') return 'Submitted'
  if (status === 'Clarification requested') return 'Awaiting Response'
  if (status === 'Ready for review') return 'Under Review'
  if (status === 'Outcome documented') return 'Resolved'
  return status
}
export function appendCaseUpdate(item: DisagreementCase, status: DisagreementStatus, action: string, note: string, actor: Role | 'System' = 'System'): DisagreementCase {
  const at = new Date().toISOString()
  return { ...item, status, latestUpdate: note, activity: [...item.activity, { id: `${item.id}-ACT-${item.activity.length + 1}`, at, actor, action, note }] }
}
export function createCorrectedReceipt(original: WorkReceipt, id: string, caseId: string, workerHours: number, employerHours: number, reason: string): WorkReceipt {
  return {
    ...original, id, workerReportedHours: workerHours, employerReportedHours: employerHours,
    workerConfirmation: 'Pending', employerConfirmation: 'Pending',
    status: 'Needs attention',
    createdAt: new Date().toISOString(), resolvedAt: undefined,
    supersedesReceiptId: original.id, correctionReason: reason, correctionStatus: 'Proposed', disagreementCaseId: caseId,
  }
}
export function seedAuditEvents(cases: DisagreementCase[]): ResolutionAuditEvent[] {
  const result: ResolutionAuditEvent[] = []
  for (const item of cases) {
    const history = item.activity.length ? item.activity : [{ id: `${item.id}-seed`, at: item.createdAt, actor: item.reportingParty, action: 'Dispute submitted', note: 'Both reported claims remain visible.' }]
    history.forEach((entry, index) => {
      const role = entry.actor === 'System' ? 'System' : entry.actor
      result.push({
        id: `AUD-SEED-${item.id}-${index + 1}`, caseId: item.id, receiptId: item.receiptId,
        actionType: index === 0 ? 'dispute.submitted' : 'case.history_migrated',
        actorRole: role, actorIdentity: role === 'System' ? 'FairShift application' : identities[role],
        at: entry.at, summary: `${entry.action}: ${entry.note}`,
      })
    })
  }
  return result.sort((a, b) => a.at.localeCompare(b.at))
}
