import { FraudCase, KpiCard, User } from '../types';

export const dashboardCards: KpiCard[] = [
  { title: 'Total Cases', value: '248', subtitle: '+12 this week' },
  { title: 'New Cases', value: '19', subtitle: 'Awaiting assignment' },
  { title: 'Cases Under Investigation', value: '37', subtitle: 'Active workload' },
  { title: 'Confirmed Fraud Cases', value: '14', subtitle: 'This month' },
  { title: 'Unassigned Cases', value: '8', subtitle: 'Shared queue' },
  { title: 'High Priority Cases', value: '11', subtitle: 'Immediate review' },
];

export const fraudCases: FraudCase[] = [
  {
    id: 'FC-1001',
    claimId: 'CL-90811',
    caseType: 'Fraud Suspected',
    caseSource: 'Whistleblowing',
    priorityLevel: 'High',
    caseStatus: 'New',
    assignedUser: null,
    assignmentDate: '',
    assignedBy: '',
    reassignmentReason: '',
    caseEntryDate: '2026-04-06',
    closureDate: '',
    closureReason: '',
    insuranceType: 'Motor',
    suspectedAmount: 'SAR 18,000',
    fraudUnitNotes: 'External submission pending review.',

    reporterName: 'Ahmed Ali',
    reporterEmail: 'ahmed@email.com',
    reporterMobile: '0560449189',
    nationalIdOrIqama: 'National Id / Iqama',
    submissionDetails:
      'Caller reported suspicious repeated repair claims with inconsistent workshop quotations and possible duplicate supporting documents.',
    consentToTermsAndPrivacy: true,
    attachments: [
      { id: 'ATT-001', fileName: 'police-report.pdf', fileType: 'PDF' },
      { id: 'ATT-002', fileName: 'quotation.png', fileType: 'PNG' },
    ],

    fraudIndicator: {
      fraudIndicatorType: 'Duplicate Claims',
      indicatorDescription: 'Potential duplicate claims submitted within a short period.',
      occurrenceCount: 3,
      riskScore: 92,
      systemRecommendation: 'Escalate for full investigation',
    },

    claimType: 'Reimbursement',
    fraudConfirmedDate: '',
    fraudDetectionMethod: 'Manual Review + AI Indicator',
    fraudAmount: 'SAR 18,000',
    actionTaken: '',
    referredEntity: '',

    assignmentHistory: [
      {
        previousUser: null,
        newUser: null,
        changedBy: 'System',
        changeDate: '2026-04-06 09:15',
        changeReason: 'Case created from external website form',
      },
    ],
  },
  {
    id: 'FC-1002',
    claimId: 'CL-90321',
    caseType: 'Fraud Confirmed',
    caseSource: 'Internal',
    priorityLevel: 'High',
    caseStatus: 'Fraud Confirmed',
    assignedUser: 'Fatimah Salem',
    assignmentDate: '2026-04-04 10:30',
    assignedBy: 'Mohammed Hassan',
    reassignmentReason: 'Assigned to specialist with medical fraud experience',
    caseEntryDate: '2026-04-04',
    closureDate: '2026-04-08',
    closureReason: 'Fraud confirmed',
    insuranceType: 'Medical',
    suspectedAmount: 'SAR 42,500',
    fraudUnitNotes: 'Mismatch between invoices and provider records.',

    reporterName: 'Internal Team',
    reporterEmail: 'internal@company.com',
    reporterMobile: 'N/A',
    nationalIdOrIqama: 'N/A',
    submissionDetails:
      'Internal review identified invoice duplication and provider coding mismatch across multiple claim submissions.',
    consentToTermsAndPrivacy: true,
    attachments: [
      { id: 'ATT-003', fileName: 'invoice-comparison.xlsx', fileType: 'XLSX' },
      { id: 'ATT-004', fileName: 'provider-audit.pdf', fileType: 'PDF' },
    ],

    fraudIndicator: {
      fraudIndicatorType: 'Billing Pattern Anomaly',
      indicatorDescription: 'Repeated billing mismatch and duplicated medical invoice amounts.',
      occurrenceCount: 5,
      riskScore: 96,
      systemRecommendation: 'Confirm fraud and escalate',
    },

    claimType: 'Medical Reimbursement',
    fraudConfirmedDate: '2026-04-06',
    fraudDetectionMethod: 'Manual Review + AI Indicator',
    fraudAmount: 'SAR 42,500',
    actionTaken: 'Escalated to legal and compliance',
    referredEntity: 'Compliance Department',

    assignmentHistory: [
      {
        previousUser: null,
        newUser: 'Mohammed Hassan',
        changedBy: 'System',
        changeDate: '2026-04-04 08:10',
        changeReason: 'Case created from internal channel',
      },
      {
        previousUser: 'Mohammed Hassan',
        newUser: 'Fatimah Salem',
        changedBy: 'Mohammed Hassan',
        changeDate: '2026-04-04 10:30',
        changeReason: 'Assigned to specialist with medical fraud experience',
      },
    ],
  },
  {
    id: 'FC-1003',
    claimId: 'CL-90201',
    caseType: 'Violation',
    caseSource: 'Website',
    priorityLevel: 'Medium',
    caseStatus: 'Under Review',
    assignedUser: 'Mohammed Hassan',
    assignmentDate: '2026-04-03 11:20',
    assignedBy: 'Fatimah Salem',
    reassignmentReason: 'Shared queue handoff',
    caseEntryDate: '2026-04-03',
    closureDate: '',
    closureReason: '',
    insuranceType: 'Motor',
    suspectedAmount: 'SAR 7,200',
    fraudUnitNotes: 'Needs policy verification.',

    reporterName: 'Sara Omar',
    reporterEmail: 'sara@email.com',
    reporterMobile: '0551234567',
    nationalIdOrIqama: '2345678901',
    submissionDetails:
      'Submitted complaint regarding possible policy misuse and unsupported accident description.',
    consentToTermsAndPrivacy: true,
    attachments: [{ id: 'ATT-005', fileName: 'accident-photo.jpg', fileType: 'JPG' }],

    fraudIndicator: {
      fraudIndicatorType: 'Policy Mismatch',
      indicatorDescription: 'Claim scenario does not fully align with active policy conditions.',
      occurrenceCount: 2,
      riskScore: 68,
      systemRecommendation: 'Review policy and request clarification',
    },

    claimType: 'Motor Claim',
    fraudConfirmedDate: '',
    fraudDetectionMethod: 'Manual Review',
    fraudAmount: 'SAR 7,200',
    actionTaken: '',
    referredEntity: '',

    assignmentHistory: [
      {
        previousUser: null,
        newUser: 'Mohammed Hassan',
        changedBy: 'Fatimah Salem',
        changeDate: '2026-04-03 11:20',
        changeReason: 'Self-assigned from shared queue',
      },
    ],
  },
  {
    id: 'FC-1004',
    claimId: 'CL-90012',
    caseType: 'Fraud Suspected',
    caseSource: 'Call Center',
    priorityLevel: 'Low',
    caseStatus: 'Pending Information',
    assignedUser: 'Noura Khaled',
    assignmentDate: '2026-04-01 14:00',
    assignedBy: 'System',
    reassignmentReason: '',
    caseEntryDate: '2026-04-01',
    closureDate: '',
    closureReason: '',
    insuranceType: 'Property',
    suspectedAmount: 'SAR 3,100',
    fraudUnitNotes: 'Waiting for supporting attachments.',

    reporterName: 'Call Center Agent',
    reporterEmail: 'agent@company.com',
    reporterMobile: 'N/A',
    nationalIdOrIqama: 'N/A',
    submissionDetails:
      'Customer reported suspicious damage chronology but no supporting evidence has been received yet.',
    consentToTermsAndPrivacy: true,
    attachments: [],

    fraudIndicator: {
      fraudIndicatorType: 'Incomplete Evidence',
      indicatorDescription: 'Initial fraud suspicion exists, but evidence is still incomplete.',
      occurrenceCount: 1,
      riskScore: 40,
      systemRecommendation: 'Request supporting documents',
    },

    claimType: 'Property Claim',
    fraudConfirmedDate: '',
    fraudDetectionMethod: 'Call Center Escalation',
    fraudAmount: 'SAR 3,100',
    actionTaken: '',
    referredEntity: '',

    assignmentHistory: [
      {
        previousUser: null,
        newUser: 'Noura Khaled',
        changedBy: 'System',
        changeDate: '2026-04-01 14:00',
        changeReason: 'Assigned from call center intake',
      },
    ],
  },
  {
    id: 'FC-1005',
    claimId: 'CL-89988',
    caseType: 'Fraud Suspected',
    caseSource: 'Website',
    priorityLevel: 'High',
    caseStatus: 'Under Investigation',
    assignedUser: 'Abdullah Saad',
    assignmentDate: '2026-03-30 09:40',
    assignedBy: 'Noura Khaled',
    reassignmentReason: 'Transferred for field follow-up',
    caseEntryDate: '2026-03-30',
    closureDate: '',
    closureReason: '',
    insuranceType: 'Medical',
    suspectedAmount: 'SAR 24,750',
    fraudUnitNotes: 'AI indicator score is high.',

    reporterName: 'Anonymous',
    reporterEmail: 'n/a',
    reporterMobile: 'n/a',
    nationalIdOrIqama: 'n/a',
    submissionDetails:
      'Anonymous reporter flagged repeated high-value reimbursement requests linked to the same provider.',
    consentToTermsAndPrivacy: true,
    attachments: [
      { id: 'ATT-006', fileName: 'claim-history.pdf', fileType: 'PDF' },
      { id: 'ATT-007', fileName: 'provider-note.docx', fileType: 'DOCX' },
    ],

    fraudIndicator: {
      fraudIndicatorType: 'High Value Repetition',
      indicatorDescription: 'Repeated high-value submissions tied to one provider and one member profile.',
      occurrenceCount: 4,
      riskScore: 89,
      systemRecommendation: 'Continue full investigation',
    },

    claimType: 'Medical Reimbursement',
    fraudConfirmedDate: '',
    fraudDetectionMethod: 'AI Indicator',
    fraudAmount: 'SAR 24,750',
    actionTaken: '',
    referredEntity: '',

    assignmentHistory: [
      {
        previousUser: null,
        newUser: 'Noura Khaled',
        changedBy: 'System',
        changeDate: '2026-03-30 08:15',
        changeReason: 'Case created from external website form',
      },
      {
        previousUser: 'Noura Khaled',
        newUser: 'Abdullah Saad',
        changedBy: 'Noura Khaled',
        changeDate: '2026-03-30 09:40',
        changeReason: 'Transferred for field follow-up',
      },
    ],
  },
];

