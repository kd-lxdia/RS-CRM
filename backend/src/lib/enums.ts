// AUTO-GENERATED: runtime enum values (Prisma enums removed for SQLite compatibility).
// These mirror the enum members that used to be exported by @prisma/client.

export const RoleType = {
  ADMIN: "ADMIN",
  CALLING_STAFF: "CALLING_STAFF",
  SALESPERSON: "SALESPERSON",
  PROJECT_HEAD: "PROJECT_HEAD",
  DOCUMENTATION: "DOCUMENTATION",
  WAREHOUSE: "WAREHOUSE",
  INSTALLATION: "INSTALLATION",
  ACCOUNTANT: "ACCOUNTANT",
  DEALER_ADMIN: "DEALER_ADMIN",
  DEALER_STAFF: "DEALER_STAFF",
} as const;
export type RoleType = typeof RoleType[keyof typeof RoleType];

export const CampaignType = {
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  BOTH: "BOTH",
} as const;
export type CampaignType = typeof CampaignType[keyof typeof CampaignType];

export const CampaignStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
} as const;
export type CampaignStatus = typeof CampaignStatus[keyof typeof CampaignStatus];

export const LeadSource = {
  CAMPAIGN: "CAMPAIGN",
  EXCEL_UPLOAD: "EXCEL_UPLOAD",
  MANUAL: "MANUAL",
} as const;
export type LeadSource = typeof LeadSource[keyof typeof LeadSource];

export const RawLeadStatus = {
  NEW: "NEW",
  CALLED: "CALLED",
  FOLLOW_UP: "FOLLOW_UP",
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  CALL_NOT_RECEIVED: "CALL_NOT_RECEIVED",
  WRONG_NUMBER: "WRONG_NUMBER",
  CONVERTED: "CONVERTED",
  DUPLICATE: "DUPLICATE",
} as const;
export type RawLeadStatus = typeof RawLeadStatus[keyof typeof RawLeadStatus];

export const LeadStatus = {
  NEW: "NEW",
  FOLLOW_UP: "FOLLOW_UP",
  VISIT_SCHEDULED: "VISIT_SCHEDULED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  WON: "WON",
  LOST: "LOST",
} as const;
export type LeadStatus = typeof LeadStatus[keyof typeof LeadStatus];

export const CallEntityType = {
  RAW_LEAD: "RAW_LEAD",
  LEAD: "LEAD",
  CUSTOMER: "CUSTOMER",
} as const;
export type CallEntityType = typeof CallEntityType[keyof typeof CallEntityType];

export const CallType = {
  OUTBOUND: "OUTBOUND",
  INBOUND: "INBOUND",
} as const;
export type CallType = typeof CallType[keyof typeof CallType];

export const CallDisposition = {
  FOLLOW_UP: "FOLLOW_UP",
  NOT_INTERESTED: "NOT_INTERESTED",
  CALL_NOT_RECEIVED: "CALL_NOT_RECEIVED",
  WRONG_NUMBER: "WRONG_NUMBER",
  INTERESTED: "INTERESTED",
  OTHER: "OTHER",
} as const;
export type CallDisposition = typeof CallDisposition[keyof typeof CallDisposition];

export const VisitType = {
  SALES_VISIT: "SALES_VISIT",
  SITE_SURVEY: "SITE_SURVEY",
} as const;
export type VisitType = typeof VisitType[keyof typeof VisitType];

export const VisitStatus = {
  SCHEDULED: "SCHEDULED",
  CHECKED_IN: "CHECKED_IN",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const;
export type VisitStatus = typeof VisitStatus[keyof typeof VisitStatus];

export const ProposalStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type ProposalStatus = typeof ProposalStatus[keyof typeof ProposalStatus];

export const CustomerStatus = {
  ACTIVE: "ACTIVE",
  INSTALLATION_DONE: "INSTALLATION_DONE",
  COMPLETED: "COMPLETED",
} as const;
export type CustomerStatus = typeof CustomerStatus[keyof typeof CustomerStatus];

export const DesignStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type DesignStatus = typeof DesignStatus[keyof typeof DesignStatus];

export const LeadPriority = {
  HOT: "HOT",
  WARM: "WARM",
  COLD: "COLD",
} as const;
export type LeadPriority = typeof LeadPriority[keyof typeof LeadPriority];

export const DocumentType = {
  AADHAAR_FRONT: "AADHAAR_FRONT",
  AADHAAR_BACK: "AADHAAR_BACK",
  ELECTRICITY_BILL: "ELECTRICITY_BILL",
  CUSTOMER_SIGNATURE: "CUSTOMER_SIGNATURE",
  SITE_PHOTO: "SITE_PHOTO",
  DCR_CERTIFICATE: "DCR_CERTIFICATE",
  DESIGN_2D: "DESIGN_2D",
  AGREEMENT: "AGREEMENT",
  INVOICE: "INVOICE",
  OTHER: "OTHER",
} as const;
export type DocumentType = typeof DocumentType[keyof typeof DocumentType];

export const InvoiceStatus = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
} as const;
export type InvoiceStatus = typeof InvoiceStatus[keyof typeof InvoiceStatus];

