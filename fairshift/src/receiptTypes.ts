export type Role = 'Worker' | 'Employer' | 'Reviewer'
export type Page = 'Overview' | 'Work Receipts' | 'Disagreements' | 'Resolution Trail'
export type Industry = 'Construction' | 'Contract Housekeeping'
export type ConfirmationStatus = 'Pending' | 'Confirmed'
export type ReceiptStatus = 'Needs attention' | 'Recorded' | 'Resolved'

export interface WorkReceipt {
  id: string
  workerName: string
  workerId: string
  industry: Industry
  workDescription: string
  worksite: string
  shiftDate: string
  employerReportedHours: number
  workerReportedHours: number
  hourlyRate: number
  overtimeRate: number | null
  overtimeThreshold: number | null
  breakDurationHours: number
  workerConfirmation: ConfirmationStatus
  employerConfirmation: ConfirmationStatus
  status: ReceiptStatus
  createdAt: string
  resolvedAt?: string
  supersedesReceiptId?: string
  correctionReason?: string
  correctionStatus?: 'Proposed' | 'Recorded'
  disagreementCaseId?: string
}

export interface ReceiptDraft {
  workerName: string
  workerId: string
  industry: Industry
  workDescription: string
  worksite: string
  shiftDate: string
  employerReportedHours: number
  workerReportedHours: number
  hourlyRate: number
  overtimeRate: number | null
  overtimeThreshold: number | null
  breakDurationHours: number
}

export interface PayBreakdown {
  reported: number
  break: number
  net: number
  regular: number
  overtime: number
  regularPay: number
  overtimePay: number
  total: number
}

export type DisputeIssue = 'Missing hours' | 'Incorrect rate' | 'Overtime' | 'Incorrect shift' | 'Other issue'
export type DisagreementStatus = 'Submitted' | 'Under Review' | 'Awaiting Response' | 'Resolved' | 'Contested' | 'Unresolved' | 'Clarification requested' | 'Ready for review' | 'Outcome documented'
export type ReportingParty = 'Worker' | 'Employer'
export interface DisagreementActivity {
  id: string
  at: string
  actor: ReportingParty | 'Reviewer' | 'System'
  action: string
  note: string
}
export interface DisagreementCase {
  id: string
  receiptId: string
  reportingParty: ReportingParty
  disputedField: string
  issue: DisputeIssue
  workerClaim: string
  employerClaim: string
  difference: number | null
  differenceUnit: string | null
  reason: string
  evidenceDescriptions: string[]
  createdAt: string
  status: DisagreementStatus
  activity: DisagreementActivity[]
  employerResponse?: string
  reviewer?: string
  latestUpdate?: string
  outstandingAction?: string
  outcome?: string
  outcomeReason?: string
  evidenceBasis?: string
  correctedReceiptId?: string
  contestedReason?: string
}

export type AuditActorRole = Role | 'System'
export interface ResolutionAuditEvent {
  id: string
  caseId: string
  receiptId: string
  actionType: string
  actorRole: AuditActorRole
  actorIdentity: string
  at: string
  summary: string
  previousValues?: Record<string, string | number | null>
  newValues?: Record<string, string | number | null>
}

export interface DisagreementDraft {
  issue: DisputeIssue
  reason: string
  evidence: string
}


export interface WorkerRecord { id: string; name: string; industry: Industry; phoneLabel: string }
export interface WorksiteRecord { id: string; name: string; industry: Industry; addressLabel: string }
export interface FairShiftData {
  schemaVersion: 1
  workers: WorkerRecord[]
  worksites: WorksiteRecord[]
  industries: Industry[]
  receipts: WorkReceipt[]
  disagreements: DisagreementCase[]
  auditEvents: ResolutionAuditEvent[]
  updatedAt: string
}
