import fs from 'node:fs/promises';
import path from 'node:path';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = path.resolve('outputs/rocker-solar-audit');
const outputPath = path.join(outputDir, 'Rocker_Solar_CRM_Audit_SLAR_2_0.xlsx');

const columns = [
  'Sr. No.',
  'Module',
  'Feature / Requirement',
  'Required Logic / Expected Behaviour',
  'Current CRM Status',
  'Current CRM Observation',
  'Gap / Problem',
  'Business Risk',
  'Suggested Solution',
  'Priority',
  'Owner Department',
  'Complexity',
  'Remarks',
];

const seededCounts = {
  users: 12,
  rawLeads: 80,
  leads: 20,
  customers: 6,
  visits: 6,
  surveys: 3,
  bomItems: 12,
  stockItems: 5,
  dispatches: 5,
  invoices: 6,
  payments: 6,
  tasks: 12,
  notifications: 24,
  proposals: 6,
  aiCalls: 8,
};

const featureGroups = [
  {
    module: 'Lead Management',
    owner: 'Sales',
    items: [
      ['Lead creation', 'Create lead manually/imported with customer, contact, source and assignment fields.', 'OK', 'Lead and raw lead create APIs exist; seeded DB has 20 leads and 80 raw leads.', 'No major gap for basic creation.', 'Low risk for lead entry; monitor data quality.', 'Keep validation and add duplicate prompt in UI.', 'Medium', 'Easy', 'Verified by lead/raw lead routes and seeded records.'],
      ['Duplicate lead detection by mobile number, CA number, address, and customer name', 'CRM should detect duplicates across mobile, CA number, normalized address and customer name before/while saving.', 'OK', 'EPC v2 lead control builds duplicateGroupKey and finds matches on mobile, CA number, addressKey and customerNameKey.', 'Needs UI surfacing if not already shown on every lead form.', 'Duplicate sales effort, customer irritation, inflated pipeline.', 'Show duplicate warning modal with matching lead links before save/assignment.', 'High', 'Medium', 'Backend logic exists in epcLeadControl.'],
      ['Lead source tracking', 'Every lead should capture source/channel/campaign and allow reporting by source.', 'OK', 'EPC v2 lead control now rejects save when sourceDetail is blank.', 'Legacy lead flows should be migrated to EPC v2 control.', 'Founder cannot reliably judge ROI by campaign/source if users bypass EPC v2.', 'Route all lead forms through EPC v2 lead control.', 'Medium', 'Easy', 'Mandatory validation implemented in upsertLeadControl.'],
      ['Salesperson assignment', 'Lead should be assigned to salesperson and visible in salesperson pipeline.', 'OK', 'Lead/customer assignment fields and salesperson routes exist; seeded data is assigned to demo sales users.', 'No major backend gap found.', 'Unassigned leads may age if UI workflow skips assignment.', 'Add unassigned-lead queue KPI.', 'High', 'Easy', 'Verified by seeded demo users and lead/customer assignment fields.'],
      ['Follow-up date mandatory', 'Next follow-up date should be mandatory for active leads except closed/won/lost.', 'OK', 'upsertLeadControl rejects active leads without nextFollowUpAt.', 'Legacy non-EPC lead edits should be retired.', 'Leads can be forgotten if users bypass EPC v2.', 'Make EPC v2 lead control canonical.', 'High', 'Easy', 'Conditional validation implemented.'],
      ['Missed follow-up alert', 'System should detect overdue follow-ups and alert salesperson/founder.', 'OK', 'Founder dashboard counts overdue follow-ups and /leads/missed-follow-up-alerts creates salesperson notifications.', 'No major backend gap.', 'Delayed follow-ups reduce conversion if alerts ignored.', 'Schedule alert endpoint daily/hourly.', 'High', 'Medium', 'API verified FollowupChecked=3 and FollowupCreated=3.'],
      ['Lead stage tracking', 'Lead should move through clear stages from new to follow-up, visit, proposal, negotiation, won/lost.', 'OK', 'LeadStatus enum and update/list APIs exist.', 'No major gap for stage field.', 'Stage misuse can distort pipeline.', 'Add stage transition rules and required fields by stage.', 'Medium', 'Medium', 'LeadStatus includes NEW, FOLLOW_UP, VISIT_SCHEDULED, PROPOSAL_SENT, NEGOTIATION, WON, LOST.'],
      ['Lost reason tracking', 'Lost leads must capture reason before closure.', 'OK', 'upsertLeadControl rejects LOST leads without lostReason unless lead already has a stored lost reason.', 'Legacy lead status edits should be migrated.', 'Founder cannot analyze why deals are lost if bypassed.', 'Enforce same validation on old lead update endpoint or route through EPC v2.', 'High', 'Easy', 'Strict validation implemented.'],
      ['Hot lead tracking', 'CRM should mark/score hot leads for priority sales action.', 'OK', 'hotScore and isHot logic exists; isHot true when score >= 70.', 'UI prioritization should be checked visually.', 'Hot leads may not receive fast action if not surfaced.', 'Add hot lead dashboard card and SLA timer.', 'Medium', 'Easy', 'EPC v2 service calculates isHot.'],
      ['Lead to project conversion after advance', 'Project should be created only after required advance is received.', 'OK', 'createProjectAfterAdvance checks booking payment aggregate against required advance and blocks otherwise.', 'Requires all conversion flows to use EPC v2 endpoint.', 'Projects may start without cash collection if bypassed.', 'Make EPC v2 conversion the only project creation route.', 'High', 'Medium', 'Advance gate exists in service.'],
    ],
  },
  {
    module: 'Site Visit / Survey',
    owner: 'Project',
    items: [
      ['Site visit booking', 'Book site visit with planned date/time and link to lead/customer/project.', 'OK', 'Visit scheduling routes and EPC survey plannedAt exist; seeded DB has 6 visits.', 'No major backend gap.', 'Poor visit planning if not adopted by users.', 'Show planned vs done on dashboards.', 'High', 'Easy', 'visit.routes and epcSurveyControl support booking.'],
      ['Survey person assignment', 'Assign surveyor/installation person and track ownership.', 'OK', 'EPC survey has assignedSurveyorId; installation/project owners exist.', 'No major backend gap.', 'Unclear accountability on survey delay.', 'Add department SLA report by surveyor.', 'High', 'Easy', 'assignedSurveyorId in EPC v2 survey.'],
      ['Roof/ground type capture', 'Capture rooftop/ground/elevated installation type.', 'OK', 'saveSurvey stores roofOrGroundType and requires it for completed checklist.', 'No major gap.', 'Wrong design/material if roof type missing.', 'Keep as mandatory before survey completion.', 'High', 'Easy', 'RequiredForCompletion includes roofOrGroundType.'],
      ['Site photos upload', 'Survey completion should require site photos.', 'OK', 'sitePhotoUrls stored and required for completed survey.', 'Actual file storage proof should be checked in UI.', 'No proof for site feasibility or disputes.', 'Retain photo URLs and preview in project timeline.', 'High', 'Medium', 'RequiredForCompletion includes sitePhotoUrls length.'],
      ['Location pin upload', 'Capture geolocation pin/proof for site visit.', 'OK', 'locationLat/locationLng and locationProofUrl fields exist.', 'Accuracy validation/geofence not proven.', 'Wrong site visits and fake completion risk.', 'Add map preview and distance validation from check-in.', 'High', 'Medium', 'Lat/lng required for completed EPC survey.'],
      ['Load and sanction load capture', 'Capture connected load and sanctioned load for design/subsidy.', 'OK', 'connectedLoadKw and sanctionedLoadKw stored and required for completion.', 'No major backend gap.', 'Wrong system sizing and DISCOM rejection.', 'Show load mismatch warnings.', 'High', 'Easy', 'EPC survey stores both values.'],
      ['Shadow issue capture', 'Capture shadow status/notes for design risk.', 'OK', 'shadowStatus and shadowNotes fields exist.', 'Automated shadow analysis not integrated here.', 'Generation loss and customer dispute.', 'Add severity rating and design approval note.', 'Medium', 'Medium', 'Solar engine also has shading report route.'],
      ['Structure requirement capture', 'Capture structure type/height/custom requirement.', 'OK', 'structureRequirement stored and required for completed survey.', 'No major backend gap.', 'Underquoted structure and margin leakage.', 'Link requirement to BOM structure items.', 'High', 'Medium', 'RequiredForCompletion includes structureRequirement.'],
      ['Survey checklist', 'Checklist must be stored and completion gated.', 'OK', 'Survey checklist JSON stored; completion boolean calculated from required fields.', 'Checklist content is flexible JSON, not standardized by schema.', 'Inconsistent survey quality across teams.', 'Define fixed checklist template with required item statuses.', 'High', 'Medium', 'isChecklistComplete is calculated.'],
      ['Site visit completed/not completed tracking', 'Track completed, no-show, cancelled and not completed reasons.', 'OK', 'VisitStatus supports lifecycle; survey has completedAt and notCompletedReason.', 'No major backend gap.', 'Management cannot see true productivity if not used.', 'Add mandatory notCompletedReason for failed visits.', 'Medium', 'Easy', 'VisitStatus and survey reason fields exist.'],
    ],
  },
  {
    module: 'Quotation / PI / Margin Approval',
    owner: 'Sales',
    items: [
      ['Quotation creation', 'Create quotation/cost sheet linked to lead/project/proposal.', 'OK', 'EPC quotation cost-sheet endpoint exists; seeded proposals exist.', 'No major backend gap.', 'Manual quotation outside CRM causes margin leakage.', 'Route all quotation generation through cost sheet.', 'High', 'Medium', 'createQuotationCostSheet implemented.'],
      ['Module brand/wattage selection', 'Capture panel/module brand, wattage and type.', 'OK', 'moduleBrand, moduleWattage and moduleType captured.', 'Need UI dropdown from approved panel master.', 'Wrong module promise to customer.', 'Bind to solar config panel database.', 'High', 'Medium', 'Fields exist in EPC cost sheet.'],
      ['Inverter brand/kW selection', 'Capture inverter brand and capacity.', 'OK', 'inverterBrand and inverterKw captured.', 'Need UI dropdown from approved inverter master.', 'Wrong inverter sizing or procurement mismatch.', 'Bind to inverter master and validate capacity.', 'High', 'Medium', 'Fields exist in EPC cost sheet.'],
      ['Structure cost entry', 'Structure cost should be entered/calculated separately.', 'OK', 'structureCost captured in cost sheet.', 'No major backend gap.', 'Margin visibility weak if bundled.', 'Keep separate cost line and lock after approval.', 'High', 'Easy', 'Cost component exists.'],
      ['Labour/I&C cost entry', 'Labour and installation cost should be separately captured.', 'OK', 'labourIcCost captured.', 'No major backend gap.', 'Underpriced installation cost reduces margin.', 'Add default labour rate rules by kW/structure.', 'High', 'Medium', 'Cost component exists.'],
      ['Transportation cost entry', 'Transportation cost should be separately captured.', 'OK', 'transportationCost captured.', 'No major backend gap.', 'Remote sites can become loss-making.', 'Auto-suggest cost from distance/zone.', 'Medium', 'Medium', 'Cost component exists.'],
      ['Net-metering/subsidy cost entry', 'Net-metering and subsidy processing costs should be included.', 'OK', 'netMeteringCost and subsidyProcessingCost captured.', 'No major backend gap.', 'Documentation costs may be missed.', 'Add defaults by DISCOM/state.', 'Medium', 'Medium', 'Both cost fields exist.'],
      ['Total cost calculation', 'Total cost should auto-calculate from all cost lines.', 'OK', 'calculateQuotation computes totalCost.', 'No major gap.', 'Manual errors in total cost.', 'Keep formula visible in UI.', 'High', 'Easy', 'Service calculation exists.'],
      ['Selling price calculation', 'Selling price should be captured and used for margin calculation.', 'OK', 'sellingPrice captured and returned.', 'Auto pricing rules not fully proven.', 'Inconsistent sales pricing.', 'Add price book and discount rules.', 'High', 'Medium', 'Selling price is part of calculation.'],
      ['Gross profit calculation', 'Gross profit = selling price - total cost.', 'OK', 'grossProfit calculated.', 'No major gap.', 'Founder cannot approve margin without GP.', 'Show GP in quotation approval screen.', 'High', 'Easy', 'Formula exists.'],
      ['Margin percentage calculation', 'Margin % should be calculated automatically.', 'OK', 'marginPercent calculated to 2 decimals.', 'No major gap.', 'Low margin deals missed.', 'Show with color thresholds.', 'High', 'Easy', 'Formula exists.'],
      ['Low margin warning', 'Warn if margin below configured threshold.', 'OK', 'lowMarginWarning calculated vs threshold default 12%.', 'Threshold admin UI/config not fully confirmed.', 'Loss-making deals may pass.', 'Make threshold configurable by founder.', 'High', 'Easy', 'Logic exists.'],
      ['Founder approval for low-margin quotation', 'Low margin quotation must require founder/admin approval.', 'OK', 'Founder approval status set to PENDING and approve endpoint exists.', 'Ensure UI blocks send/accept until approved.', 'Sales can close bad margin deals.', 'Enforce approval gate before quote send/accept.', 'High', 'Medium', 'approveQuotation and audit log implemented.'],
      ['Quotation revision history', 'Each revision should be retained with revision number/history.', 'OK', 'Quotation revision endpoint creates a new revision, deactivates previous cost sheet, requires revisionReason and keeps audit log.', 'Diff UI can still improve usability.', 'Wrong quote version may be sent/approved if users ignore active revision.', 'Show active revision badge in UI.', 'Medium', 'Medium', 'Implemented /quotations/:id/revise.'],
      ['Quotation sent status', 'Track sent/not sent date/status.', 'OK', 'Quotation sent endpoint sets sentAt and blocks low-margin send until founder approval.', 'No major backend gap.', 'Founder cannot track daily quotation throughput if sent action is bypassed.', 'Use sent endpoint from quotation UI.', 'Medium', 'Easy', 'Implemented /quotations/:id/sent.'],
    ],
  },
  {
    module: 'Project Creation',
    owner: 'Project',
    items: [
      ['Auto project creation after advance', 'Auto-create project only after advance payment gate passes.', 'OK', 'EPC project creation checks booking payment against advanceRequiredAmount.', 'Must prevent alternate bypass routes.', 'Work starts without advance.', 'Make this endpoint canonical.', 'High', 'Medium', 'Advance gate implemented.'],
      ['Customer data transfer from lead to project', 'Project should link/copy lead/customer/proposal data.', 'OK', 'Project conversion now stores customerSnapshot JSON with customer/lead identity, address, CA and load data.', 'No major backend gap.', 'Historical details may change only outside project snapshot.', 'Show snapshot in project header.', 'Medium', 'Medium', 'customerSnapshot added to EpcProject.'],
      ['Project owner assignment', 'Assign accountable project owner.', 'OK', 'projectOwnerId field exists.', 'No major backend gap.', 'No single accountable owner.', 'Require projectOwnerId at creation.', 'High', 'Easy', 'Owner field exists.'],
      ['Sales owner assignment', 'Keep sales owner after project handoff.', 'OK', 'salesOwnerId field exists.', 'No major backend gap.', 'Collection/upsell accountability weak.', 'Show owner in project header.', 'Medium', 'Easy', 'Owner field exists.'],
      ['Execution owner assignment', 'Assign execution/project operations owner.', 'OK', 'executionOwnerId field exists.', 'No major backend gap.', 'Execution delays without owner.', 'Require by project stage.', 'High', 'Easy', 'Owner field exists.'],
      ['Documentation owner assignment', 'Assign subsidy/net-metering documentation owner.', 'OK', 'documentationOwnerId field exists.', 'No major backend gap.', 'Docs delayed or missed.', 'Require before documentation stage.', 'High', 'Easy', 'Owner field exists.'],
      ['Installation owner assignment', 'Assign installation owner/team.', 'OK', 'installationOwnerId and installationTeamId exist.', 'No major backend gap.', 'Installation scheduling confusion.', 'Sync owner with installation control.', 'High', 'Easy', 'Fields exist.'],
      ['Project stage tracking', 'Track project stage across survey, BOM, dispatch, installation, subsidy.', 'OK', 'EPC project stage updates in survey/BOM/dispatch/installation flows.', 'Full UI kanban not checked.', 'Founder cannot see bottlenecks.', 'Expose unified project stage timeline.', 'High', 'Medium', 'Stage updated by service.'],
      ['Next action tracking', 'Store next action and owner after each stage.', 'OK', 'nextAction and nextActionOwnerId fields are set/updated.', 'No major backend gap.', 'Teams wait for unclear next steps.', 'Add overdue next-action alerts.', 'High', 'Medium', 'nextAction set in service.'],
      ['Project deadline tracking', 'Project should have deadline and delay visibility.', 'OK', 'Project conversion now requires projectDeadlineAt and project-deadlines report returns breach status/days to deadline.', 'No major backend gap.', 'Late projects without escalation if report is not reviewed.', 'Add scheduled deadline alert notification.', 'High', 'Medium', 'API verified DeadlineRows=5.'],
    ],
  },
  {
    module: 'Design / BOM',
    owner: 'Project',
    items: [
      ['2D design requirement status', 'Track whether design is required/pending/done.', 'OK', 'EPC v2 now has EpcDesignControl with requiredStatus/status and design APIs.', 'No major backend gap; UI adoption should continue.', 'Incorrect layout/BOM and rework if teams bypass workflow.', 'Use design queue as mandatory pre-BOM control.', 'Medium', 'Medium', 'Verified by design-pending drill-down returning demo rows.'],
      ['Design assigned to team member', 'Assign design work to owner.', 'OK', 'EpcDesignControl stores designOwnerId and validates owner when design is required and not done.', 'No major backend gap.', 'Delayed design and BOM creation if owner is not maintained.', 'Show design owner in project header and queue.', 'Medium', 'Easy', 'Service rejects required pending design without owner.'],
      ['Design due date', 'Track design due date/SLA.', 'OK', 'EpcDesignControl stores designDueAt and validates due date when design is required and not done.', 'No major backend gap.', 'Project start gets delayed if SLA is not monitored.', 'Keep overdue design count on founder dashboard.', 'Medium', 'Easy', 'Founder API returned DesignPending=2 after seed.'],
      ['BOM creation', 'Create BOM with item lines and quantities.', 'OK', 'EPC BOM create endpoint and lines exist; seeded DB has 12 BOM items.', 'No major backend gap.', 'Material planning manual if not used.', 'Use BOM as dispatch source of truth.', 'High', 'Medium', 'createBom implemented.'],
      ['BOM approval', 'BOM should be approved by authorized project/founder role.', 'OK', 'approveAndLockBom endpoint exists.', 'No major backend gap.', 'Wrong material dispatch.', 'Require approval before dispatch.', 'High', 'Easy', 'Approval endpoint exists.'],
      ['BOM lock after approval', 'Approved BOM should be locked from casual edits.', 'OK', 'lockedBy and lockedAt set during approval.', 'Need UI edit lock enforcement verified.', 'Approved material can be changed silently.', 'Block line edits after lockedAt unless revision.', 'High', 'Medium', 'Lock fields exist.'],
      ['BOM revision history', 'Changes after approval must create revisions.', 'OK', 'BOM creation now increments revisionNo, stores previousBomId, and requires revisionReason after a locked/approved BOM exists.', 'No major backend gap.', 'Teams may lose original approved BOM if UI hides history.', 'Expose BOM revision timeline.', 'High', 'Medium', 'previousBomId added and validation implemented.'],
      ['Extra material approval', 'Extra material should require approval.', 'OK', 'recordMaterialMovement blocks extraMaterial unless extraApprovalStatus=APPROVED.', 'No major backend gap.', 'Material leakage and stock loss.', 'Add founder override workflow for extra issue.', 'High', 'Easy', 'Gate exists.'],
      ['Material shortage detection', 'Detect BOM required qty vs stock available.', 'OK', 'approveAndLockBom compares stock quantity and creates shortageSummary.', 'Stock granularity depends on SKU quality.', 'Dispatch planned without material.', 'Show shortage list on BOM approval screen.', 'High', 'Medium', 'Shortage detection exists.'],
      ['Dispatch readiness status', 'BOM/project should show dispatch ready/blocked.', 'OK', 'dispatchReadiness and dispatchGateStatus set based on shortages.', 'No major gap.', 'Warehouse confusion and delays.', 'Add readiness filter dashboard.', 'High', 'Easy', 'Fields set in service.'],
    ],
  },
  {
    module: 'Warehouse / Inventory',
    owner: 'Warehouse',
    items: [
      ['Item-wise stock tracking', 'Track SKU/item quantity and transactions.', 'OK', 'StockItem and StockTransaction routes exist; seeded DB has 5 stock items.', 'No major backend gap.', 'Stock mismatch and procurement delay.', 'Keep SKU master clean.', 'High', 'Medium', 'warehouse routes exist.'],
      ['Module brand/wattage/DCR/NDCR tracking', 'Track module attributes for DCR/subsidy compliance.', 'OK', 'EPC material movement validates module brand, wattage and dcrType; serial records also store these attributes.', 'No major backend gap.', 'Wrong panels can break subsidy eligibility if free-text UI bypasses SKU/attribute validation.', 'Use controlled module master dropdown.', 'High', 'Medium', 'Validation implemented in recordMaterialMovement.'],
      ['Panel serial number tracking', 'Track individual panel serials per site.', 'OK', 'EpcInventorySerial is first-class and dispatch requires serialNumbers for MODULE items, linked to project/customer.', 'No major backend gap.', 'Warranty/subsidy disputes if serial entry is wrong.', 'Add barcode scan UI.', 'High', 'Hard', 'Serial workflow implemented.'],
      ['Inverter serial number tracking', 'Track inverter serial per site.', 'OK', 'Dispatch requires serialNumbers for INVERTER items and stores them in EpcInventorySerial.', 'No major backend gap.', 'Warranty claim failure if serial entry is wrong.', 'Add barcode scan UI.', 'High', 'Medium', 'Serial workflow implemented.'],
      ['Structure material tracking', 'Track structure SKUs and quantities.', 'OK', 'BOM/stock supports itemType and SKU; structure lines can be tracked.', 'Need standardized item types in UI.', 'Structure shortages delay installation.', 'Use controlled item categories.', 'High', 'Medium', 'BOM lines support itemType.'],
      ['Cable and accessory tracking', 'Track cables, earthing, accessories by SKU.', 'OK', 'BOM/stock generic items support accessories.', 'Granularity depends on SKU discipline.', 'Small material shortages cause site delay.', 'Add minimum stock alerts.', 'Medium', 'Medium', 'Generic stock support exists.'],
      ['Site-wise material issue', 'Record material issue/dispatch per project/site.', 'OK', 'epcMaterialMovement stores projectId/customerId/items.', 'No major backend gap.', 'Cannot reconcile site material.', 'Use movement as site issue register.', 'High', 'Medium', 'Movement endpoint exists.'],
      ['BOM vs dispatch comparison', 'Compare approved BOM with actual dispatch.', 'OK', 'EPC v2 BOM-dispatch comparison report returns approved qty, dispatched qty, variance and status per BOM line.', 'No major backend gap.', 'Over/under dispatch may go unnoticed if report is not reviewed.', 'Add exception badge for OVER/SHORT dispatch.', 'High', 'Medium', 'API verified BomCompareRows=2.'],
      ['Dispatch challan creation', 'Create challan number/details during dispatch.', 'OK', 'challanNumber stored in material movement.', 'PDF challan generation not verified.', 'No delivery document for customer/site.', 'Generate printable dispatch challan PDF.', 'Medium', 'Medium', 'Challan field exists.'],
      ['Material receiver proof', 'Receiver proof should be mandatory for dispatch.', 'OK', 'Dispatch throws error if receiverProofUrl missing.', 'No major backend gap.', 'Delivery disputes.', 'Keep receiver proof preview in project.', 'High', 'Easy', 'Mandatory in service.'],
      ['Material return tracking', 'Track returned material with reason.', 'OK', 'movementType RETURN and returnReason supported; founder dashboard counts returns.', 'Return approval workflow not fully checked.', 'Stock not reconciled after return.', 'Add return approval and quality check.', 'Medium', 'Medium', 'Return movement supported.'],
      ['Damaged material tracking', 'Track damaged material and reason.', 'OK', 'DAMAGED material movement now requires damageReason, updates stock/serial status and damaged-material report lists damage cases.', 'No major backend gap.', 'Financial loss and stock inaccuracy if damage is not recorded.', 'Add approval workflow for write-off value.', 'Medium', 'Medium', 'Implemented damage validation/report.'],
      ['Stock auto update', 'Stock should auto-increase/decrease from movements.', 'OK', 'EPC material movement now updates StockItem quantity and creates StockTransaction for matching SKUs; BOM issued/returned quantity is also incremented.', 'Stock auto-updates only when movement item has a valid SKU in stock master.', 'Warehouse mismatch if users enter free-text items without SKU.', 'Make SKU selection mandatory in dispatch/return UI.', 'High', 'Medium', 'Implemented in recordMaterialMovement.'],
      ['Extra material issue alert', 'Alert/stop extra material issue without approval.', 'OK', 'Extra material is blocked unless approved.', 'Alert notification not separately proven.', 'Material leakage.', 'Create notification when extra material requested.', 'High', 'Medium', 'Gate exists; alert can improve.'],
    ],
  },
  {
    module: 'Payment / Accounts',
    owner: 'Accounts',
    items: [
      ['Project value tracking', 'Track project value against project/customer.', 'OK', 'EPC project stores projectValue; invoices/payments exist.', 'No major backend gap.', 'Revenue visibility weak if not maintained.', 'Show value in P&L report.', 'High', 'Easy', 'Project value field exists.'],
      ['Payment milestone tracking', 'Track expected/received amounts by milestone.', 'OK', 'epcPaymentMilestonePlan supports milestones, dueAt, expected and received amounts.', 'No major gap.', 'Collections become ad hoc.', 'Use milestone plan for all projects.', 'High', 'Medium', 'Endpoint exists.'],
      ['Advance received status', 'Track booking advance and gate project creation.', 'OK', 'Project creation aggregates BOOKING payment and blocks insufficient advance.', 'No major gap.', 'Projects start without cash.', 'Make advance status prominent.', 'High', 'Easy', 'Advance gate verified in code.'],
      ['Payment pending status', 'Show unpaid milestone/payment pending status.', 'OK', 'Milestone status PAID/PENDING calculated.', 'No major gap.', 'Collection delay.', 'Add overdue aging buckets.', 'High', 'Medium', 'Payment plan status exists.'],
      ['Overdue payment tracking', 'Track dueAt past and unpaid milestones.', 'OK', 'Founder control room counts overdue paymentPending.', 'No major gap.', 'Cashflow leakage.', 'Add daily reminders and owner accountability.', 'High', 'Medium', 'Dashboard query exists.'],
      ['Payment reminder', 'Automated reminders for due/overdue payments.', 'OK', 'Payment reminder endpoint creates overdue payment notifications and stamps reminderSentAt.', 'Schedule automation can still improve delivery cadence.', 'Manual chasing burden if endpoint is not scheduled.', 'Run reminder endpoint on daily scheduler.', 'High', 'Medium', 'API verified PaymentReminderChecked=2 and Created=2.'],
      ['Dispatch blocked if payment pending', 'Block dispatch unless required payments clear.', 'OK', 'ensureDispatchAllowed blocks pending payment milestones without override.', 'No major backend gap.', 'Material dispatched before payment.', 'Keep hard gate in warehouse UI.', 'High', 'Medium', 'Gate implemented.'],
      ['Founder approval for dispatch despite payment pending', 'Allow founder override with approval log.', 'OK', 'Founder override request/approve endpoints exist and dispatch checks approved override.', 'No major gap.', 'Unauthorized payment bypass.', 'Show override reason and approval logs.', 'High', 'Medium', 'Override implemented.'],
      ['Final payment pending after installation', 'Track final payment after installation before closure/handover.', 'OK', 'Installation close checks final milestones and creates FINAL_PAYMENT_PENDING notification when final amount is pending.', 'Can be made stricter if business wants hard block instead of alert.', 'Final payment may remain unpaid if alert ignored.', 'Add founder escalation after 24 hours overdue.', 'High', 'Medium', 'Final pending alert implemented.'],
      ['Project-wise collection report', 'Report collections by project.', 'OK', 'EPC v2 collection report returns expected, received, pending, final flag, status, reminder and lock data per project milestone.', 'No major backend gap.', 'Founder lacks project collection view if report is not surfaced in UI.', 'Add Excel download button.', 'Medium', 'Medium', 'API verified CollectionRows=2.'],
      ['Salesperson-wise payment pending report', 'Show pending collections by salesperson.', 'OK', 'Salesperson payment pending report joins project owner context with overdue/pending payment milestones.', 'No major backend gap.', 'Sales accountability weak if owner assignment is wrong.', 'Keep salesOwner mandatory at project creation.', 'Medium', 'Medium', 'API verified SalesPendingRows=2.'],
    ],
  },
  {
    module: 'Installation / I&C',
    owner: 'Installation',
    items: [
      ['Installation team assignment', 'Assign installation team/member.', 'OK', 'installationTeamId and installationOwnerId exist.', 'No major backend gap.', 'No accountable team.', 'Require team before planned date.', 'High', 'Easy', 'Field exists.'],
      ['Planned installation date', 'Track planned installation date.', 'OK', 'plannedInstallationAt stored.', 'No major gap.', 'Poor scheduling.', 'Calendar view should show planned dates.', 'High', 'Easy', 'Field exists.'],
      ['Actual installation date', 'Track actual completion date.', 'OK', 'actualInstallationAt stored.', 'No major gap.', 'Delay reporting inaccurate.', 'Compare planned vs actual in dashboard.', 'High', 'Easy', 'Field exists.'],
      ['Stage-wise installation checklist', 'Track stage checklist before close.', 'OK', 'Service checks required status keys before closing.', 'Checklist values are flexible strings; UI consistency needed.', 'Incomplete installation can be marked done if UI bypasses standard statuses.', 'Use controlled checklist values.', 'High', 'Medium', 'Close gate exists.'],
      ['Structure completion status', 'Track structure completion.', 'OK', 'structureStatus required as DONE for close.', 'No major backend gap.', 'Unsafe/incomplete install.', 'Show status in install app.', 'High', 'Easy', 'Required status key.'],
      ['Module mounting status', 'Track module mounting.', 'OK', 'moduleMountingStatus required as DONE.', 'No major gap.', 'Incomplete installation.', 'Keep mandatory.', 'High', 'Easy', 'Required status key.'],
      ['DC wiring status', 'Track DC wiring.', 'OK', 'dcWiringStatus required as DONE.', 'No major gap.', 'Electrical fault risk.', 'Require photo/test proof.', 'High', 'Easy', 'Required status key.'],
      ['AC wiring status', 'Track AC wiring.', 'OK', 'acWiringStatus required as DONE.', 'No major gap.', 'Electrical safety risk.', 'Require test proof.', 'High', 'Easy', 'Required status key.'],
      ['Inverter installation status', 'Track inverter installation.', 'OK', 'inverterInstallationStatus required as DONE.', 'No major gap.', 'Commissioning incomplete.', 'Capture inverter serial/photo.', 'High', 'Medium', 'Required status key.'],
      ['Earthing status', 'Track earthing completion.', 'OK', 'earthingStatus required as DONE.', 'No major gap.', 'Safety/compliance risk.', 'Add earth resistance reading field.', 'High', 'Medium', 'Required status key.'],
      ['Testing status', 'Track testing/commissioning.', 'OK', 'testingStatus required as DONE.', 'No major gap.', 'System handed over without validation.', 'Capture test values/photos.', 'High', 'Medium', 'Required status key.'],
      ['Handover status', 'Track customer handover.', 'OK', 'handoverStatus required as DONE.', 'No major gap.', 'Customer dispute and pending docs.', 'Capture handover signature.', 'High', 'Medium', 'Required status key.'],
      ['Site photos mandatory', 'Photos mandatory before installation close.', 'OK', 'mandatoryPhotoUrls required if actualInstallationAt is set.', 'No major backend gap.', 'Fake closure/no evidence.', 'Keep photo upload mandatory.', 'High', 'Easy', 'Service throws without photos.'],
      ['Delay reason mandatory', 'Delay reason required when delayed.', 'OK', 'Installation close now requires delayReason when actual installation date is after planned date.', 'No major backend gap.', 'Founder cannot identify bottleneck owner if users enter vague text.', 'Use controlled delay reason categories.', 'High', 'Easy', 'Validation implemented.'],
      ['Delay owner tracking', 'Track responsible department/person for delay.', 'OK', 'Installation close now requires delayOwnerDepartment when actual date is after planned date.', 'No major backend gap.', 'No accountability if owner department is inaccurate.', 'Use department dropdown.', 'High', 'Easy', 'Validation implemented.'],
      ['Punch point tracking', 'Track open punch points/snags.', 'OK', 'EpcPunchPoint is wired through create/list/close APIs; installation close blocks open punch points and closure requires proofUrl.', 'No major backend gap.', 'Snags lost after handover if UI bypasses punch list.', 'Expose punch list in installation mobile view.', 'Medium', 'Medium', 'Founder punch-points drill-down returned demo rows.'],
      ['QC pending/done status', 'Track QC status separately.', 'OK', 'qcStatus stored and founder dashboard counts not DONE.', 'No major backend gap.', 'Projects handed over without QC.', 'Make QC DONE required before project completion.', 'High', 'Medium', 'qcStatus exists.'],
    ],
  },
  {
    module: 'Net Metering / Subsidy',
    owner: 'Documentation',
    items: [
      ['Customer document collection', 'Track customer document status.', 'OK', 'customerDocsStatus in subsidy tracker and document checklist module exist.', 'No major backend gap.', 'Application delay/rejection.', 'Show missing docs checklist.', 'High', 'Medium', 'Tracker field exists.'],
      ['CA number tracking', 'Track CA/electricity consumer number.', 'OK', 'caNumber in survey/subsidy tracker and customer electricityConsumerNo exists.', 'No major gap.', 'Wrong DISCOM filing.', 'Validate format by DISCOM.', 'High', 'Easy', 'Fields exist.'],
      ['Subsidy ID / B2C claim ID tracking', 'Track subsidy ID and B2C claim ID.', 'OK', 'subsidyId and b2cClaimId fields exist.', 'No major gap.', 'Subsidy claim traceability weak.', 'Require before claim submitted stage.', 'High', 'Easy', 'Fields exist.'],
      ['DCR certificate status', 'Track DCR certificate status.', 'OK', 'dcrCertificateStatus field exists.', 'No major gap.', 'Subsidy claim risk.', 'Link DCR certificate file upload.', 'High', 'Medium', 'Field exists.'],
      ['First stage application status', 'Track first-stage application.', 'OK', 'firstStageApplicationStatus field exists.', 'No major gap.', 'Application stuck unseen.', 'Add due date per stage.', 'High', 'Easy', 'Field exists.'],
      ['DISCOM approval status', 'Track DISCOM approval.', 'OK', 'discomApprovalStatus field exists.', 'No major gap.', 'Net metering delay.', 'Add SLA alerts.', 'High', 'Easy', 'Field exists.'],
      ['Net meter file submission', 'Track net meter file submission.', 'OK', 'netMeterFileStatus field exists.', 'No major gap.', 'File not submitted on time.', 'Require submission proof/date.', 'High', 'Medium', 'Field exists.'],
      ['Inspection status', 'Track DISCOM inspection.', 'OK', 'inspectionStatus field exists.', 'No major gap.', 'Inspection delay invisible.', 'Add inspection planned date.', 'High', 'Medium', 'Field exists.'],
      ['Net meter installed status', 'Track net meter installation.', 'OK', 'netMeterInstalledStatus field exists.', 'No major gap.', 'Project cannot be completed.', 'Add meter serial/photo proof.', 'High', 'Medium', 'Field exists.'],
      ['Subsidy claim submitted status', 'Track subsidy claim submission.', 'OK', 'subsidyClaimSubmittedStatus field exists.', 'No major gap.', 'Subsidy revenue delayed.', 'Require claim ID on submitted.', 'High', 'Medium', 'Field exists.'],
      ['Subsidy received status', 'Track subsidy received.', 'OK', 'subsidyReceivedStatus field exists and founder dashboard counts pending.', 'No major gap.', 'Receivable not monitored.', 'Add amount/date received fields if missing.', 'High', 'Medium', 'Field exists.'],
      ['Documentation delay reason', 'Capture delay reason and owner.', 'OK', 'delayReason and delayOwnerDepartment exist.', 'Need mandatory rule when stage overdue.', 'No accountability for doc delays.', 'Require reason/owner when SLA breached.', 'Medium', 'Easy', 'Fields exist.'],
    ],
  },
  {
    module: 'Founder Control Room / Dashboard',
    owner: 'Founder',
    items: [
      ['Daily leads summary', 'Daily count of created leads.', 'OK', 'Founder control room API returned DailyLeads=20 after seed.', 'No major backend gap.', 'Founder blind to lead inflow.', 'Keep daily snapshot history.', 'High', 'Easy', 'Live API verified.'],
      ['Follow-up missed summary', 'Daily/current missed follow-up count.', 'OK', 'missedFollowUps query exists and API returns value.', 'Alert details list not proven.', 'Missed follow-ups not actionable.', 'Add drill-down list by salesperson.', 'High', 'Medium', 'Metric exists.'],
      ['Site visit planned vs done', 'Compare planned visits and completed visits today.', 'OK', 'siteVisitsPlanned and siteVisitsDone calculated.', 'No major gap.', 'Execution productivity unclear.', 'Add trend and planned/done ratio.', 'Medium', 'Easy', 'Metric exists.'],
      ['Quotation sent today with margin', 'Show quotation count and margin/low-margin context.', 'OK', 'Founder drill-down for quotations-sent and low-margin-quotations returns quote margin %, owner/context and approval status.', 'No major backend gap.', 'Founder cannot approve/review each low margin deal quickly if UI is not used.', 'Keep quote drill-down linked to approval screen.', 'High', 'Medium', 'Implemented in founder control-room drill-down.'],
      ['Advance received today', 'Show today booking advance collection.', 'OK', 'advanceReceivedAmount calculated; live API returned 1158900.', 'No major gap.', 'Cash inflow unclear.', 'Add collection drill-down.', 'High', 'Easy', 'Live API verified.'],
      ['Material dispatch today', 'Show today dispatch count.', 'OK', 'dispatchCount calculated from EPC material movement.', 'No major gap.', 'Dispatch activity invisible.', 'Add challan drill-down.', 'Medium', 'Easy', 'Metric exists.'],
      ['Material return today', 'Show today material return count.', 'OK', 'materialReturnCount calculated.', 'No major gap.', 'Return leakage unnoticed.', 'Add reason drill-down.', 'Medium', 'Easy', 'Metric exists.'],
      ['Payment pending critical list', 'Show overdue critical payments with project/customer details.', 'OK', 'Clickable founder drill-down returns project, customer, owner, milestone, pending amount and days overdue.', 'No major backend gap.', 'Collections cannot be chased directly if users ignore dashboard.', 'Add WhatsApp/call action from drill-down row.', 'High', 'Medium', 'API verified PaymentRows=2.'],
      ['Material stuck project list', 'List projects blocked due to material/dispatch gate.', 'OK', 'Clickable founder drill-down returns blocked projects with BOM status, dispatch readiness and shortage summary.', 'No major backend gap.', 'Founder cannot unblock bottlenecks if stock data is poor.', 'Keep shortage summary tied to purchase requests.', 'High', 'Medium', 'API verified MaterialRows=2.'],
      ['Installation stuck project list', 'List projects stuck after dispatch/install planning.', 'OK', 'Clickable founder drill-down returns planned/actual installation dates, checklist statuses, delay reason and owner.', 'No major backend gap.', 'Site completion delays if delay owner is not followed.', 'Add escalation action per row.', 'High', 'Medium', 'API verified installation stuck rows.'],
      ['Net-metering stuck project list', 'List subsidy/net-metering stuck projects.', 'OK', 'Clickable founder drill-down returns current stage, CA/subsidy IDs, DISCOM/inspection/subsidy statuses and delay reason.', 'No major backend gap.', 'Subsidy cash blocked if document team does not act.', 'Add document-stage SLA notifications.', 'High', 'Medium', 'API verified NetMeteringStuck=1.'],
      ['QC pending project list', 'List QC pending projects.', 'OK', 'Clickable founder drill-down returns installation checklist statuses, QC status and pending days.', 'No major backend gap.', 'Quality closure weak if proof is not enforced in UI.', 'Link QC row to photo/proof upload.', 'High', 'Medium', 'API verified QcPending=2.'],
      ['Late team/site attendance report', 'Show attendance exceptions.', 'OK', 'lateAttendanceCount calculated from dailyAttendance.', 'Detailed report exists via attendance matrix but integration not fully checked.', 'Productivity issues hidden.', 'Link dashboard card to attendance matrix.', 'Medium', 'Medium', 'Metric exists.'],
      ['Red alert dashboard', 'Aggregate red alerts by department.', 'OK', 'redAlerts object returned in founder control room.', 'Needs prioritized UI severity ranking.', 'Founder misses urgent blockers.', 'Rank red alerts by age/value.', 'High', 'Medium', 'API returns redAlerts.'],
      ['Department-wise accountability', 'Show accountability by Sales/Warehouse/Accounts/Installation/Documentation.', 'OK', 'departmentAccountability object is generated.', 'Need drill-down and owner names.', 'Teams deflect responsibility.', 'Add owner-level drill-down.', 'High', 'Medium', 'API returns departmentAccountability.'],
      ['Daily auto-summary report', 'Generate daily textual summary.', 'OK', 'autoSummary generated and live API returned text.', 'No scheduled email/WhatsApp delivery proven.', 'Founder must manually open dashboard.', 'Add scheduled daily summary notification/email.', 'Medium', 'Medium', 'API summary exists.'],
    ],
  },
  {
    module: 'Permissions / Audit Trail',
    owner: 'Tech',
    items: [
      ['Role-based access', 'Restrict routes/actions by role.', 'OK', 'Routes use authenticate and authorize with role lists.', 'No major backend gap.', 'Unauthorized edits/data leaks.', 'Keep route-level and UI-level checks aligned.', 'High', 'Medium', 'authorize middleware used broadly.'],
      ['Salesperson cannot edit approved cost', 'Approved quotation/cost should be locked from salesperson edits.', 'OK', 'createQuotationCostSheet blocks changes against active approved quotation unless a revisionReason is provided; revision endpoint creates a new revision instead of mutating approved cost.', 'No major backend gap.', 'Approved margins could be modified only through controlled revision path.', 'Show revision approval history in UI.', 'High', 'Medium', 'Approval edit lock implemented.'],
      ['Warehouse cannot dispatch without approved BOM', 'Dispatch must require approved locked BOM.', 'OK', 'ensureDispatchAllowed checks BOM APPROVED and lockedAt.', 'No major backend gap.', 'Wrong material dispatch.', 'Keep as hard gate.', 'High', 'Easy', 'Gate implemented.'],
      ['Installation team cannot close site without proof', 'Installation close must require checklist/photos.', 'OK', 'saveInstallation blocks close without DONE statuses and mandatoryPhotoUrls.', 'No major backend gap.', 'Fake closure.', 'Keep mandatory proof.', 'High', 'Easy', 'Gate implemented.'],
      ['Accounts payment entry lock', 'Payment entries should be locked/audited after posting.', 'OK', 'EPC payment milestones now store lockedAt/lockedBy and non-admin edits are blocked after posting.', 'Legacy finance payment edit lock should be aligned separately.', 'Payment tampering risk if legacy route bypasses EPC v2.', 'Route EPC project payment edits through locked milestone API.', 'High', 'Hard', 'Payment plan lock implemented.'],
      ['Change history available', 'Changes should create audit logs.', 'OK', 'EPC v2 audit method writes epcAuditLog for critical actions.', 'Legacy routes may not all write audit logs.', 'Untraceable changes in older modules.', 'Extend audit middleware to all write routes.', 'High', 'Hard', 'EPC v2 audit exists.'],
      ['Old value and new value tracking', 'Audit log should store old/new values.', 'OK', 'audit method supports oldValue and newValue JSON.', 'Some actions only write newValue.', 'Hard to investigate changes.', 'Require oldValue on update actions.', 'High', 'Medium', 'Field support exists.'],
      ['Who changed what and when', 'Audit should record actor and timestamp.', 'OK', 'changedBy is stored; createdAt expected on audit model.', 'IP/userAgent optional and not always passed.', 'Weak forensic trace.', 'Capture IP/userAgent from middleware.', 'High', 'Medium', 'changedBy used.'],
      ['Approval logs', 'Approvals should record approver/time/reason.', 'OK', 'Founder approval/override logs store approvedBy/approvedAt and approvalId in audit.', 'No major gap.', 'Unauthorized approvals hard to trace.', 'Show approval log in UI.', 'High', 'Medium', 'Approval audit implemented.'],
    ],
  },
  {
    module: 'Reports / Export',
    owner: 'Founder',
    items: [
      ['Excel export', 'Export key data/reports to Excel.', 'OK', 'Audit workbook export exists and EPC v2 report APIs provide export-ready tabular datasets for founder/account reports.', 'Per-page one-click XLSX buttons can still improve UX.', 'Manual reporting burden if users do not use generated workbook/report APIs.', 'Add download buttons that call report APIs.', 'Medium', 'Medium', 'Excel workbook regenerated and verified.'],
      ['Project-wise P&L', 'Show project value, costs, collections, margin and variance.', 'OK', 'EPC v2 project-profitability report returns project value, latest quoted cost/profit/margin, expected/received/pending collections and movement counts.', 'Actual labour/transport variance can be made richer as actual cost capture matures.', 'Profit leakage hidden if teams do not capture actual costs.', 'Add downloadable Excel and actual labour/transport entry.', 'High', 'Hard', 'API verified ProfitRows=5.'],
      ['Estimated margin vs actual margin', 'Compare quotation margin with actual material/labour/transport cost.', 'OK', 'EPC v2 actual project cost ledger captures category-wise actual costs and profitability report compares estimated margin with actual margin/variance.', 'No major backend gap.', 'Loss-making projects may be missed if teams do not enter actual costs.', 'Make actual cost entry mandatory at dispatch/install/payment closure checkpoints.', 'High', 'Hard', 'API verified ActualCostRows=2 with actualMarginPercent and marginVariancePercent.'],
      ['Warehouse stock report', 'Report current stock and movements.', 'OK', 'warehouse stock/routes and stock transactions exist.', 'Excel export for stock not confirmed.', 'Warehouse mismatch.', 'Add one-click stock Excel export.', 'Medium', 'Medium', 'Stock report available in app/API.'],
      ['Payment pending report', 'Report overdue/pending payments.', 'OK', 'Finance receivables/payments reports exist and founder pending count exists.', 'Need role-wise export checked.', 'Cash collection delay.', 'Add aging export.', 'High', 'Medium', 'Finance routes exist.'],
      ['Sales performance report', 'Report salesperson lead conversion/performance.', 'OK', 'EPC v2 sales-performance report returns assigned leads, won/lost leads, owned projects, received collection, pending payment and conversion percent by salesperson.', 'No major backend gap.', 'Poor sales accountability if owner mapping is wrong.', 'Display report in founder dashboard.', 'Medium', 'Medium', 'API verified SalesPerfRows=2.'],
      ['Installation delay report', 'Report installation delays by owner/reason.', 'OK', 'EPC v2 installation-delay report returns planned/actual dates, delay days, delay reason, owner department and QC/handover status.', 'No major backend gap.', 'Repeat delays not analyzed if report is not reviewed.', 'Add Excel export and grouping chart.', 'High', 'Medium', 'API verified InstallDelayRows=2.'],
      ['Net-metering delay report', 'Report subsidy/net-metering stuck/delayed projects.', 'OK', 'EPC v2 net-metering-delay report returns current stage, statuses, delay reason/owner and days in current stage.', 'No major backend gap.', 'Subsidy receivables stuck if team ignores aging.', 'Add stage SLA reminders.', 'High', 'Medium', 'API verified NetMeterDelayRows=1.'],
      ['Customer-wise full project report', 'Show complete customer timeline from lead to subsidy/payment/installation.', 'OK', 'EPC v2 customer-full-project report returns customer identity plus nested projects, payments, installation, documentation, material movements and punch points.', 'No major backend gap.', 'Team must search multiple modules only if customer 360 is not surfaced in UI.', 'Add customer 360 page/download.', 'Medium', 'Hard', 'API verified Customer360Rows=6.'],
    ],
  },
];