export const PaymentMode = {
  CASH: "CASH",
  NEFT: "NEFT",
  RTGS: "RTGS",
  UPI: "UPI",
  CHEQUE: "CHEQUE",
} as const;
export type PaymentMode = typeof PaymentMode[keyof typeof PaymentMode];

export const PaymentMilestone = {
  BOOKING: "BOOKING",
  FIRST_INSTALLMENT: "FIRST_INSTALLMENT",
  SECOND_INSTALLMENT: "SECOND_INSTALLMENT",
  FINAL: "FINAL",
  OTHER: "OTHER",
} as const;
export type PaymentMilestone = typeof PaymentMilestone[keyof typeof PaymentMilestone];

export const AppStatus = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type AppStatus = typeof AppStatus[keyof typeof AppStatus];

export const LoanStatus = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  SANCTIONED: "SANCTIONED",
  DISBURSED: "DISBURSED",
  NA: "NA",
} as const;
export type LoanStatus = typeof LoanStatus[keyof typeof LoanStatus];

export const BOMCategory = {
  PANEL: "PANEL",
  INVERTER: "INVERTER",
  STRUCTURE: "STRUCTURE",
  CABLE: "CABLE",
  ACCESSORY: "ACCESSORY",
  OTHER: "OTHER",
} as const;
export type BOMCategory = typeof BOMCategory[keyof typeof BOMCategory];

export const BOMStatus = {
  PENDING: "PENDING",
  IN_STOCK: "IN_STOCK",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  DISPATCHED: "DISPATCHED",
} as const;
export type BOMStatus = typeof BOMStatus[keyof typeof BOMStatus];

export const TxType = {
  IN: "IN",
  OUT: "OUT",
  ADJUSTMENT: "ADJUSTMENT",
  RETURN: "RETURN",
  DAMAGED: "DAMAGED",
} as const;
export type TxType = typeof TxType[keyof typeof TxType];

export const DispatchStatus = {
  PENDING: "PENDING",
  DISPATCHED: "DISPATCHED",
  DELIVERED: "DELIVERED",
} as const;
export type DispatchStatus = typeof DispatchStatus[keyof typeof DispatchStatus];

export const TaskPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const EscalationStatus = {
  PENDING: "PENDING",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED: "RESOLVED",
} as const;
export type EscalationStatus = typeof EscalationStatus[keyof typeof EscalationStatus];

export const AICallStatus = {
  PENDING: "PENDING",
  QUEUED: "QUEUED",
  CALLING: "CALLING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  NO_ANSWER: "NO_ANSWER",
  BUSY: "BUSY",
  WRONG_NUMBER: "WRONG_NUMBER",
} as const;
export type AICallStatus = typeof AICallStatus[keyof typeof AICallStatus];

export const AICallDisposition = {
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  CALLBACK: "CALLBACK",
  WRONG_NUMBER: "WRONG_NUMBER",
  NO_ANSWER: "NO_ANSWER",
  VOICEMAIL: "VOICEMAIL",
  DO_NOT_CALL: "DO_NOT_CALL",
} as const;
export type AICallDisposition = typeof AICallDisposition[keyof typeof AICallDisposition];

export const TravelLogStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type TravelLogStatus = typeof TravelLogStatus[keyof typeof TravelLogStatus];

