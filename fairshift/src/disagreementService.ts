import type { DisagreementCase, DisagreementDraft, DisagreementStatus, DisputeIssue, ReportingParty, WorkReceipt } from './receiptTypes'

const STORAGE_KEY = 'fairshift.disagreements.v1'
const issueLabels: Record<DisputeIssue, string> = {
  'Missing hours': 'Shift hours', 'Incorrect rate': 'Hourly rate', Overtime: 'Overtime hours and terms',
  'Incorrect shift': 'Shift date / shift details', 'Other issue': 'Other receipt details',
}
function initialCase(receipt: WorkReceipt, id: string, reason: string): DisagreementCase {
  const at = new Date().toISOString()
  return {
    id, receiptId: receipt.id, reportingParty: 'Worker', issue: 'Missing hours', disputedField: 'Shift hours',
    workerClaim: `${receipt.workerReportedHours} hours`, employerClaim: `${receipt.employerReportedHours} hours`,
    difference: Math.abs(receipt.workerReportedHours - receipt.employerReportedHours), differenceUnit: 'hours',
    reason, evidenceDescriptions: ['No supporting evidence described yet.'], createdAt: at, status: 'Submitted',
    activity: [{ id: `${id}-ACT-1`, at, actor: 'System', action: 'Disagreement recorded', note: 'Both reported values were copied from the linked work receipt. Neither claim is treated as accepted.' }],
  }
}
export function createDemoDisagreements(receipts: WorkReceipt[]): DisagreementCase[] {
  const construction = receipts.find((item) => item.id === 'FR-0248') ?? receipts.find((item) => item.workerReportedHours !== item.employerReportedHours && item.industry === 'Construction')
  const housekeeping = receipts.find((item) => item.id === 'FR-0243') ?? receipts.find((item) => item.workerReportedHours !== item.employerReportedHours && item.industry === 'Contract Housekeeping')
  const cases: DisagreementCase[] = []
  if (construction) cases.push(initialCase(construction, 'DL-0001', 'The worker reports two additional hours of site preparation that are not included in the employer’s account.'))
  if (housekeeping) {
    const rateCase = initialCase(housekeeping, 'DL-0002', 'The worker reports an hourly rate of ₹110, while the employer-recorded rate is ₹100. The rate difference is a demo claim and has not been independently corroborated.')
    rateCase.issue = 'Incorrect rate'
    rateCase.disputedField = 'Hourly rate'
    rateCase.workerClaim = '₹110/hour · worker-reported claim'
    rateCase.employerClaim = '₹100/hour · employer-recorded rate'
    rateCase.difference = 10
    rateCase.differenceUnit = '₹/hour'
    rateCase.activity = [{ ...rateCase.activity[0], note: 'The worker-reported rate and employer-recorded rate are preserved separately. Neither rate is accepted automatically.' }]
    cases.push(rateCase)
  }
  return cases
}
function isCase(value: unknown): value is DisagreementCase {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<DisagreementCase>
  return typeof item.id === 'string' && typeof item.receiptId === 'string' &&
    (item.reportingParty === 'Worker' || item.reportingParty === 'Employer') && typeof item.disputedField === 'string' &&
    typeof item.workerClaim === 'string' && typeof item.employerClaim === 'string' && typeof item.reason === 'string' &&
    typeof item.createdAt === 'string' && Array.isArray(item.evidenceDescriptions) && item.evidenceDescriptions.every((v) => typeof v === 'string') &&
    Array.isArray(item.activity) && item.activity.every((a) => a && typeof a.id === 'string' && typeof a.at === 'string' && typeof a.action === 'string') &&
    ['Submitted', 'Under Review', 'Awaiting Response', 'Resolved', 'Contested', 'Unresolved', 'Clarification requested', 'Ready for review', 'Outcome documented'].includes(item.status ?? '')
}
export function loadDisagreements(receipts: WorkReceipt[]): { cases: DisagreementCase[]; storageAvailable: boolean } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every(isCase)) return { cases: parsed.filter((item) => receipts.some((r) => r.id === item.receiptId)), storageAvailable: true }
    }
    return { cases: createDemoDisagreements(receipts), storageAvailable: true }
  } catch { return { cases: createDemoDisagreements(receipts), storageAvailable: false } }
}
export function saveDisagreements(cases: DisagreementCase[]): boolean {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases)); return true } catch { return false }
}
export function nextDisagreementId(cases: DisagreementCase[]): string {
  const largest = cases.reduce((max, item) => { const match = item.id.match(/^DL-(\d+)$/); return match ? Math.max(max, Number(match[1])) : max }, 0)
  return `DL-${String(largest + 1).padStart(4, '0')}`
}
function claimFor(issue: DisputeIssue, receipt: WorkReceipt, side: ReportingParty): { field: string; claim: string; difference: number | null; unit: string | null } {
  if (issue === 'Incorrect rate') { const rate = `${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(receipt.hourlyRate)}/hour`; return { field: issueLabels[issue], claim: side === 'Worker' ? `Worker disputes the recorded rate (${rate}); see explanation` : `${rate} (recorded rate)`, difference: null, unit: null } }
  if (issue === 'Incorrect shift') return { field: issueLabels[issue], claim: side === 'Worker' ? 'Worker disputes the recorded shift details; see explanation' : `${receipt.shiftDate} · ${receipt.workDescription} at ${receipt.worksite} (recorded)`, difference: null, unit: null }
  if (issue === 'Other issue') return { field: issueLabels[issue], claim: side === 'Worker' ? 'Worker disputes receipt details; see explanation' : `${receipt.workDescription} · ${receipt.worksite} (recorded)`, difference: null, unit: null }
  const reportedHours = side === 'Worker' ? receipt.workerReportedHours : receipt.employerReportedHours
  if (issue === 'Overtime' && receipt.overtimeThreshold === null) return { field: issueLabels[issue], claim: `${reportedHours} reported hours; no overtime threshold recorded`, difference: null, unit: null }
  const hours = issue === 'Overtime' ? Math.max(0, reportedHours - (receipt.overtimeThreshold as number)) : reportedHours
  return { field: issueLabels[issue], claim: `${hours} hours`, difference: null, unit: 'hours' }
}
export function makeDisagreement(draft: DisagreementDraft, receipt: WorkReceipt, id: string, reportingParty: ReportingParty): DisagreementCase {
  const worker = claimFor(draft.issue, receipt, 'Worker')
  const employer = claimFor(draft.issue, receipt, 'Employer')
  const at = new Date().toISOString()
  const evidence = draft.evidence.trim() ? [draft.evidence.trim()] : ['No supporting evidence described yet.']
  const quantifiable = /^\d+(?:\.\d+)? hours$/.test(worker.claim) && /^\d+(?:\.\d+)? hours$/.test(employer.claim)
  const difference = quantifiable ? Math.abs(Number(worker.claim.split(' ')[0]) - Number(employer.claim.split(' ')[0])) : null
  return {
    id, receiptId: receipt.id, reportingParty, issue: draft.issue, disputedField: worker.field,
    workerClaim: worker.claim, employerClaim: employer.claim,
    difference,
    differenceUnit: difference === null ? null : 'hours', reason: draft.reason.trim(), evidenceDescriptions: evidence,
    createdAt: at, status: 'Submitted', activity: [{ id: `${id}-ACT-1`, at, actor: reportingParty, action: 'Dispute submitted', note: draft.reason.trim() || 'No additional explanation provided.' }],
  }
}
export function addActivity(item: DisagreementCase, actor: ReportingParty, action: string, note: string, status?: DisagreementStatus): DisagreementCase {
  const at = new Date().toISOString()
  return { ...item, ...(status ? { status } : {}), activity: [...item.activity, { id: `${item.id}-ACT-${item.activity.length + 1}`, at, actor, action, note }] }
}
