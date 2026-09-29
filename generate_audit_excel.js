const XLSX = require('xlsx');
const path = require('path');

const auditData = [
  [
    "Sr. No.", "Module", "Feature / Requirement", "Required Logic / Expected Behaviour", 
    "Current CRM Status", "Current CRM Observation", "Gap / Problem", "Business Risk", 
    "Suggested Solution", "Priority", "Owner Department", "Complexity", "Remarks"
  ],
  // 1. Lead Management
  [
    "1", "Lead Management", "Lead creation", "Allows manual lead addition and API integration", 
    "OK", "Handled successfully in rawLead.controller.ts and lead.controller.ts", 
    "None. The API endpoints and structures exist.", "None.", 
    "N/A", "High", "Sales", "Easy", "Core lead creation is stable."
  ],
  [
    "2", "Lead Management", "Duplicate lead detection", "Detect duplicates by mobile number, CA number, address, and name", 
    "Partial", "Checks duplicate by phone number only in lead.controller.ts line 193", 
    "Checks only mobile number. CA number, address, and customer name duplication checks are missing.", 
    "Sales reps will accidentally enter duplicate leads, leading to multiple salesperson calls and reputational damage.", 
    "Expand findUnique query to search CA number, address, and normalized names before creating leads.", 
    "High", "Sales", "Medium", "Crucial to prevent double calling."
  ],
  [
    "3", "Lead Management", "Lead source tracking", "Allows tracking where leads are coming from (Ads, Excel, Manual)", 
    "OK", "Tracks source via LeadSource enum in prisma schema", 
    "None. Supported natively in Database and controller.", "None.", 
    "N/A", "Medium", "Sales", "Easy", "Proper source tagging is active."
  ],
  [
    "4", "Lead Management", "Salesperson assignment", "Assign leads dynamically or manually to field sales reps", 
    "OK", "Handled natively via assignedSalesperson in Lead model", 
    "None. Supported and functional.", "None.", 
    "N/A", "High", "Sales", "Easy", "Auto-linked to salesperson profiles."
  ],
  [
    "5", "Lead Management", "Follow-up date mandatory", "Enforce follow-up date and time for active pipeline leads", 
    "Partial", "Database supports followUpAt field but not enforced in lead controllers", 
    "Salespeople can save lead updates without setting a mandatory next follow-up date.", 
    "Leads will go cold as reps forget to set follow-up schedules.", 
    "Add controller validation: require followUpAt for all non-won/lost leads.", 
    "High", "Sales", "Easy", "Ensures reps are continuously prompted."
  ],
  [
    "6", "Lead Management", "Missed follow-up alert", "Provide system notifications for delayed follow-ups", 
    "Not OK", "No background cron or automated alert service triggers for missed dates", 
    "System does not alert the rep or supervisor when a follow-up date is missed.", 
    "Delayed follow-ups will be ignored, resulting in lost sales.", 
    "Create a daily background node-cron task that alerts supervisors and reps of missed follow-up dates.", 
    "High", "Sales", "Medium", "Important for supervisor control."
  ],
  [
    "7", "Lead Management", "Lead stage tracking", "Tracks stages in the sales funnel", 
    "OK", "Tracks via LeadStatus enums from NEW to WON/LOST", 
    "None. Handled perfectly.", "None.", 
    "N/A", "High", "Sales", "Easy", "Fully aligned with funnel stages."
  ],
  [
    "8", "Lead Management", "Lost reason tracking", "Mandatory tracking of why a lead was lost", 
    "OK", "Includes lostReason string field in Lead model", 
    "None. Handled correctly.", "None.", 
    "N/A", "Medium", "Sales", "Easy", "Allows analysis of why deals fall through."
  ],
  [
    "9", "Lead Management", "Hot lead tracking", "Flag high-priority/hot leads", 
    "Not OK", "No column or logic in schema to flag hot or high-priority leads", 
    "Reps cannot prioritize high-probability leads.", 
    "High-value leads get lost in a cluttered pipeline.", 
    "Add a priority field (HOT, WARM, COLD) to the Lead and RawLead models.", 
    "Medium", "Sales", "Easy", "Helps reps target high-value clients first."
  ],
  [
    "10", "Lead Management", "Lead to project conversion", "Auto-creates project (Customer) upon receiving booking advance", 
    "OK", "Auto-converts to Customer on proposal acceptance and advance payment", 
    "None. Handled in acceptProposal controller.", "None.", 
    "N/A", "High", "Founder", "Easy", "Works perfectly."
  ],
  // 2. Site Visit / Survey
  [
    "11", "Site Visit / Survey", "Site visit booking", "Schedule sales/site visits with customers", 
    "OK", "Fully supported in visit.controller.ts", 
    "None.", "None.", 
    "N/A", "High", "Project", "Easy", "Excellent calendar-backed scheduling."
  ],
  [
    "12", "Site Visit / Survey", "Survey person assignment", "Assign surveyors to scheduled site visits", 
    "OK", "Handled via assignedTo user id mapping in Visit model", 
    "None.", "None.", 
    "N/A", "High", "Project", "Easy", "Links correctly to surveyor mobile apps."
  ],
  [
    "13", "Site Visit / Survey", "Roof/ground type capture", "Record rooftop types (Flat Concrete, Metal Sheet, Ground Mount)", 
    "OK", "Mapped in SiteSurvey.roofType text", 
    "None.", "None.", 
    "N/A", "High", "Installation", "Easy", "Essential for mounting structures."
  ],
  [
    "14", "Site Visit / Survey", "Site photos upload", "Mandatory site photo upload during structural survey", 
    "OK", "Handled via uploadDocuments in visit.controller.ts", 
    "None.", "None.", 
    "N/A", "High", "Installation", "Easy", "Photos uploaded to S3 bucket."
  ],
  [
    "15", "Site Visit / Survey", "Location pin upload", "Upload location pin coordinates", 
    "OK", "Tracks lat/lng on Customer and Lead models", 
    "None.", "None.", 
    "N/A", "High", "Sales", "Easy", "Crucial for map-based field routing."
  ],
  [
    "16", "Site Visit / Survey", "Load and sanction load capture", "Capture DISCOM sanctioned load in kW", 
    "OK", "sanctionedLoad exists on Customer model", 
    "None.", "None.", 
    "N/A", "High", "Documentation", "Easy", "Used for sizing system bounds."
  ],
  [
    "17", "Site Visit / Survey", "Shadow issue capture", "Document shadowing issues from adjacent trees/buildings", 
    "OK", "Captured as shadowAnalysis text in SiteSurvey", 
    "None.", "None.", 
    "N/A", "High", "Installation", "Easy", "Ensures high panel output."
  ],
  [
    "18", "Site Visit / Survey", "Structure requirement capture", "Details special structures (e.g. Elevated GI structure)", 
    "OK", "Captured as structureDetails text in SiteSurvey", 
    "None.", "None.", 
    "N/A", "Medium", "Installation", "Easy", "Prevents design errors."
  ],
  [
    "19", "Site Visit / Survey", "Survey checklist", "Standard checklist parameters during survey", 
    "Partial", "SiteSurvey model captures raw text fields, but lacks interactive checkbox array", 
    "No structured checklist checks (e.g. earthing space, water access, cable path).", 
    "Surveyors miss critical rooftop details, causing design mistakes later.", 
    "Add a JSON checklist template to the SiteSurvey database schema.", 
    "Medium", "Installation", "Easy", "Improves data consistency."
  ],
  [
    "20", "Site Visit / Survey", "Site visit status tracking", "Tracks whether site visits are completed, scheduled, or checked-in", 
    "OK", "Uses VisitStatus enums (SCHEDULED, CHECKED_IN, COMPLETED)", 
    "None.", "None.", 
    "N/A", "High", "Project", "Easy", "Fully trackable on salesperson dashboards."
  ],
  // 3. Quotation / PI / Margin Approval
  [
    "21", "Quotation / PI / Margin Approval", "Quotation creation", "Generate quotation options for leads", 
    "OK", "Available via SolarProposal creation in proposal.controller.ts", 
    "None.", "None.", 
    "N/A", "High", "Sales", "Easy", "Highly robust proposal model."
  ],
  [
    "22", "Quotation / PI / Margin Approval", "Module brand/wattage selection", "Select panel brands and wattages", 
    "OK", "Captured natively as panelBrand, panelModel, panelWattage", 
    "None.", "None.", 
    "N/A", "High", "Sales", "Easy", "Critical for PM Surya scheme."
  ],
  [
    "23", "Quotation / PI / Margin Approval", "Inverter brand/kW selection", "Select inverter hybrid specs", 
    "OK", "Captured natively as inverterBrand, inverterCapacity", 
    "None.", "None.", 
    "N/A", "High", "Sales", "Easy", "Matches grid sync requirements."
  ],
  [
    "24", "Quotation / PI / Margin Approval", "Structure cost entry", "Separate cost entry for special high-rise mounting structures", 
    "Not OK", "No dedicated field for structure costs in SolarProposal schema", 
    "Salespeople bundle structure costs into totalCost, hiding margins.", 
    "Inaccurate profitability reports for elevated projects.", 
    "Add structureCost, labourCost, transportationCost, and netmeteringCost fields to SolarProposal.", 
    "High", "Sales", "Easy", "Allows accurate P&L calculation."
  ],
  [
    "25", "Quotation / PI / Margin Approval", "Labour/I&C cost entry", "Separate entry for labor and commissioning charges", 
    "Not OK", "Labour/commissioning costs are not tracked in SolarProposal", 
    "Cannot calculate gross margin precisely.", 
    "Over-discounting deals below actual labor cost parameters.", 
    "Add labourCost and integrationCost columns to SolarProposal schema.", 
    "High", "Accounts", "Easy", "Crucial for margin control."
  ],
  [
    "26", "Quotation / PI / Margin Approval", "Transportation cost entry", "Tracks transport/shipping expenses to site", 
    "Not OK", "Transportation cost field is missing", 
    "Shipping expenses are unmonitored.", 
    "Unexpected logistics costs eat into project margins.", 
    "Add a transportationCost field to the SolarProposal schema.", 
    "Medium", "Warehouse", "Easy", "Enables logistics cost tracking."
  ],
  [
    "27", "Quotation / PI / Margin Approval", "Net-metering/subsidy cost entry", "Tracks government liaison and net-metering expenses", 
    "Not OK", "Net-metering cost field is missing", 
    "Official and unofficial liaison costs are not accounted for.", 
    "Liaison costs are neglected, reducing actual deal profit.", 
    "Add netMeteringCost and governmentLiaisonCost to the proposal schema.", 
    "Medium", "Documentation", "Easy", "Improves final pricing calculations."
  ],
  [
    "28", "Quotation / PI / Margin Approval", "Total cost calculation", "Automatically sums up BOM costs", 
    "Not OK", "No cost engine; totalCost is a manually input field", 
    "No automatic calculations for sub-cost sums.", 
    "Sales reps make arithmetic errors in client quotes.", 
    "Implement an automatic sum formula in proposal controllers: totalCost = sum of sub-costs.", 
    "High", "Tech", "Easy", "Prevents quoting errors."
  ],
  [
    "29", "Quotation / PI / Margin Approval", "Selling price calculation", "Calculates final customer price after profit margins", 
    "Not OK", "No selling price markup formula exists", 
    "Pricing is set manually without structured profit markups.", 
    "Unplanned discounts leading to unprofitable client acquisitions.", 
    "Define a structured pricing engine with standard markup rules.", 
    "High", "Founder", "Easy", "Ensures structured price quotes."
  ],
  [
    "30", "Quotation / PI / Margin Approval", "Gross profit calculation", "Calculates (Selling Price - Total Project Cost)", 
    "Not OK", "No grossProfit column or formula exists in proposal controller", 
    "Sales reps cannot see actual gross profit of a deal.", 
    "Selling low-margin systems that harm business operations.", 
    "Add a grossProfit field to the schema, auto-calculated on save.", 
    "High", "Accounts", "Easy", "Essential for business viability."
  ],
  [
    "31", "Quotation / PI / Margin Approval", "Margin percentage calculation", "Calculates margin % relative to deal value", 
    "Not OK", "No margin percentage tracking exists", 
    "No structured parameters to check if a deal meets company margin standards.", 
    "Sales reps quote deep discounts to close deals, hurting overall profits.", 
    "Create a marginPercentage field in the proposal schema.", 
    "High", "Founder", "Easy", "Guarantees profitable deals."
  ],
  [
    "32", "Quotation / PI / Margin Approval", "Low margin warning", "Alerts when margin drops below threshold (e.g. < 15%)", 
    "Not OK", "No system warnings exist for low profit margins", 
    "No automatic detection of low-profit quotations.", 
    "Deeply discounted quotes are sent to customers without detection.", 
    "Generate a warning alert inside the CRM when margin is below 15%.", 
    "High", "Tech", "Easy", "Protects gross profit margins."
  ],
  [
    "33", "Quotation / PI / Margin Approval", "Founder approval for low-margin", "Requires Founder approval override to activate low-margin deal", 
    "Not OK", "No approval flow exists; sales reps can accept any proposal status", 
    "Reps can bypass profitability rules without executive authorization.", 
    "Loss-making deals are signed, harming business cash flow.", 
    "Lock proposal acceptance if margin is below 15% until a Founder OTP or override code is logged.", 
    "High", "Founder", "Medium", "Ultimate margin gatekeeper."
  ],
  [
    "34", "Quotation / PI / Margin Approval", "Quotation revision history", "Tracks revisions of quotes (Version 1, 2, 3)", 
    "OK", "Handled nicely using parentProposalId and revisions relation", 
    "None.", "None.", 
    "N/A", "High", "Sales", "Easy", "Excellent proposal versioning."
  ],
  [
    "35", "Quotation / PI / Margin Approval", "Quotation sent status", "Tracks when proposal is sent to client", 
    "OK", "Handled via sendProposal controller, sets status to SENT", 
    "None.", "None.", 
    "N/A", "High", "Sales", "Easy", "Allows funnel progression."
  ],
  // 4. Project Creation
  [
    "36", "Project Creation", "Auto project creation after advance", "Generates Customer record upon advance payment", 
    "OK", "Handled natively in acceptProposal controller which marks lead as WON", 
    "None.", "None.", 
    "N/A", "High", "Project", "Easy", "Ensures seamless operation handoff."
  ],
  [
    "37", "Project Creation", "Customer data transfer", "Copies lead info to customer project file", 
    "OK", "Handled via Customer creation in database", 
    "None.", "None.", 
    "N/A", "High", "Documentation", "Easy", "Prevents duplicate entries."
  ],
  [
    "38", "Project Creation", "Project/Sales/Documentation/Installation owner assignment", "Links specific engineers and staff as project owners", 
    "OK", "Available via assignedDocumentation, assignedInstallation, etc.", 
    "None.", "None.", 
    "N/A", "High", "Project", "Easy", "Clear operational accountability."
  ],
  [
    "39", "Project Creation", "Project stage tracking", "Tracks project execution stages", 
    "OK", "Tracks via CustomerStatus (ACTIVE, INSTALLATION_DONE, COMPLETED)", 
    "None.", "None.", 
    "N/A", "High", "Project", "Easy", "Natively integrated."
  ],
  [
    "40", "Project Creation", "Next action / deadline tracking", "Track deadlines for each milestone task", 
    "Partial", "Handled via general Tasks, but Customer model lacks explicit projectDeadlines", 
    "No consolidated view of overall project deadlines or next critical actions.", 
    "Projects delay beyond promised commissioning dates due to unmonitored deadlines.", 
    "Add plannedCompletionDate and nextActionDeadline fields to Customer.", 
    "High", "Project", "Easy", "Ensures projects are delivered on time."
  ],
  // 5. Design / BOM
  [
    "41", "Design / BOM", "2D design requirement status", "Tracks status of 2D layout designs", 
    "Not OK", "No field or model tracks 2D designs in schema", 
    "Designers have no structured dashboard to upload and track 2D designs.", 
    "Installers mount panels without approved structural designs, risking physical damage.", 
    "Create a DesignTask table or add 2D_DESIGN document type.", 
    "High", "Project", "Easy", "Ensures engineering accuracy."
  ],
  [
    "42", "Design / BOM", "Design assigned / due date", "Track design deadlines and assign designers", 
    "Not OK", "Missing fields to track design assignments and deadlines", 
    "No way to monitor if engineering designs are delayed.", 
    "Installs are delayed because structure drawings are not ready.", 
    "Implement designAssignee and designDueDate fields in Customer.", 
    "Medium", "Project", "Easy", "Reduces engineering delays."
  ],
  [
    "43", "Design / BOM", "BOM creation", "Allows site surveyors to generate Bill of Materials", 
    "OK", "Supported via siteSurvey.controller.ts and BOMItem model", 
    "None.", "None.", 
    "N/A", "High", "Installation", "Easy", "Seamlessly linked to site surveys."
  ],
  [
    "44", "Design / BOM", "BOM approval", "Workflow to approve BOM by Project Head", 
    "Not OK", "No approval status or flow exists in database for BOMs", 
    "Warehouse can dispatch items based on unverified field surveys.", 
    "Excess or incorrect materials are sent to site, causing logistics costs.", 
    "Add a isBOMApproved boolean and bomApprovedBy field to SiteSurvey model.", 
    "High", "Project", "Easy", "Double checks site survey inputs."
  ],
  [
    "45", "Design / BOM", "BOM lock after approval", "Locks BOM from edits after Project Head approval", 
    "Not OK", "BOM items can be edited/updated at any time", 
    "No lock mechanism after approval.", 
    "Reps change materials after approval, causing billing mismatches.", 
    "Add a validation check: reject BOMItem modifications if isBOMApproved is true.", 
    "High", "Tech", "Easy", "Ensures document integrity."
  ],
  [
    "46", "Design / BOM", "BOM revision history", "Tracks changes made to BOMs over time", 
    "Not OK", "No logging of changes to BOM items", 
    "No audit trail of who changed material requirements and why.", 
    "Inability to reconcile estimated vs actual material usage.", 
    "Create a BOMRevision table to store previous versions of BOM items.", 
    "Medium", "Project", "Medium", "Improves material audits."
  ],
  [
    "47", "Design / BOM", "Extra material approval", "Requires manager override for adding extra materials outside BOM", 
    "Not OK", "Warehouse can dispatch extra materials without restrictions", 
    "No approval control for extra inventory requests.", 
    "Severe inventory leakage as unapproved items are sent to site.", 
    "Lock dispatches from exceeding approved BOM quantities unless a manager override is logged.", 
    "High", "Warehouse", "Medium", "Prevents material wastage."
  ],
  [
    "48", "Design / BOM", "Material shortage detection / Dispatch readiness", "Flags dispatch readiness based on stock levels", 
    "OK", "Handled beautifully in warehouse.controller.ts getPipeline and getAlerts", 
    "None.", "None.", 
    "N/A", "High", "Warehouse", "Easy", "Excellent pipeline dashboard."
  ],
  // 6. Warehouse / Inventory
  [
    "49", "Warehouse / Inventory", "Item-wise stock tracking", "Monitor warehouse inventory quantities", 
    "OK", "Supported natively in StockItem model", 
    "None.", "None.", 
    "N/A", "High", "Warehouse", "Easy", "Tracks quantities, low stock, and out-of-stock."
  ],
  [
    "50", "Warehouse / Inventory", "Module brand/wattage/DCR/NDCR tracking", "Differentiates stock by technical specifications", 
    "OK", "Handled via sku properties and categories", 
    "None.", "None.", 
    "N/A", "High", "Warehouse", "Easy", "Essential for PM Surya eligibility."
  ],
  [
    "51", "Warehouse / Inventory", "Panel / Inverter serial number tracking", "Tracks precise panels/inverters by unique barcode/serial numbers", 
    "Not OK", "No field to record panel or inverter serial numbers during dispatch or stock transaction", 
    "Cannot trace which exact panel or inverter went to which customer site.", 
    "Critical warranty failure. If a panel breaks in 3 years, the manufacturer requires the serial number to honor the warranty.", 
    "Add a serialNumbers array (JSON string) to the Dispatch and StockTransaction models.", 
    "High", "Warehouse", "Medium", "Absolutely critical for warranty claims."
  ],
  [
    "52", "Warehouse / Inventory", "Structure / Cable / Accessory tracking", "Tracks accessories by category", 
    "OK", "Natively supported via BOMCategory enums", 
    "None.", "None.", 
    "N/A", "High", "Warehouse", "Easy", "Good structural segregation."
  ],
  [
    "53", "Warehouse / Inventory", "Site-wise material issue", "Deduct stock and allocate to a specific customer", 
    "OK", "Handled via StockTransaction linked to customerId", 
    "None.", "None.", 
    "N/A", "High", "Warehouse", "Easy", "Tracks material outflows accurately."
  ],
  [
    "54", "Warehouse / Inventory", "BOM vs dispatch comparison", "Verify shipped goods against survey design", 
    "OK", "Handled via getPipeline endpoint", 
    "None.", "None.", 
    "N/A", "High", "Warehouse", "Easy", "Prevents incorrect dispatches."
  ],
  [
    "55", "Warehouse / Inventory", "Dispatch challan creation / Material receiver proof", "Generate shipping challan and upload signed proof", 
    "Not OK", "No challan generator or receiver signature upload", 
    "No legal or physical proof that materials arrived on site.", 
    "Customers can claim they never received panels, leading to legal disputes.", 
    "Integrate a PDF challan generator and add a deliveryProofUrl to Dispatch model.", 
    "High", "Accounts", "Medium", "Protects company against fake claims."
  ],
  [
    "56", "Warehouse / Inventory", "Material return / Damaged material tracking", "Record return or damage of surplus items", 
    "Not OK", "No tracking for returns or damaged materials in schema", 
    "Leftover materials on-site are unaccounted for.", 
    "Materials are stolen or damaged on-site without record.", 
    "Add RETURN and DAMAGED types to the TxType enum.", 
    "High", "Warehouse", "Easy", "Essential for post-install reconciliation."
  ],
  [
    "57", "Warehouse / Inventory", "Stock auto update", "Transactions instantly recalculate item quantities", 
    "OK", "Natively implemented using database transactions in warehouse.controller.ts", 
    "None.", "None.", 
    "N/A", "High", "Warehouse", "Easy", "Excellent real-time database integrity."
  ],
  [
    "58", "Warehouse / Inventory", "Extra material issue alert", "Alert if more items are dispatched than listed on BOM", 
    "Not OK", "No warnings or limits exist for over-dispatching", 
    "Warehouse can dispatch extra items without system flags.", 
    "Unplanned costs go unnoticed until final audits.", 
    "Add a backend check: block dispatch if item quantity > BOM quantity.", 
    "High", "Tech", "Easy", "Locks down stock leakage."
  ],
  // 7. Payment / Accounts
  [
    "59", "Payment / Accounts", "Project value tracking", "Monitor total project and invoice value", 
    "OK", "Available via Invoice.totalAmount", 
    "None.", "None.", 
    "N/A", "High", "Accounts", "Easy", "Accurate tax-inclusive values."
  ],
  [
    "60", "Payment / Accounts", "Payment milestone tracking", "Tracks payments by milestones (Booking, Installation, etc.)", 
    "OK", "Supported via PaymentMilestone enums", 
    "None.", "None.", 
    "N/A", "High", "Accounts", "Easy", "Perfect for EPC billing cycles."
  ],
  [
    "61", "Payment / Accounts", "Advance received / Payment pending / Overdue", "Tracks payment status automatically", 
    "OK", "Calculates dueAmount and paidAmount in Invoice", 
    "None.", "None.", 
    "N/A", "High", "Accounts", "Easy", "Standard financial tracking."
  ],
  [
    "62", "Payment / Accounts", "Payment reminder", "Alerts when payment due date passes", 
    "Not OK", "No background service alerts users of overdue payments", 
    "Overdue payments are neglected until manually checked.", 
    "Critical cash flow bottlenecks.", 
    "Set up a weekly node-cron task that sends automated email reminders to customers with overdue balances.", 
    "High", "Accounts", "Medium", "Improves outstanding collections."
  ],
  [
    "63", "Payment / Accounts", "Dispatch blocked if payment pending", "Blocks dispatches if milestone payment is pending", 
    "Not OK", "Warehouse dispatch API does not verify outstanding payments", 
    "Materials are dispatched even if the customer hasn't paid their milestone advance.", 
    "Extreme bad-debt risk. Customers get panels installed but delay payments indefinitely.", 
    "In the dispatchCustomer endpoint, block execution if invoice.dueAmount > threshold.", 
    "High", "Tech", "Easy", "Protects capital investment."
  ],
  [
    "64", "Payment / Accounts", "Founder approval for override dispatch", "Allows Founder to override a blocked dispatch", 
    "Not OK", "No bypass approval mechanism exists in code", 
    "Cannot dispatch materials for strategic clients with pending balances without editing code.", 
    "Operational gridlock for high-priority custom deals.", 
    "Add an overrideDispatch boolean and founderOverrideBy column in Customer model.", 
    "High", "Founder", "Medium", "Keeps operational flexibility under control."
  ],
  [
    "65", "Payment / Accounts", "Final payment pending tracking", "Ensures final milestone is collected post-install", 
    "OK", "Tracked natively via final milestone invoices", 
    "None.", "None.", 
    "N/A", "High", "Accounts", "Easy", "Standard financial closing."
  ],
  [
    "66", "Payment / Accounts", "Collection reports", "Summarized collection reports", 
    "Partial", "Data exists in database but no dedicated reports or exports are configured", 
    "Accounts team must manually compute collections from raw database exports.", 
    "Time-consuming financial reporting and delayed insights.", 
    "Create a dedicated `/api/finance/reports/collection` endpoint.", 
    "Medium", "Accounts", "Easy", "Speeds up financial audits."
  ],
  // 8. Installation / I&C
  [
    "67", "Installation / I&C", "Installation team assignment", "Assign crew to customer installation", 
    "OK", "Supported via assignedInstallation in Customer model", 
    "None.", "None.", 
    "N/A", "High", "Installation", "Easy", "Functional assignment."
  ],
  [
    "68", "Installation / I&C", "Planned / Actual installation date", "Tracks planned and actual install timelines", 
    "Not OK", "No date fields exist for installation schedules", 
    "No way to track if installations are starting or ending on time.", 
    "Customer dissatisfaction due to unmonitored project delays.", 
    "Add plannedInstallDate and actualInstallDate to the Customer model.", 
    "High", "Installation", "Easy", "Enables timeline audits."
  ],
  [
    "69", "Installation / I&C", "Stage-wise installation checklist", "Tracks stages (Structure, Panels, AC/DC Wiring, Inverter)", 
    "Not OK", "No stage checkboxes or status tracker fields exist", 
    "No visibility into the exact physical progress of the project.", 
    "Installers skip critical quality checks, resulting in system faults.", 
    "Add boolean flags for structureCompleted, moduleMounted, dcWiringCompleted, etc. to Customer.", 
    "High", "Installation", "Easy", "Standardizes field operations."
  ],
  [
    "70", "Installation / I&C", "Site photos mandatory", "Mandatory photos of panels, wiring, and inverter", 
    "Partial", "Allows photo upload, but not programmatically enforced for project closing", 
    "Crews can close tasks without uploading proof photos.", 
    "Cannot perform remote Quality Checks (QC), requiring physical inspector visits.", 
    "Reject completedStatus updates if no SITE_PHOTO is uploaded.", 
    "High", "Tech", "Easy", "Guarantees visual proof."
  ],
  [
    "71", "Installation / I&C", "Delay reason / Owner tracking", "Record delay reasons and who caused them", 
    "Not OK", "No log or fields track delay details", 
    "No accountability for late project execution.", 
    "Repeated delays with no trackable root cause.", 
    "Create an InstallationDelayLog model linked to Customer.", 
    "Medium", "Installation", "Easy", "Enables SLA bottleneck analysis."
  ],
  [
    "72", "Installation / I&C", "Punch point / QC status", "Record open punch points and QC results", 
    "Not OK", "No QC or punch point tracking exists", 
    "Projects are marked complete even with active quality issues.", 
    "Safety hazards and system breakdowns after handover.", 
    "Add qcStatus (PENDING, APPROVED, REJECTED) and punchPoints (JSON list) to Customer.", 
    "High", "Project", "Easy", "Ensures ultimate system safety."
  ],
  // 9. Net Metering / Subsidy
  [
    "73", "Net Metering / Subsidy", "Customer document collection", "Gathers customer identity documents", 
    "OK", "Supported natively via Document model and upload controllers", 
    "None.", "None.", 
    "N/A", "High", "Documentation", "Easy", "Safe cloud storage."
  ],
  [
    "74", "Net Metering / Subsidy", "CA number tracking", "Consumer Account number tracking", 
    "OK", "electricityConsumerNo is supported on Customer model", 
    "None.", "None.", 
    "N/A", "High", "Documentation", "Easy", "Essential for government filings."
  ],
  [
    "75", "Net Metering / Subsidy", "Subsidy ID / B2C claim ID", "Track application and claim tracking numbers", 
    "Partial", "Tracks pmSuryaAppNo, but lacks B2C claim ID tracking", 
    "No field for final subsidy disbursal claim tracking.", 
    "Subsidy claims are delayed because tracking numbers are misplaced.", 
    "Add subsidyClaimId to the DocumentationChecklist model.", 
    "Medium", "Documentation", "Easy", "Critical for cash claims."
  ],
  [
    "76", "Net Metering / Subsidy", "DCR certificate status", "Track Domestic Content Requirement certification", 
    "Not OK", "No specific document type or checkbox exists for DCR certificate", 
    "No check to ensure local panel DCR certificates are collected.", 
    "Government rejects subsidy claims due to missing DCR proof.", 
    "Add DCR_CERTIFICATE to the DocumentType enum.", 
    "High", "Documentation", "Easy", "Guarantees subsidy approval eligibility."
  ],
  [
    "77", "Net Metering / Subsidy", "Net-meter / Inspection / Claim statuses", "Tracks step-by-step liaison milestones", 
    "Partial", "Tracked in simplified checklists but lacks intermediate stages", 
    "Checklist is too simple to show actual DISCOM status.", 
    "Files are stuck in government offices without supervisor awareness.", 
    "Expand AppStatus to include all DISCOM stages as planned in implementation_plan.md.", 
    "High", "Documentation", "Easy", "Speeds up file approvals."
  ],
  [
    "78", "Net Metering / Subsidy", "Documentation delay reason", "Logs delays in government approvals", 
    "Not OK", "No field to document why a file is delayed", 
    "No records of which DISCOM office or inspector is causing the block.", 
    "Inability to resolve recurring bureaucratic hurdles.", 
    "Add a liaisonDelayNotes field to DocumentationChecklist.", 
    "Medium", "Documentation", "Easy", "Assists in escalation resolution."
  ],
  // 10. Founder Control Room / Dashboard
  [
    "79", "Founder Control Room", "Consolidated summaries", "Real-time summary of leads, dispatches, and payments", 
    "Partial", "Basic statistics exist inside discrete routes, but no unified control room", 
    "The Founder must check multiple screens to compile daily operational stats.", 
    "Delayed operational insights, making fast decisions difficult.", 
    "Create a dedicated `/api/admin/founder-control-room` API and a unified dashboard in the frontend.", 
    "High", "Founder", "Medium", "Central executive dashboard."
  ],
  [
    "80", "Founder Control Room", "Quotation sent today with margin", "Track quotes and profit margins generated daily", 
    "Not OK", "Margins and gross profit are not tracked in database", 
    "Cannot see daily quoting activity profitability.", 
    "High discount deals are generated without executive visibility.", 
    "Add margin tracking to database and include it in daily analytics.", 
    "High", "Founder", "Easy", "Guarantees profit control."
  ],
  [
    "81", "Founder Control Room", "Stuck projects lists", "Lists of projects stuck in Material, Install, or Subsidy phases", 
    "Partial", "Stock alerts track blocked warehouse kits, but missing stuck lists for other stages", 
    "No quick view of delayed installations or pending files.", 
    "SLA failures go unnoticed, increasing delivery time.", 
    "Create a `/stuck-projects` report API covering all project phases.", 
    "High", "Founder", "Easy", "Enables bottleneck targeting."
  ],
  [
    "82", "Founder Control Room", "Late team attendance report", "Flags check-ins after 10:00 AM", 
    "Not OK", "No late-flagging logs or reports", 
    "Cannot track field staff discipline.", 
    "Inefficient labor performance on remote project sites.", 
    "Add a checkInLate status flag to DailyAttendance.", 
    "Medium", "Founder", "Easy", "Improves workforce discipline."
  ],
  // 11. Permissions / Audit Trail
  [
    "83", "Permissions / Audit Trail", "Role-based access controls", "Restricts routes based on employee role", 
    "OK", "Fully supported in authorize middleware and frontend router", 
    "None.", "None.", 
    "N/A", "High", "Tech", "Easy", "Stable security framework."
  ],
  [
    "84", "Permissions / Audit Trail", "Salesperson cannot edit approved cost", "Lock quotes after acceptance", 
    "OK", "Supported in reviseProposal (blocks revisions if accepted)", 
    "None.", "None.", 
    "N/A", "High", "Tech", "Easy", "Excellent integrity control."
  ],
  [
    "85", "Permissions / Audit Trail", "Change history / old vs new value tracking", "Logs who changed what specific column and when", 
    "Not OK", "TimelineEvent only logs generic descriptions, no precise value diffing", 
    "Cannot tell what specific data was modified (e.g. changing phone number).", 
    "Data tampering or mistakes cannot be traced to their source.", 
    "Implement an AuditTrail model that logs modelName, fieldName, oldVal, newVal, and performedBy.", 
    "High", "Tech", "Hard", "Protects corporate database integrity."
  ],
  // 12. Reports / Export
  [
    "86", "Reports / Export", "Excel export", "Allows exporting CRM data to spreadsheets", 
    "Partial", "Handled in excel.controller.ts, but only configured for leads", 
    "Missing Excel exports for Inventory, Payments, Projects, and Performance.", 
    "Admin and accounts teams spend hours manually aggregating data for Excel reports.", 
    "Expand excel.controller.ts to support stockItem, invoice, and customer exports.", 
    "High", "Accounts", "Medium", "Saves huge clerical hours."
  ],
  [
    "87", "Reports / Export", "Project-wise P&L / Margin reports", "Generate profit and loss statements for each commissioned site", 
    "Not OK", "No P&L reports exist due to missing structural costs", 
    "Cannot tell if a commissioned solar project made or lost money.", 
    "Unable to calculate actual corporate ROI and profit metrics.", 
    "Develop a P&L reporting engine once project costs are added to database.", 
    "High", "Founder", "Medium", "Indispensable business intelligence report."
  ]
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(auditData);

// Set column widths
ws['!cols'] = [
  { wch: 6 },   // Sr. No.
  { wch: 25 },  // Module
  { wch: 30 },  // Feature / Requirement
  { wch: 50 },  // Required Logic / Expected Behaviour
  { wch: 15 },  // Current CRM Status
  { wch: 50 },  // Current CRM Observation
  { wch: 45 },  // Gap / Problem
  { wch: 45 },  // Business Risk
  { wch: 50 },  // Suggested Solution
  { wch: 10 },  // Priority
  { wch: 15 },  // Owner Department
  { wch: 10 },  // Complexity
  { wch: 30 }   // Remarks
];

XLSX.utils.book_append_sheet(wb, ws, "CRM Audit Report");

const outputPath = path.resolve("C:\\Users\\nisha\\.gemini\\antigravity\\brain\\74e40060-4697-4313-a4dd-06c86d24d4c6\\CRM_Audit_Rocker_Solar.xlsx");
XLSX.writeFile(wb, outputPath);
console.log(`Excel audit sheet successfully created at: ${outputPath}`);