export const users: User[] = [
  { id: 'U-001', fullName: 'Fatimah Salem', username: 'fsalem', email: 'fatimah@fraud.sa', mobile: '0500000001', role: 'Fraud Team Member', status: 'Active', creationDate: '2026-01-10' },
  { id: 'U-002', fullName: 'Mohammed Hassan', username: 'mhassan', email: 'mohammed@fraud.sa', mobile: '0500000002', role: 'Fraud Team Member', status: 'Active', creationDate: '2026-01-12' },
  { id: 'U-003', fullName: 'Noura Khaled', username: 'nkhaled', email: 'noura@fraud.sa', mobile: '0500000003', role: 'Fraud Team Member', status: 'Active', creationDate: '2026-01-13' },
  { id: 'U-004', fullName: 'Abdullah Saad', username: 'asaad', email: 'abdullah@fraud.sa', mobile: '0500000004', role: 'Fraud Team Member', status: 'Active', creationDate: '2026-01-14' },
  { id: 'U-005', fullName: 'Admin User', username: 'admin', email: 'admin@fraud.sa', mobile: '0500000099', role: 'System Administrator', status: 'Active', creationDate: '2026-01-05' },
];

export const reports = [
  { name: 'Fraud Cases Report', description: 'All registered fraud cases with case details and closure info.' },
  { name: 'Confirmed Fraud Report', description: 'Cases where fraud has been confirmed.' },
  { name: 'Fraud Indicators Report', description: 'System-detected fraud indicators, risk levels, and recommendations.' },
  { name: 'Suspended Fraud Report', description: 'Fraud cases currently in Suspended status.' },
  { name: 'Fraud Performance Report', description: 'Fraud unit workload and performance summary.' },
];
