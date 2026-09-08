export type MotorFraudStatus =
  | 'Draft'
  | 'With Legal'
  | 'Returned to Motor from Legal'
  | 'With Fraud'
  | 'Returned to Motor from Fraud'
  | 'Closed'
  | 'Rejected'
  | 'Closed by Motor';

export type MotorFraudTeam = 'MOTOR' | 'LEGAL' | 'FRAUD' | 'CLOSED';

export type MotorFraudCase = {
  id: number;
  case_number: string;
  claim_number: string;
  reserve_amount: number | string | null;
  accident_number: string | null;
  claim_type: string | null;
  indicator_classification: string | null;
  sub_indicator: string | null;
  main_indicator: string | null;
  indicator_source: string | null;
  action_taken: string | null;
  received_date: string | null;
  comment_date: string | null;
  reception_comment_days: number | null;
  administrative_entity: string | null;
  employee_name: string | null;
  objection_received_date: string | null;
  first_escalation_at: string | null;
  first_escalation_days: number | null;
  second_escalation_at: string | null;
  second_escalation_days: number | null;
  status: MotorFraudStatus;
  current_team: MotorFraudTeam;
  return_to_team: 'LEGAL' | 'FRAUD' | null;
  created_by: string;
  created_by_name: string | null;
  updated_by?: string | null;
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  closed_by?: string | null;
  closure_outcome: string | null;
};

export type MotorFraudDocument = {
  id: number;
  motor_fraud_case_id: number;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
};

export type MotorFraudHistory = {
  id: number;
  motor_fraud_case_id: number;
  action_code: string;
  from_status: string | null;
  to_status: string | null;
  from_team: string | null;
  to_team: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_team: string | null;
  public_message: string | null;
  internal_comment?: string | null;
  created_at: string | null;
};

export type MotorFraudDetailsResponse = {
  case: MotorFraudCase;
  documents: MotorFraudDocument[];
  history: MotorFraudHistory[];
  access: {
    isInitiator: boolean;
    canEditMotorData: boolean;
    canSubmitMotor: boolean;
    canCloseReturned: boolean;
    canLegalReview: boolean;
    canFraudReview: boolean;
    canUploadDocuments: boolean;
    canDownloadDocuments: boolean;
    canExport: boolean;
    canSeeLegalComments: boolean;
    canSeeFraudComments: boolean;
  };
};