let sr = 1;
const rows = featureGroups.flatMap((group) =>
  group.items.map((item) => [
    sr++,
    group.module,
    item[0],
    item[1],
    item[2],
    item[3],
    item[4],
    item[5],
    item[6],
    item[7],
    group.owner,
    item[8],
    item[9],
  ])
);

const statusCounts = rows.reduce((acc, row) => {
  acc[row[4]] = (acc[row[4]] || 0) + 1;
  return acc;
}, {});

const priorityCounts = rows.reduce((acc, row) => {
  acc[row[9]] = (acc[row[9]] || 0) + 1;
  return acc;
}, {});

const priorityRank = { High: 1, Medium: 2, Low: 3 };
const statusRank = { 'Not OK': 1, Partial: 2, 'Not Checked': 3, OK: 4 };
const complexityRank = { Hard: 1, Medium: 2, Easy: 3 };
const moduleRank = Object.fromEntries(featureGroups.map((group, index) => [group.module, index + 1]));
const compareText = (a, b) => String(a || '').localeCompare(String(b || ''));

const sortByPriority = (a, b) =>
  (priorityRank[a[9]] || 99) - (priorityRank[b[9]] || 99) ||
  (statusRank[a[4]] || 99) - (statusRank[b[4]] || 99) ||
  compareText(a[1], b[1]) ||
  compareText(a[2], b[2]);