export const EpcProjectStage = {
  LEAD_ADVANCE_PENDING: "LEAD_ADVANCE_PENDING",
  PROJECT_CREATED: "PROJECT_CREATED",
  SURVEY_PENDING: "SURVEY_PENDING",
  SURVEY_DONE: "SURVEY_DONE",
  DESIGN_PENDING: "DESIGN_PENDING",
  BOM_PENDING: "BOM_PENDING",
  BOM_APPROVED: "BOM_APPROVED",
  PAYMENT_GATE_PENDING: "PAYMENT_GATE_PENDING",
  DISPATCH_READY: "DISPATCH_READY",
  DISPATCHED: "DISPATCHED",
  INSTALLATION_PLANNED: "INSTALLATION_PLANNED",
  INSTALLATION_DONE: "INSTALLATION_DONE",
  QC_PENDING: "QC_PENDING",
  QC_DONE: "QC_DONE",
  NET_METERING_PENDING: "NET_METERING_PENDING",
  SUBSIDY_PENDING: "SUBSIDY_PENDING",
  COMPLETED: "COMPLETED",
  ON_HOLD: "ON_HOLD",
  CANCELLED: "CANCELLED",
} as const;
export type EpcProjectStage = typeof EpcProjectStage[keyof typeof EpcProjectStage];

export const EpcApprovalStatus = {
  NOT_REQUIRED: "NOT_REQUIRED",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type EpcApprovalStatus = typeof EpcApprovalStatus[keyof typeof EpcApprovalStatus];

export const EpcGateStatus = {
  OPEN: "OPEN",
  BLOCKED: "BLOCKED",
  OVERRIDDEN: "OVERRIDDEN",
} as const;
export type EpcGateStatus = typeof EpcGateStatus[keyof typeof EpcGateStatus];

export const EpcChecklistStatus = {
  PENDING: "PENDING",
  DONE: "DONE",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  FAILED: "FAILED",
} as const;
export type EpcChecklistStatus = typeof EpcChecklistStatus[keyof typeof EpcChecklistStatus];

export const EpcDocumentStage = {
  CUSTOMER_DOCS: "CUSTOMER_DOCS",
  FIRST_STAGE_APPLICATION: "FIRST_STAGE_APPLICATION",
  DISCOM_APPROVAL: "DISCOM_APPROVAL",
  NET_METER_FILE: "NET_METER_FILE",
  INSPECTION: "INSPECTION",
  NET_METER_INSTALLED: "NET_METER_INSTALLED",
  SUBSIDY_CLAIM_SUBMITTED: "SUBSIDY_CLAIM_SUBMITTED",
  SUBSIDY_RECEIVED: "SUBSIDY_RECEIVED",
} as const;
export type EpcDocumentStage = typeof EpcDocumentStage[keyof typeof EpcDocumentStage];

export const EpcInventoryType = {
  MODULE: "MODULE",
  INVERTER: "INVERTER",
  STRUCTURE: "STRUCTURE",
  CABLE: "CABLE",
  ACCESSORY: "ACCESSORY",
  OTHER: "OTHER",
} as const;
export type EpcInventoryType = typeof EpcInventoryType[keyof typeof EpcInventoryType];

export const EpcAuditEntity = {
  LEAD: "LEAD",
  PROJECT: "PROJECT",
  QUOTATION: "QUOTATION",
  SURVEY: "SURVEY",
  BOM: "BOM",
  WAREHOUSE: "WAREHOUSE",
  PAYMENT: "PAYMENT",
  INSTALLATION: "INSTALLATION",
  DOCUMENTATION: "DOCUMENTATION",
  PERMISSION: "PERMISSION",
  REPORT: "REPORT",
} as const;
export type EpcAuditEntity = typeof EpcAuditEntity[keyof typeof EpcAuditEntity];

export const B2bPiStatus = {
  DRAFT: "DRAFT",
  GENERATED: "GENERATED",
  SENT: "SENT",
  APPROVAL_PENDING: "APPROVAL_PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVISION_REQUIRED: "REVISION_REQUIRED",
  ORDER_CONVERTED: "ORDER_CONVERTED",
} as const;
export type B2bPiStatus = typeof B2bPiStatus[keyof typeof B2bPiStatus];

export const B2bPiAuditAction = {
  CREATED: "CREATED",
  GENERATED_WITHIN_LIMIT: "GENERATED_WITHIN_LIMIT",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVISION_REQUESTED: "REVISION_REQUESTED",
  SENT: "SENT",
  ORDER_CONVERTED: "ORDER_CONVERTED",
} as const;
export type B2bPiAuditAction = typeof B2bPiAuditAction[keyof typeof B2bPiAuditAction];
