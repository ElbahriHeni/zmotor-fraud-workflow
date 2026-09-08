export type CaseStatus =
  | 'New'
  | 'Under Review'
  | 'Under Investigation'
  | 'Pending Information'
  | 'Fraud Confirmed'
  | 'Rejected'
  | 'Closed';

export type PriorityLevel = 'High' | 'Medium' | 'Low';

export interface FraudIndicator {
  fraudIndicatorType: string;
  indicatorDescription: string;
  occurrenceCount: number;
  riskScore: number;
  systemRecommendation: string;
}

export interface CaseAttachment {
  id: string;
  fileName: string;
  fileType: string;
}

export interface AssignmentHistoryEntry {
  previousUser: string | null;
  newUser: string | null;
  changedBy: string;
  changeDate: string;
  changeReason: string;
}

export interface FraudCase {
  id: string;
  claimId: string;
  caseType: string;
  caseSource: string;
  priorityLevel: PriorityLevel;
  caseStatus: CaseStatus;
  assignedUser: string | null;
  assignmentDate: string;
  assignedBy: string;
  reassignmentReason: string;
  caseEntryDate: string;
  closureDate: string;
  closureReason: string;
  insuranceType: string;
  suspectedAmount: string;
  fraudUnitNotes: string;

  reporterName: string;
  reporterEmail: string;
  reporterMobile: string;
  nationalIdOrIqama: string;
  submissionDetails: string;
  consentToTermsAndPrivacy: boolean;
  attachments: CaseAttachment[];

  fraudIndicator: FraudIndicator;

  claimType: string;
  fraudConfirmedDate: string;
  fraudDetectionMethod: string;
  fraudAmount: string;
  actionTaken: string;
  referredEntity: string;

  assignmentHistory: AssignmentHistoryEntry[];
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  mobile: string;
  role: string;
  status: 'Active' | 'Inactive';
  creationDate: string;
}

export interface KpiCard {
  title: string;
  value: string;
  subtitle?: string;
}