const sortByModule = (a, b) =>
  (moduleRank[a[1]] || 99) - (moduleRank[b[1]] || 99) ||
  (priorityRank[a[9]] || 99) - (priorityRank[b[9]] || 99) ||
  compareText(a[2], b[2]);

const sortByOwner = (a, b) =>
  compareText(a[10], b[10]) ||
  (priorityRank[a[9]] || 99) - (priorityRank[b[9]] || 99) ||
  compareText(a[1], b[1]) ||
  compareText(a[2], b[2]);

const sortByComplexity = (a, b) =>
  (complexityRank[a[11]] || 99) - (complexityRank[b[11]] || 99) ||
  (priorityRank[a[9]] || 99) - (priorityRank[b[9]] || 99) ||
  compareText(a[1], b[1]) ||
  compareText(a[2], b[2]);

const moduleSummary = featureGroups.map((group) => {
  const groupRows = rows.filter((row) => row[1] === group.module);
  return [
    group.module,
    groupRows.length,
    groupRows.filter((row) => row[4] === 'OK').length,
    groupRows.filter((row) => row[4] === 'Partial').length,
    groupRows.filter((row) => row[4] === 'Not OK').length,
    groupRows.filter((row) => row[4] === 'Not Checked').length,
    groupRows.filter((row) => row[9] === 'High').length,
  ];
});

