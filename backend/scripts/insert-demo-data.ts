import { 
  PrismaClient, 
  RoleType, 
  CampaignType, 
  CampaignStatus, 
  LeadSource, 
  RawLeadStatus, 
  LeadStatus, 
  CallEntityType, 
  CallType, 
  CallDisposition, 
  VisitType, 
  VisitStatus, 
  ProposalStatus, 
  CustomerStatus, 
  DocumentType, 
  InvoiceStatus, 
  PaymentMode, 
  PaymentMilestone, 
  AppStatus, 
  LoanStatus, 
  BOMCategory, 
  BOMStatus, 
  TxType, 
  DispatchStatus, 
  TaskPriority, 
  TaskStatus, 
  EscalationStatus, 
  AICallStatus, 
  AICallDisposition, 
  TravelLogStatus 
} from '../src/lib/prisma-client-shim';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();
declare const process: { exit(code?: number): void };

const DEMO_PREFIX = '[DEMO]';
const DEMO_ZONE_NAME = '[DEMO] Central Zone';
const DEMO_BATCH_ID = Date.now().toString();

async function main() {
  console.log('🧹 Wiping existing database tables to prevent duplication...');
  
  const isSqlite = (process.env.DATABASE_URL || '').startsWith('file:');

  // Temporarily disable foreign keys only for SQLite. PostgreSQL rejects PRAGMA.
  if (isSqlite) {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF;');
  }
  
  await prisma.chatbotConversation.deleteMany();
  await prisma.performanceSnapshot.deleteMany();
  await prisma.escalationLog.deleteMany();
  await prisma.attendanceLog.deleteMany();
  await prisma.dailyAttendance.deleteMany();
  await prisma.travelLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.timelineEvent.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.stockTransaction.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.bOMItem.deleteMany();
  await prisma.siteSurvey.deleteMany();
  await prisma.document.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.documentationChecklist.deleteMany();
  await prisma.aIVoiceCall.deleteMany();
  await prisma.aIVoiceCampaign.deleteMany();
  await prisma.solarProposal.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.callLog.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.rawLead.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.campaignTemplate.deleteMany();
  await prisma.teamHierarchy.deleteMany();
  await prisma.task.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();
  await prisma.dealer.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.systemSetting.deleteMany();

  if (isSqlite) {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  }

  console.log('🌱 Starting comprehensive data seeding...');

  // 1. System Settings
  console.log('⚙️ Seeding System Settings...');
  await prisma.systemSetting.createMany({
    data: [
      { key: 'COMPANY_NAME', value: 'Slar Solar Technologies' },
      { key: 'SUPPORT_EMAIL', value: 'support@slarsolar.com' },
      { key: 'SUPPORT_PHONE', value: '+919999999999' },
      { key: 'TAX_RATE_PERCENT', value: '18' },
      { key: 'DEFAULT_WARRANTY_YEARS', value: '5' },
    ]
  });

  // 2. Holidays
  console.log('📅 Seeding Holidays...');
  const currentYear = new Date().getFullYear();
  await prisma.holiday.createMany({
    data: [
      { date: `${currentYear}-01-26`, name: 'Republic Day' },
      { date: `${currentYear}-08-15`, name: 'Independence Day' },
      { date: `${currentYear}-10-02`, name: 'Gandhi Jayanti' },
      { date: `${currentYear}-11-01`, name: 'Diwali Festival' },
      { date: `${currentYear}-12-25`, name: 'Christmas Day' },
    ]
  });

  // 3. Dealer & Zone
  console.log('📍 Seeding Zone and Dealer...');
  const demoZone = await prisma.zone.create({
    data: {
      name: DEMO_ZONE_NAME,
      coordinates: [
        { lat: 28.6139, lng: 77.2090 },
        { lat: 28.6139, lng: 77.3090 },
        { lat: 28.7139, lng: 77.2090 },
      ],
      city: 'New Delhi',
    },
  });

  const demoDealer = await prisma.dealer.create({
    data: {
      companyName: '[DEMO] Solar Dealer',
      contactName: 'Demo Dealer Contact',
      email: 'demo-dealer@slarcrm.com',
      phone: '8888888888',
      address: '[DEMO] 123 Solar Street, New Delhi',
      isActive: true,
    },
  });

  // 4. Users (All Roles)
  console.log('👥 Seeding Users for all departments...');
  const passwordHash = await bcrypt.hash('Password@123', 10);
  
  const userSpecs = [
    { email: 'demo-admin@slarcrm.com', name: '[DEMO] System Admin', role: RoleType.ADMIN, dealerId: null, zoneId: demoZone.id },
    { email: 'demo-dealer-admin@slarcrm.com', name: '[DEMO] Dealer Admin', role: RoleType.DEALER_ADMIN, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-dealer-staff@slarcrm.com', name: '[DEMO] Dealer Staff', role: RoleType.DEALER_STAFF, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-salesperson-01@slarcrm.com', name: '[DEMO] Salesperson 01', role: RoleType.SALESPERSON, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-salesperson-02@slarcrm.com', name: '[DEMO] Salesperson 02', role: RoleType.SALESPERSON, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-calling-01@slarcrm.com', name: '[DEMO] Calling Staff 01', role: RoleType.CALLING_STAFF, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-calling-02@slarcrm.com', name: '[DEMO] Calling Staff 02', role: RoleType.CALLING_STAFF, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-project-head-01@slarcrm.com', name: '[DEMO] Project Head 01', role: RoleType.PROJECT_HEAD, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-documentation-01@slarcrm.com', name: '[DEMO] Documentation 01', role: RoleType.DOCUMENTATION, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-warehouse-01@slarcrm.com', name: '[DEMO] Warehouse 01', role: RoleType.WAREHOUSE, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-installation-01@slarcrm.com', name: '[DEMO] Installation Crew 01', role: RoleType.INSTALLATION, dealerId: demoDealer.id, zoneId: demoZone.id },
    { email: 'demo-accountant-01@slarcrm.com', name: '[DEMO] Accountant 01', role: RoleType.ACCOUNTANT, dealerId: demoDealer.id, zoneId: demoZone.id },
  ];

  const seededUsers = [] as any[];
  for (const spec of userSpecs) {
    const user = await prisma.user.create({
      data: {
        email: spec.email,
        password: passwordHash,
        name: spec.name,
        phone: '98' + faker.string.numeric(8),
        role: spec.role,
        dealerId: spec.dealerId,
        zoneId: spec.zoneId,
        isActive: true,
        monthlySalary: spec.role === RoleType.ADMIN ? 95000 : 45000,
      }
    });
    seededUsers.push(user);
  }

  const byRole = (role: RoleType) => seededUsers.filter(u => u.role === role);
  const admin = byRole(RoleType.ADMIN)[0];
  const dealerAdmin = byRole(RoleType.DEALER_ADMIN)[0];
  const dealerStaff = byRole(RoleType.DEALER_STAFF)[0];
  const salespersons = byRole(RoleType.SALESPERSON);
  const callingStaff = byRole(RoleType.CALLING_STAFF);
  const projectHeads = byRole(RoleType.PROJECT_HEAD);
  const documentationUsers = byRole(RoleType.DOCUMENTATION);
  const warehouseUsers = byRole(RoleType.WAREHOUSE);
  const installationUsers = byRole(RoleType.INSTALLATION);
  const accountants = byRole(RoleType.ACCOUNTANT);

  // Link Dealer Admin to Dealer
  await prisma.dealer.update({
    where: { id: demoDealer.id },
    data: { adminUserId: dealerAdmin.id }
  });

  // 5. Team Hierarchy
  console.log('📐 Creating Team Hierarchy...');
  await prisma.teamHierarchy.create({ data: { userId: admin.id, supervisorId: null, level: 0, path: `/${admin.id}` } });
  await prisma.teamHierarchy.create({ data: { userId: dealerAdmin.id, supervisorId: admin.id, level: 1, path: `/${admin.id}/${dealerAdmin.id}` } });
  await prisma.teamHierarchy.create({ data: { userId: dealerStaff.id, supervisorId: dealerAdmin.id, level: 2, path: `/${admin.id}/${dealerAdmin.id}/${dealerStaff.id}` } });
  
  for (const ph of projectHeads) {
    await prisma.teamHierarchy.create({ data: { userId: ph.id, supervisorId: dealerAdmin.id, level: 2, path: `/${admin.id}/${dealerAdmin.id}/${ph.id}` } });
  }
  for (const sp of salespersons) {
    await prisma.teamHierarchy.create({ data: { userId: sp.id, supervisorId: projectHeads[0].id, level: 3, path: `/${admin.id}/${dealerAdmin.id}/${projectHeads[0].id}/${sp.id}` } });
  }
  for (const cs of callingStaff) {
    await prisma.teamHierarchy.create({ data: { userId: cs.id, supervisorId: projectHeads[0].id, level: 3, path: `/${admin.id}/${dealerAdmin.id}/${projectHeads[0].id}/${cs.id}` } });
  }
  for (const other of [...documentationUsers, ...warehouseUsers, ...installationUsers, ...accountants]) {
    await prisma.teamHierarchy.create({ data: { userId: other.id, supervisorId: dealerStaff.id, level: 3, path: `/${admin.id}/${dealerAdmin.id}/${dealerStaff.id}/${other.id}` } });
  }

  // 6. Campaign Templates & Campaigns
  console.log('📣 Seeding Campaigns...');
  const template = await prisma.campaignTemplate.create({
    data: {
      name: 'Summer PM-Surya Ghar Scheme Promo',
      type: CampaignType.BOTH,
      subject: 'Get up to Rs. 78,000 Subsidy on Solar Panels!',
      body: 'Hello {{name}}, switch to clean energy under the PM-Surya Ghar Yojana and get guaranteed subsidies! Contact us today.',
      variables: ['name'],
      createdBy: dealerAdmin.id,
      dealerId: demoDealer.id,
    }
  });

  const campaign = await prisma.campaign.create({
    data: {
      name: 'Delhi NCR Solar Launch 2026',
      type: CampaignType.BOTH,
      status: CampaignStatus.COMPLETED,
      templateId: template.id,
      createdBy: dealerAdmin.id,
      dealerId: demoDealer.id,
      totalContacts: 100,
      sent: 95,
      delivered: 90,
      opened: 65,
      failed: 5,
    }
  });

  // 7. Raw Leads, Leads & Customers
  console.log('📈 Seeding Leads (Raw, Sales, and Converted)...');
  const seededRawLeads = [] as any[];
  for (let i = 0; i < 80; i++) {
    const rawLead = await prisma.rawLead.create({
      data: {
        name: `${DEMO_PREFIX} Raw Lead ${String(i+1).padStart(3, '0')}`,
        phone: '9' + faker.string.numeric(9),
        email: `raw-${i+1}@demo.slarcrm.com`,
        address: faker.location.streetAddress(),
        city: 'Delhi',
        pincode: '1100' + faker.string.numeric(2),
        source: LeadSource.CAMPAIGN,
        campaignId: campaign.id,
        assignedTo: callingStaff[i % callingStaff.length].id,
        status: i % 4 === 0 ? RawLeadStatus.CONVERTED : (i % 2 === 0 ? RawLeadStatus.INTERESTED : RawLeadStatus.NEW),
      }
    });
    seededRawLeads.push(rawLead);
  }

  const convertedRawLeads = seededRawLeads.filter(rl => rl.status === RawLeadStatus.CONVERTED);
  
  const seededLeads = [] as any[];
  const leadStatuses = Object.values(LeadStatus);
  for (const [idx, rl] of convertedRawLeads.entries()) {
    const status = leadStatuses[idx % leadStatuses.length];
    const lead = await prisma.lead.create({
      data: {
        leadCode: `DEMO-LEAD-${DEMO_BATCH_ID}-${String(idx + 1).padStart(3, '0')}`,
        rawLeadId: rl.id,
        name: rl.name.replace('Raw Lead', 'Lead'),
        phone: rl.phone,
        email: rl.email,
        address: rl.address,
        city: rl.city,
        pincode: rl.pincode,
        lat: 28.6139 + (Math.random() - 0.5) * 0.05,
        lng: 77.2090 + (Math.random() - 0.5) * 0.05,
        assignedSalesperson: salespersons[idx % salespersons.length].id,
        assignedCallingStaff: callingStaff[idx % callingStaff.length].id,
        zoneId: demoZone.id,
        status: status,
        dealerId: demoDealer.id,
      }
    });
    seededLeads.push(lead);
  }

  // Converted Leads -> Customers
  console.log('🤝 Seeding Customers & Document Checklists...');
  const wonLeads = seededLeads.filter(l => l.status === LeadStatus.WON || l.status === LeadStatus.PROPOSAL_SENT);
  const seededCustomers = [] as any[];
  for (const [idx, lead] of wonLeads.entries()) {
    const custStatus = idx % 2 === 0 ? CustomerStatus.INSTALLATION_DONE : CustomerStatus.ACTIVE;
    const customer = await prisma.customer.create({
      data: {
        customerCode: `DEMO-CUST-${DEMO_BATCH_ID}-${String(idx + 1).padStart(3, '0')}`,
        name: lead.name.replace('Lead', 'Customer'),
        phone: lead.phone,
        email: lead.email,
        address: lead.address ?? 'Delhi NCR Address',
        city: lead.city ?? 'Delhi',
        pincode: lead.pincode ?? '110001',
        lat: lead.lat,
        lng: lead.lng,
        aadhaarNumber: '36' + faker.string.numeric(10),
        electricityConsumerNo: 'DL-' + faker.string.numeric(8),
        sanctionedLoad: faker.helpers.arrayElement([3.0, 5.0, 8.0, 10.0]),
        zoneId: demoZone.id,
        assignedSalesperson: lead.assignedSalesperson,
        assignedDocumentation: documentationUsers[0].id,
        assignedInstallation: installationUsers[0].id,
        assignedAccountant: accountants[0].id,
        dealerId: demoDealer.id,
        status: custStatus,
      }
    });
    seededCustomers.push(customer);

    // Link customer ID back to the lead
    await prisma.lead.update({
      where: { id: lead.id },
      data: { customerId: customer.id }
    });

    // Create dynamic checklists
    await prisma.documentationChecklist.create({
      data: {
        customerId: customer.id,
        pmSuryaAppNo: 'PMS-' + faker.string.numeric(7),
        pmSuryaStatus: idx % 3 === 0 ? AppStatus.APPROVED : AppStatus.PENDING,
        cmSchemeApplicable: idx % 2 === 0,
        cmSchemeAppNo: idx % 2 === 0 ? 'CMS-' + faker.string.numeric(7) : null,
        cmSchemeStatus: idx % 2 === 0 ? AppStatus.APPROVED : AppStatus.PENDING,
        loanApplicable: idx % 2 === 0,
        loanAppNo: idx % 2 === 0 ? 'LN-' + faker.string.numeric(7) : null,
        loanStatus: idx % 2 === 0 ? LoanStatus.DISBURSED : LoanStatus.NA,
        netMeteringAppNo: 'NMA-' + faker.string.numeric(7),
        netMeteringStatus: idx % 2 === 0 ? AppStatus.APPROVED : AppStatus.PENDING,
        assignedTo: documentationUsers[0].id,
        completedAt: custStatus === CustomerStatus.INSTALLATION_DONE ? new Date() : null,
      }
    });

    // Seed Documents
    await prisma.document.createMany({
      data: [
        { customerId: customer.id, leadId: lead.id, type: DocumentType.AADHAAR_FRONT, url: 'https://slar-crm.s3.ap-south-1.amazonaws.com/mock-aadhaar.pdf', uploadedBy: documentationUsers[0].id },
        { customerId: customer.id, leadId: lead.id, type: DocumentType.ELECTRICITY_BILL, url: 'https://slar-crm.s3.ap-south-1.amazonaws.com/mock-bill.pdf', uploadedBy: documentationUsers[0].id },
      ]
    });
  }

  // 8. Call Logs
  console.log('📞 Seeding Call History logs...');
  for (let i = 0; i < 60; i++) {
    const rl = seededRawLeads[i % seededRawLeads.length];
    await prisma.callLog.create({
      data: {
        entityType: CallEntityType.RAW_LEAD,
        entityId: rl.id,
        calledBy: callingStaff[i % callingStaff.length].id,
        callType: CallType.OUTBOUND,
        disposition: CallDisposition.INTERESTED,
        notes: 'Spoke with client. Highly interested in standard 5kW panel system. Wants pricing quotes.',
        duration: faker.number.int({ min: 10, max: 240 }),
      }
    });
  }

  // 9. Visits, site surveys & BOM
  console.log('🏗️ Seeding Visits, Site Surveys, and Bill of Materials...');
  for (const [idx, customer] of seededCustomers.entries()) {
    const lead = wonLeads[idx % wonLeads.length];
    const visit = await prisma.visit.create({
      data: {
        leadId: lead.id,
        customerId: customer.id,
        visitType: idx % 2 === 0 ? VisitType.SITE_SURVEY : VisitType.SALES_VISIT,
        scheduledAt: new Date(Date.now() - (idx + 1) * 24 * 60 * 60 * 1000),
        scheduledEndAt: new Date(Date.now() - (idx + 1) * 24 * 60 * 60 * 1000 + 3600000),
        address: customer.address,
        lat: customer.lat,
        lng: customer.lng,
        status: VisitStatus.COMPLETED,
        assignedTo: idx % 2 === 0 ? installationUsers[0].id : salespersons[0].id,
        scheduledBy: dealerStaff.id,
        notes: 'Initial meeting concluded. Layout mapped out and solar calculations finalized.',
      }
    });

    if (visit.visitType === VisitType.SITE_SURVEY) {
      const survey = await prisma.siteSurvey.create({
        data: {
          customerId: customer.id,
          visitId: visit.id,
          conductedBy: installationUsers[0].id,
          roofDimensions: { width: 35, length: 50, area_sqft: 1750 },
          roofType: 'Concrete Flat Roof',
          shadowAnalysis: 'No major shadow obstructions. Optimized for south-facing structures.',
          panelCount: 12,
          inverterCount: 1,
          inverterModel: 'Growatt 5000TL-X',
          structureDetails: 'Elevated galvanized iron structure, 1.5m clearance.',
          cableLength: 45.5,
          earthingRequired: true,
          bomGenerated: true,
          completedAt: new Date(),
        }
      });

      // Create BOM items for this survey
      await prisma.bOMItem.createMany({
        data: [
          { siteSurveyId: survey.id, customerId: customer.id, itemName: 'Mono Perc Solar Panel 400W', sku: 'SP-MONO-400W', category: BOMCategory.PANEL, quantity: 12, unit: 'Nos', status: BOMStatus.IN_STOCK },
          { siteSurveyId: survey.id, customerId: customer.id, itemName: 'Growatt Inverter 5kW', sku: 'INV-GR-5KW', category: BOMCategory.INVERTER, quantity: 1, unit: 'Nos', status: BOMStatus.IN_STOCK },
          { siteSurveyId: survey.id, customerId: customer.id, itemName: 'Solar Structural Rail Rails', sku: 'STR-AL-RAIL', category: BOMCategory.STRUCTURE, quantity: 6, unit: 'Set', status: BOMStatus.DISPATCHED },
          { siteSurveyId: survey.id, customerId: customer.id, itemName: '4 Sq.mm DC Cable Black', sku: 'CAB-DC4-BLK', category: BOMCategory.CABLE, quantity: 50, unit: 'Mtr', status: BOMStatus.DISPATCHED },
        ]
      });
    }
  }

  // 10. Solar Proposals & Chatbot Conversations
  console.log('☀️ Seeding Premium Solar Proposals & Chatbot logs...');
  for (const [idx, customer] of seededCustomers.entries()) {
    const lead = wonLeads[idx % wonLeads.length];
    const proposal = await prisma.solarProposal.create({
      data: {
        leadId: lead.id,
        customerId: customer.id,
        createdBy: lead.assignedSalesperson,
        systemSizeKw: customer.sanctionedLoad ?? 5.0,
        panelBrand: 'Tata Power Solar',
        panelModel: 'TP-Mono-440',
        panelCount: 12,
        panelWattage: 440,
        inverterBrand: 'Growatt',
        inverterModel: 'MIN-5000-TL-X',
        inverterCapacity: 5.0,
        structureType: 'Galvanized Super Structure',
        legs: 6,
        isDCR: true,
        roofType: 'Concrete',
        annualGeneration: 7200,
        co2Savings: 6.2,
        totalCost: 285000,
        subsidyAmount: 78000,
        subsidyScheme: 'PM Surya Ghar Muft Bijli Yojana',
        loanApplicable: idx % 2 === 0,
        loanAmount: idx % 2 === 0 ? 150000 : null,
        loanTenure: idx % 2 === 0 ? 36 : null,
        emi: idx % 2 === 0 ? 4950 : null,
        netCost: 207000,
        status: ProposalStatus.ACCEPTED,
        sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(),
        publicToken: `token-${DEMO_BATCH_ID}-${idx}`,
        viewCount: 12,
      }
    });

    // Chatbot Conversational Logs
    await prisma.chatbotConversation.createMany({
      data: [
        { proposalId: proposal.id, userMessage: 'Is the panel warranty covered under Tata?', botResponse: 'Yes, Tata Power Solar panels come with a 10-year product warranty and a 25-year performance warranty.', language: 'en', wasOutOfScope: false },
        { proposalId: proposal.id, userMessage: 'Muze direct subsidy kaise milegi?', botResponse: 'The central subsidy of Rs. 78,000 is directly credited to your linked bank account within 30 days of installation and net-metering setup under the PM Surya scheme.', language: 'hi', wasOutOfScope: false }
      ]
    });
  }

  // 11. Warehouse Stock Inventory & Transactions
  console.log('📦 Seeding Warehouse Inventory and Logistics...');
  const stockItemsData = [
    { name: 'Tata Solar Panel 440W Mono-PERC', sku: 'SP-MONO-440W', category: BOMCategory.PANEL, quantity: 450, unit: 'Nos', lowStockThreshold: 50 },
    { name: 'Growatt Hybrid Inverter 5kW', sku: 'INV-GR-5KW-HB', category: BOMCategory.INVERTER, quantity: 38, unit: 'Nos', lowStockThreshold: 10 },
    { name: 'High-Strength Galvanized Mounting Rail', sku: 'STR-GI-RAIL-2M', category: BOMCategory.STRUCTURE, quantity: 280, unit: 'Nos', lowStockThreshold: 20 },
    { name: '4 Sq.mm Copper DC Solar Cable Red', sku: 'CAB-DC4-RED', category: BOMCategory.CABLE, quantity: 1200, unit: 'Mtr', lowStockThreshold: 200 },
    { name: 'Dual Connect MC4 Waterproof Plugs', sku: 'ACC-MC4-PLG', category: BOMCategory.ACCESSORY, quantity: 800, unit: 'Nos', lowStockThreshold: 100 },
  ];

  const seededStockItems = [] as any[];
  for (const item of stockItemsData) {
    const stockItem = await prisma.stockItem.create({
      data: { ...item, dealerId: demoDealer.id }
    });
    seededStockItems.push(stockItem);

    // Initial log
    await prisma.stockTransaction.create({
      data: {
        stockItemId: stockItem.id,
        type: TxType.IN,
        quantity: item.quantity,
        reference: 'SUPPLIER-BATCH-A',
        notes: 'Initial warehouse stocking batch.',
        performedBy: warehouseUsers[0].id,
      }
    });
  }

  // Dispatches
  for (const [idx, customer] of seededCustomers.entries()) {
    if (idx < 5) {
      await prisma.dispatch.create({
        data: {
          customerId: customer.id,
          dispatchedBy: warehouseUsers[0].id,
          items: [
            { name: 'Tata Panel 440W', sku: 'SP-MONO-440W', qty: 12 },
            { name: 'Growatt Inverter 5kW', sku: 'INV-GR-5KW-HB', qty: 1 }
          ],
          status: DispatchStatus.DELIVERED,
          dispatchedAt: new Date(),
          notes: 'Delivered securely to consumer residential project location.',
        }
      });
    }
  }

  // 12. Accounting & Invoicing
  console.log('💰 Seeding Receivables, Invoices, and Payment Logs...');
  for (const [idx, customer] of seededCustomers.entries()) {
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${DEMO_BATCH_ID}-${String(idx+1).padStart(3, '0')}`,
        customerId: customer.id,
        items: [
          { name: 'Tata 5.2kW Solar Array Setup', qty: 1, unit: 'Set', rate: 285000, amount: 285000 }
        ],
        subtotal: 285000,
        gst: 51300,
        totalAmount: 336300,
        paidAmount: idx % 2 === 0 ? 336300 : 50000,
        dueAmount: idx % 2 === 0 ? 0 : 286300,
        status: idx % 2 === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        generatedBy: accountants[0].id,
      }
    });

    // Record milestone payments
    await prisma.payment.create({
      data: {
        customerId: customer.id,
        invoiceId: invoice.id,
        amount: idx % 2 === 0 ? 336300 : 50000,
        paymentDate: new Date(),
        mode: PaymentMode.NEFT,
        transactionRef: 'TXN-' + faker.string.numeric(12),
        milestone: PaymentMilestone.BOOKING,
        recordedBy: accountants[0].id,
        notes: 'Advance project booking fees.',
      }
    });
  }

  // 13. Field Travel Logs (Petrol Claims)
  console.log('🚗 Seeding Travel Logs...');
  for (const sp of salespersons) {
    for (let day = 1; day <= 5; day++) {
      await prisma.travelLog.create({
        data: {
          userId: sp.id,
          date: new Date(Date.now() - day * 24 * 60 * 60 * 1000),
          totalDistanceKm: faker.number.float({ min: 15, max: 95, fractionDigits: 1 }),
          petrolAmount: faker.number.int({ min: 250, max: 800 }),
          status: TravelLogStatus.APPROVED,
          routeDetails: [
            { stop: 'Dealer Office', time: '10:00 AM' },
            { stop: 'Residential Site A', time: '01:30 PM' },
            { stop: 'Dealer Office', time: '06:00 PM' }
          ],
          notes: 'Customer field design survey and site mapping visit.',
        }
      });
    }
  }

  // 14. Attendance Systems
  console.log('⏰ Seeding Attendance logs...');
  for (const user of seededUsers) {
    for (let day = 1; day <= 10; day++) {
      const dateStr = new Date(Date.now() - day * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      await prisma.dailyAttendance.create({
        data: {
          userId: user.id,
          date: dateStr,
          status: 'PRESENT',
          checkInAt: new Date(Date.now() - day * 24 * 60 * 60 * 1000),
          lat: 28.6139 + (Math.random() - 0.5) * 0.01,
          lng: 77.2090 + (Math.random() - 0.5) * 0.01,
          locationType: user.role === RoleType.SALESPERSON ? 'SITE' : 'OFFICE',
          notes: 'Marked on-time checked-in.',
        }
      });
    }
  }

  // 15. Performance Snapshots & Escalation Logs
  console.log('📊 Seeding Team Performance Snapshot metrics...');
  for (const sp of salespersons) {
    await prisma.performanceSnapshot.create({
      data: {
        userId: sp.id,
        snapshotDate: new Date(),
        taskCompletionRate: 88.5,
        averageResponseTime: 4.2,
        overdueTaskCount: 2,
        qualityScore: 9.1,
      }
    });
  }

  // 16. AI Voice Campaigns & Calls
  console.log('🤖 Seeding AI Voice Campaign logs...');
  const voiceCampaign = await prisma.aIVoiceCampaign.create({
    data: {
      name: 'Delhi NCR Cold Inbound Calling Block 1',
      description: 'Cold automated solar qualifying campaign for New Delhi regional homes.',
      scriptTemplate: 'Hello, this is Riya from Slar Technologies. I see you are located in Delhi. Do you pay more than Rs. 3000 per month for power?',
      createdBy: dealerAdmin.id,
      dealerId: demoDealer.id,
      status: CampaignStatus.RUNNING,
      totalCalls: 10,
      completedCalls: 6,
      successfulCalls: 4,
      failedCalls: 0,
    }
  });

  const transcripts = [
    'AI: Hi, do you own your home? Customer: Yes I do. AI: Perfect. Is your monthly bill above 3000? Customer: Yes, usually it is around 4500.',
    'AI: Hi, do you own your home? Customer: No, I live on rent. AI: Okay, thank you!'
  ];

  for (let i = 0; i < 8; i++) {
    await prisma.aIVoiceCall.create({
      data: {
        campaignId: voiceCampaign.id,
        name: `Voice Lead ${i+1}`,
        phone: '9' + faker.string.numeric(9),
        status: idxToAICallStatus(i),
        disposition: i % 2 === 0 ? AICallDisposition.INTERESTED : AICallDisposition.NOT_INTERESTED,
        callDuration: 45 + i * 15,
        transcript: transcripts[i % transcripts.length],
        qualificationScore: i % 2 === 0 ? 85 : 20,
        monthlyBill: 4000 + i * 200,
        propertyOwnership: i % 2 === 0,
        notes: i % 2 === 0 ? 'Qualified customer, requested follow-up.' : 'Rented property, not interested.',
      }
    });
  }

  // Helper mapping
  function idxToAICallStatus(i: number) {
    const statuses = [AICallStatus.COMPLETED, AICallStatus.CALLING, AICallStatus.QUEUED, AICallStatus.PENDING];
    return statuses[i % statuses.length];
  }

  // 17. Tasks & System Notifications
  console.log('📌 Seeding final checklists and role-specific notifications...');
  for (const user of seededUsers) {
    // Tasks
    await prisma.task.create({
      data: {
        title: `${DEMO_PREFIX} Complete daily solar audit reports`,
        description: 'Review solar panel production levels and update the primary dealer dashboard metrics.',
        priority: TaskPriority.HIGH,
        status: TaskStatus.TODO,
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        createdBy: dealerAdmin.id,
        assignedTo: user.id,
      }
    });

    // Notifications
    await prisma.notification.createMany({
      data: [
        { userId: user.id, type: 'SYSTEM_ALERT', title: 'Welcome to Slar CRM!', message: 'Your localized developer workspace is ready. Tap to explore departments.', isRead: false },
        { userId: user.id, type: 'TASK_ASSIGNED', title: 'New Active Assignment', message: 'You have been assigned a critical task. Please review your dashboard.', isRead: false }
      ]
    });
  }

  console.log('\n🌟 SUCCESS: The entire local database is now completely seeded with comprehensive CRM activities! All departments have realistic entries.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
