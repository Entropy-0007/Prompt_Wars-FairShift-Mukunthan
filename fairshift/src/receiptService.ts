import type { PayBreakdown, ReceiptDraft, ReceiptStatus, WorkReceipt } from './receiptTypes'

const STORAGE_KEY = 'fairshift.workReceipts.v1'

function statusFor(workerHours: number, employerHours: number, resolved = false): ReceiptStatus {
  if (workerHours !== employerHours) return 'Needs attention'
  return resolved ? 'Resolved' : 'Recorded'
}

export function createDemoReceipts(): WorkReceipt[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'FR-0248', workerName: 'Arun Kumar', workerId: 'WK-1001', industry: 'Construction',
      workDescription: 'Site preparation', worksite: 'Block C', shiftDate: '2026-10-27',
      employerReportedHours: 8, workerReportedHours: 10, hourlyRate: 100, overtimeRate: 150,
      overtimeThreshold: 8, breakDurationHours: 0, workerConfirmation: 'Pending', employerConfirmation: 'Pending',
      status: 'Needs attention', createdAt: now,
    },
    {
      id: 'FR-0247', workerName: 'Meena Devi', workerId: 'WK-1002', industry: 'Contract Housekeeping',
      workDescription: 'Common areas', worksite: 'Tower 2', shiftDate: '2026-10-27',
      employerReportedHours: 5, workerReportedHours: 5, hourlyRate: 100, overtimeRate: null,
      overtimeThreshold: null, breakDurationHours: 0, workerConfirmation: 'Pending', employerConfirmation: 'Pending',
      status: 'Recorded', createdAt: now,
    },
    {
      id: 'FR-0243', workerName: 'Lakshmi Ravi', workerId: 'WK-1003', industry: 'Contract Housekeeping',
      workDescription: 'Lobby and lift cleaning', worksite: 'Tower 1', shiftDate: '2026-10-26',
      employerReportedHours: 5, workerReportedHours: 6, hourlyRate: 100, overtimeRate: null,
      overtimeThreshold: null, breakDurationHours: 0, workerConfirmation: 'Pending', employerConfirmation: 'Pending',
      status: 'Needs attention', createdAt: now,
    },
    {
      id: 'FR-0242', workerName: 'Arun Kumar', workerId: 'WK-1001', industry: 'Construction',
      workDescription: 'Material unloading', worksite: 'Block B', shiftDate: '2026-10-24',
      employerReportedHours: 7.5, workerReportedHours: 7.5, hourlyRate: 100, overtimeRate: 150,
      overtimeThreshold: 8, breakDurationHours: 0, workerConfirmation: 'Confirmed', employerConfirmation: 'Confirmed',
      status: 'Resolved', createdAt: now, resolvedAt: '2026-10-25T12:00:00.000Z',
    },
  ]
}

function isReceipt(value: unknown): value is WorkReceipt {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<WorkReceipt>
  return typeof item.id === 'string' && typeof item.workerName === 'string' &&
    typeof item.workerId === 'string' && typeof item.workDescription === 'string' &&
    typeof item.worksite === 'string' && typeof item.shiftDate === 'string' &&
    typeof item.workerReportedHours === 'number' && Number.isFinite(item.workerReportedHours) &&
    typeof item.employerReportedHours === 'number' && Number.isFinite(item.employerReportedHours) &&
    typeof item.hourlyRate === 'number' && Number.isFinite(item.hourlyRate) &&
    (item.overtimeRate === null || (typeof item.overtimeRate === 'number' && Number.isFinite(item.overtimeRate))) &&
    (item.overtimeThreshold === null || (typeof item.overtimeThreshold === 'number' && Number.isFinite(item.overtimeThreshold))) &&
    typeof item.breakDurationHours === 'number' && Number.isFinite(item.breakDurationHours) &&
    (item.workerConfirmation === 'Pending' || item.workerConfirmation === 'Confirmed') &&
    (item.employerConfirmation === 'Pending' || item.employerConfirmation === 'Confirmed') &&
    typeof item.createdAt === 'string' &&
    (item.industry === 'Construction' || item.industry === 'Contract Housekeeping') &&
    (item.status === 'Needs attention' || item.status === 'Recorded' || item.status === 'Resolved')
}

export function loadReceipts(): { receipts: WorkReceipt[]; storageAvailable: boolean } {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.every(isReceipt)) {
        return { receipts: parsed, storageAvailable: true }
      }
    }
    return { receipts: createDemoReceipts(), storageAvailable: true }
  } catch {
    return { receipts: createDemoReceipts(), storageAvailable: false }
  }
}

export function saveReceipts(receipts: WorkReceipt[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts))
    return true
  } catch {
    return false
  }
}

export function nextReceiptId(receipts: WorkReceipt[]): string {
  const largest = receipts.reduce((max, receipt) => {
    const match = receipt.id.match(/^FR-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return `FR-${String(largest + 1).padStart(4, '0')}`
}

export function makeReceipt(draft: ReceiptDraft, id: string): WorkReceipt {
  return {
    ...draft,
    id,
    workerConfirmation: 'Pending',
    employerConfirmation: 'Pending',
    status: statusFor(draft.workerReportedHours, draft.employerReportedHours),
    createdAt: new Date().toISOString(),
  }
}

export function confirmAccount(receipt: WorkReceipt, role: 'Worker' | 'Employer'): WorkReceipt {
  const updated = role === 'Worker'
    ? { ...receipt, workerConfirmation: 'Confirmed' as const }
    : { ...receipt, employerConfirmation: 'Confirmed' as const }
  // Confirmation records that side's own account; it never settles a mismatch.
  updated.status = statusFor(updated.workerReportedHours, updated.employerReportedHours, Boolean(updated.resolvedAt))
  return updated
}


export function calculatePay(receipt: WorkReceipt, reportedHours: number): PayBreakdown {
  const net = Math.max(0, reportedHours - receipt.breakDurationHours)
  const hasOvertimeTerms = receipt.overtimeRate !== null && receipt.overtimeThreshold !== null
  const regular = hasOvertimeTerms ? Math.min(net, receipt.overtimeThreshold as number) : net
  const overtime = hasOvertimeTerms ? Math.max(0, net - (receipt.overtimeThreshold as number)) : 0
  const regularPay = regular * receipt.hourlyRate
  const overtimePay = overtime * (hasOvertimeTerms ? receipt.overtimeRate as number : receipt.hourlyRate)
  return { reported: reportedHours, break: receipt.breakDurationHours, net, regular, overtime, regularPay, overtimePay, total: regularPay + overtimePay }
}