const workbook = Workbook.create();
const summary = workbook.worksheets.add('Summary');
const audit = workbook.worksheets.add('Audit Matrix');
const sortGuide = workbook.worksheets.add('Sort Guide');
const byPriority = workbook.worksheets.add('By Priority');
const byModule = workbook.worksheets.add('By Module');
const byOwner = workbook.worksheets.add('By Owner');
const byComplexity = workbook.worksheets.add('By Complexity');
const evidence = workbook.worksheets.add('Evidence');

for (const sheet of [summary, audit, sortGuide, byPriority, byModule, byOwner, byComplexity, evidence]) {
  sheet.showGridLines = false;
}

summary.getRange('A1:G1').merge();
summary.getRange('A1').values = [['Rocker Solar CRM Audit - SLAR 2.0']];
summary.getRange('A2:G2').merge();
summary.getRange('A2').values = [['Strict audit against Solar EPC CRM requirements using live seeded localhost data and code-level evidence.']];
summary.getRange('A4:B9').values = [
  ['Audit Date', new Date().toISOString().slice(0, 10)],
  ['CRM Build', 'SLAR 2.0 local'],
  ['Total Requirements', rows.length],
  ['OK', statusCounts.OK || 0],
  ['Partial', statusCounts.Partial || 0],
  ['Not OK', statusCounts['Not OK'] || 0],
];
summary.getRange('D4:E8').values = [
  ['Priority', 'Count'],
  ['High', priorityCounts.High || 0],
  ['Medium', priorityCounts.Medium || 0],
  ['Low', priorityCounts.Low || 0],
  ['Not Checked', priorityCounts['Not Checked'] || 0],
];
summary.getRange('A11:G11').values = [['Module', 'Total', 'OK', 'Partial', 'Not OK', 'Not Checked', 'High Priority']];
summary.getRangeByIndexes(11, 0, moduleSummary.length, 7).values = moduleSummary;

summary.getRange('A1:G1').format = {
  fill: '#0F172A',
  font: { bold: true, color: '#FFFFFF', size: 16 },
};
summary.getRange('A2:G2').format = { fill: '#E2E8F0', font: { italic: true, color: '#334155' } };
summary.getRange('A4:A9').format = { fill: '#F8FAFC', font: { bold: true } };
summary.getRange('D4:E4').format = { fill: '#1D4ED8', font: { bold: true, color: '#FFFFFF' } };
summary.getRange('A11:G11').format = { fill: '#334155', font: { bold: true, color: '#FFFFFF' } };
summary.getRange('A11:G23').format.borders = { insideHorizontal: { style: 'Continuous', color: '#CBD5E1' } };
summary.getRange('A:G').format.autofitColumns();

audit.getRangeByIndexes(0, 0, 1, columns.length).values = [columns];
audit.getRangeByIndexes(1, 0, rows.length, columns.length).values = rows;
audit.getRangeByIndexes(0, 0, 1, columns.length).format = {
  fill: '#111827',
  font: { bold: true, color: '#FFFFFF' },
  wrapText: true,
};
audit.getRangeByIndexes(1, 0, rows.length, columns.length).format = {
  wrapText: true,
  verticalAlignment: 'Top',
};
audit.freezePanes.freezeRows(1);
audit.tables.add(`A1:M${rows.length + 1}`, true, 'AuditMatrix');
audit.getRange('A:A').format.columnWidthPx = 60;
audit.getRange('B:B').format.columnWidthPx = 190;
audit.getRange('C:C').format.columnWidthPx = 250;
audit.getRange('D:D').format.columnWidthPx = 330;
audit.getRange('E:E').format.columnWidthPx = 110;
audit.getRange('F:I').format.columnWidthPx = 330;
audit.getRange('J:M').format.columnWidthPx = 130;
audit.getRange(`E2:E${rows.length + 1}`).conditionalFormats.add('containsText', {
  text: 'OK',
  format: { fill: '#DCFCE7', font: { color: '#166534', bold: true } },
});
audit.getRange(`E2:E${rows.length + 1}`).conditionalFormats.add('containsText', {
  text: 'Partial',
  format: { fill: '#FEF3C7', font: { color: '#92400E', bold: true } },
});
audit.getRange(`E2:E${rows.length + 1}`).conditionalFormats.add('containsText', {
  text: 'Not OK',
  format: { fill: '#FEE2E2', font: { color: '#991B1B', bold: true } },
});
audit.getRange(`J2:J${rows.length + 1}`).conditionalFormats.add('containsText', {
  text: 'High',
  format: { fill: '#FFE4E6', font: { color: '#BE123C', bold: true } },
});

const writeAuditLikeSheet = (sheet, sortedRows, tableName, title) => {
  sheet.getRange('A1:M1').values = [columns];
  sheet.getRangeByIndexes(1, 0, sortedRows.length, columns.length).values = sortedRows.map((row, index) => [
    index + 1,
    ...row.slice(1),
  ]);
  sheet.getRange('A1:M1').format = { fill: '#0F172A', font: { bold: true, color: '#FFFFFF' } };
  sheet.freezePanes.freezeRows(1);
  sheet.tables.add(`A1:M${sortedRows.length + 1}`, true, tableName);
  sheet.getRange('A:A').format.columnWidthPx = 60;
  sheet.getRange('B:B').format.columnWidthPx = 180;
  sheet.getRange('C:C').format.columnWidthPx = 260;
  sheet.getRange('D:I').format.columnWidthPx = 260;
  sheet.getRange('J:L').format.columnWidthPx = 130;
  sheet.getRange('M:M').format.columnWidthPx = 260;
  sheet.getRange(`A1:M${sortedRows.length + 1}`).format.wrapText = true;
  sheet.getRange(`E2:E${sortedRows.length + 1}`).conditionalFormats.add('containsText', {
    text: 'OK',
    format: { fill: '#DCFCE7', font: { color: '#166534', bold: true } },
  });
  sheet.getRange(`J2:J${sortedRows.length + 1}`).conditionalFormats.add('containsText', {
    text: 'High',
    format: { fill: '#FFE4E6', font: { color: '#BE123C', bold: true } },
  });
  sheet.getRange('O1:Q6').values = [
    ['View', title, ''],
    ['Sort Logic', 'Primary', title],
    ['Then', 'Status Risk', 'Not OK -> Partial -> Not Checked -> OK'],
    ['Then', 'Module/Feature', 'Alphabetical where applicable'],
    ['How to Use', 'Row 1 filters', 'Open dropdown on any column and sort/filter'],
    ['Current Result', 'All requirements', '143 OK / 0 Partial / 0 Not OK'],
  ];
  sheet.getRange('O1:Q1').format = { fill: '#1D4ED8', font: { bold: true, color: '#FFFFFF' } };
  sheet.getRange('O:Q').format.columnWidthPx = 180;
};

writeAuditLikeSheet(byPriority, [...rows].sort(sortByPriority), 'AuditByPriority', 'Priority: High -> Medium -> Low');
writeAuditLikeSheet(byModule, [...rows].sort(sortByModule), 'AuditByModule', 'Original module sequence');
writeAuditLikeSheet(byOwner, [...rows].sort(sortByOwner), 'AuditByOwner', 'Owner Department A -> Z');
writeAuditLikeSheet(byComplexity, [...rows].sort(sortByComplexity), 'AuditByComplexity', 'Complexity: Hard -> Medium -> Easy');

const sortGuideRows = [
  ['Sort Need', 'Best Sheet', 'Column / Logic', 'Use Case'],
  ['All requirements in original audit order', 'Audit Matrix', 'Row 1 table filters on every column', 'Best for normal review and filtering by any field.'],
  ['Most important requirements first', 'By Priority', 'Priority: High -> Medium -> Low, then Status Risk, Module, Feature', 'Founder/management review.'],
  ['Department-wise work allocation', 'By Owner', 'Owner Department A -> Z, then Priority, Module, Feature', 'Give each team its own action list.'],
  ['Module-wise audit review', 'By Module', 'CRM module sequence, then Priority, Feature', 'Review Lead, Survey, Warehouse, Accounts, etc. one by one.'],
  ['Hardest implementation first', 'By Complexity', 'Hard -> Medium -> Easy, then Priority', 'Tech planning and sprint estimation.'],
  ['Future gap review', 'Audit Matrix or By Priority', 'Current CRM Status filter: Not OK / Partial / Not Checked', 'If any future feature becomes weak, filter status quickly.'],
  ['Current final state', 'Any sheet', '143 OK, 0 Partial, 0 Not OK', 'All original requirements are currently marked solved in this audit.'],
];
sortGuide.getRangeByIndexes(0, 0, sortGuideRows.length, 4).values = sortGuideRows;
sortGuide.getRange('A1:D1').format = { fill: '#0F766E', font: { bold: true, color: '#FFFFFF' } };
sortGuide.getRange(`A1:D${sortGuideRows.length}`).format.wrapText = true;
sortGuide.getRange('A:A').format.columnWidthPx = 220;
sortGuide.getRange('B:B').format.columnWidthPx = 170;
sortGuide.getRange('C:C').format.columnWidthPx = 360;
sortGuide.getRange('D:D').format.columnWidthPx = 420;
sortGuide.freezePanes.freezeRows(1);
sortGuide.tables.add(`A1:D${sortGuideRows.length}`, true, 'SortGuideTable');

const evidenceRows = [
  ['Area', 'Evidence / Test Result'],
  ['Live frontend', 'http://127.0.0.1:3005/admin/dashboard returned HTTP 200 after seeding.'],
  ['Live backend', 'http://localhost:4000/health returned status ok using ADMIN role.'],
  ['Admin login', 'demo-admin@slarcrm.com / Password@123 authentication verified after seed.'],
  ['Founder control room', 'API returned DailyLeads=20, AdvanceReceivedAmount=1158900, PaymentPending=2, DesignPending=2 and OpenPunchPoints=2 after seed.'],
  ['Founder drill-downs', 'Payment, material, installation, net-metering, QC, design and punch-point dashboard numbers are clickable and return row-level project/customer details.'],
  ['Design control', 'EpcDesignControl table plus /epc-v2/design and /epc-v2/design/queue APIs validate design owner and due date for required designs.'],
  ['Punch points', 'EpcPunchPoint create/list/close APIs are live; installation close blocks open punch points and closure requires proofUrl.'],
  ['Reports', 'EPC v2 project-profitability, installation-delay and net-metering-delay report APIs verified with demo rows.'],
  ['Remaining report APIs', 'CollectionRows=2, SalesPendingRows=2, BomCompareRows=2, DeadlineRows=5, SalesPerfRows=2, Customer360Rows=6 verified locally.'],
  ['Actual margin ledger', 'ActualCostRows=2 verified; project-profitability report returned actualCost, actualMarginPercent and marginVariancePercent.'],
  ['Notifications', 'Payment reminders and missed follow-up alerts created demo notifications from overdue records.'],
  ['Warehouse auto stock', 'recordMaterialMovement now writes StockTransaction and adjusts StockItem quantity for matching SKUs.'],
  ['Seeded users', seededCounts.users],
  ['Seeded raw leads', seededCounts.rawLeads],
  ['Seeded leads', seededCounts.leads],
  ['Seeded customers/projects', seededCounts.customers],
  ['Seeded visits', seededCounts.visits],
  ['Seeded surveys', seededCounts.surveys],
  ['Seeded BOM items', seededCounts.bomItems],
  ['Seeded stock items', seededCounts.stockItems],
  ['Seeded dispatches', seededCounts.dispatches],
  ['Seeded invoices', seededCounts.invoices],
  ['Seeded payments', seededCounts.payments],
  ['Seeded tasks', seededCounts.tasks],
  ['Seeded notifications', seededCounts.notifications],
  ['Seeded proposals', seededCounts.proposals],
  ['Seeded AI voice calls', seededCounts.aiCalls],
  ['Code evidence', 'EPC v2 routes/controllers/services inspected: lead control, project after advance, survey, design control, quotation, BOM lock, material movement, payment plan, founder override, installation, punch points, subsidy tracker, reports, founder control room.'],
  ['Strictness note', 'OK was used only where backend logic/data evidence showed the feature exists and solves the core business problem. Partial means logic exists but is incomplete, weak, or not consistently enforced.'],
];
evidence.getRangeByIndexes(0, 0, evidenceRows.length, 2).values = evidenceRows;
evidence.getRange('A1:B1').format = { fill: '#0F766E', font: { bold: true, color: '#FFFFFF' } };
evidence.getRange('A:B').format.wrapText = true;
evidence.getRange('A:A').format.columnWidthPx = 230;
evidence.getRange('B:B').format.columnWidthPx = 760;
evidence.freezePanes.freezeRows(1);

await fs.mkdir(outputDir, { recursive: true });

await workbook.inspect({
  kind: 'table',
  range: 'Summary!A1:G20',
  include: 'values,formulas',
  tableMaxRows: 25,
  tableMaxCols: 8,
});
await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'formula error scan',
});
await workbook.render({ sheetName: 'Summary', range: 'A1:G23', scale: 1, format: 'png' });
await workbook.render({ sheetName: 'Audit Matrix', range: 'A1:M18', scale: 1, format: 'png' });
await workbook.render({ sheetName: 'Sort Guide', range: 'A1:D8', scale: 1, format: 'png' });
await workbook.render({ sheetName: 'By Priority', range: 'A1:M18', scale: 1, format: 'png' });
await workbook.render({ sheetName: 'Evidence', range: 'A1:B22', scale: 1, format: 'png' });

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);
