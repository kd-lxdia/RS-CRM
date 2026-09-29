import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: 'demo-admin@slarcrm.com' } });
  if (!admin) throw new Error('Demo admin user not found. Run demo:insert first.');

  const users = await prisma.user.findMany({ take: 8 });
  const customers = await prisma.customer.findMany({ orderBy: { createdAt: 'asc' }, take: 6 });
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'asc' }, take: 6 });
  if (customers.length < 4 || leads.length < 3) {
    throw new Error('Not enough demo customers/leads. Run demo:insert first.');
  }

  const owner = (index: number) => users[index % users.length]?.id || admin.id;
  const demoProjects = await prisma.epcProject.findMany({
    where: { projectCode: { startsWith: 'RS2-DEMO-' } },
    select: { id: true },
  });
  const demoProjectIds = demoProjects.map((project) => project.id);

  if (demoProjectIds.length) {
    await prisma.epcDesignControl.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    await prisma.epcPunchPoint.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    await prisma.epcPaymentMilestonePlan.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    await prisma.epcInstallationControl.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    await prisma.epcSubsidyTracker.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    await prisma.epcMaterialMovement.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    const boms = await prisma.epcBom.findMany({ where: { projectId: { in: demoProjectIds } }, select: { id: true } });
    const bomIds = boms.map((bom) => bom.id);
    if (bomIds.length) await prisma.epcBomLine.deleteMany({ where: { bomId: { in: bomIds } } });
    await prisma.epcBom.deleteMany({ where: { projectId: { in: demoProjectIds } } });
    await prisma.epcProject.deleteMany({ where: { id: { in: demoProjectIds } } });
  }

  const projects = await Promise.all(
    customers.slice(0, 5).map((customer, index) =>
      prisma.epcProject.create({
        data: {
          projectCode: `RS2-DEMO-${String(index + 1).padStart(3, '0')}`,
          leadId: leads[index % leads.length]?.id,
          customerId: customer.id,
          projectValue: 520000 + index * 85000,
          advanceRequiredAmount: 50000,
          advanceReceivedAmount: 50000,
          stage:
            index === 0
              ? 'PAYMENT_GATE_PENDING'
              : index === 1
                ? 'BOM_APPROVED'
                : index === 2
                  ? 'DISPATCHED'
                  : index === 3
                    ? 'INSTALLATION_PLANNED'
                    : 'QC_PENDING',
          projectOwnerId: owner(0),
          salesOwnerId: owner(1),
          executionOwnerId: owner(2),
          documentationOwnerId: owner(3),
          installationOwnerId: owner(4),
          accountsOwnerId: owner(5),
          nextAction:
            index === 0
              ? 'Collect overdue structure milestone before dispatch'
              : index === 1
                ? 'Resolve module shortage and release dispatch'
                : index === 2
                  ? 'Installation team to complete DC wiring'
                  : index === 3
                    ? 'Documentation to clear DISCOM approval'
                    : 'QC owner to close punch points with photos',
          nextActionOwnerId: owner(index + 1),
          nextActionDueAt: daysAgo(index + 1),
          projectDeadlineAt: daysFromNow(10 - index),
          paymentGateStatus: index === 0 ? 'BLOCKED' : 'OPEN',
          dispatchGateStatus: index <= 1 ? 'BLOCKED' : 'OPEN',
          documentationGateStatus: index === 3 ? 'BLOCKED' : 'OPEN',
          installationGateStatus: index >= 2 ? 'BLOCKED' : 'OPEN',
          delayReason:
            index === 0
              ? 'Customer promised payment but UTR not received'
              : index === 1
                ? 'DCR module stock short by 8 panels'
                : index === 2
                  ? 'Installer awaiting elevated structure team'
                  : index === 3
                    ? 'DISCOM approval pending at file desk'
                    : 'Testing photo proof missing',
          delayOwnerDepartment: ['Accounts', 'Warehouse', 'Installation', 'Documentation', 'Installation'][index],
          createdAfterAdvanceAt: daysAgo(12 - index),
          createdBy: admin.id,
        },
      })
    )
  );

  await prisma.epcPaymentMilestonePlan.createMany({
    data: [
      {
        projectId: projects[0].id,
        milestone: 'STRUCTURE_BEFORE_DISPATCH',
        expectedAmount: 180000,
        receivedAmount: 45000,
        dueAt: daysAgo(6),
        overdueAt: daysAgo(5),
        status: 'PARTIAL',
      },
      {
        projectId: projects[3].id,
        milestone: 'FINAL_AFTER_INSTALLATION',
        expectedAmount: 95000,
        receivedAmount: 0,
        dueAt: daysAgo(3),
        overdueAt: daysAgo(2),
        status: 'PENDING',
      },
    ],
  });

  await prisma.epcDesignControl.createMany({
    data: [
      {
        projectId: projects[0].id,
        requiredStatus: 'REQUIRED',
        status: 'PENDING',
        designOwnerId: owner(2),
        designDueAt: daysAgo(2),
        assignedAt: daysAgo(5),
        notes: '2D layout pending before final BOM revision',
        createdBy: admin.id,
      },
      {
        projectId: projects[1].id,
        requiredStatus: 'REQUIRED',
        status: 'IN_PROGRESS',
        designOwnerId: owner(2),
        designDueAt: daysFromNow(1),
        assignedAt: daysAgo(1),
        notes: 'Shadow correction needed for terrace water tank zone',
        createdBy: admin.id,
      },
    ],
  });

  const bom = await prisma.epcBom.create({
    data: {
      projectId: projects[1].id,
      revisionNo: 1,
      status: 'APPROVED',
      approvedBy: admin.id,
      approvedAt: daysAgo(2),
      lockedAt: daysAgo(2),
      lockedBy: admin.id,
      dispatchReadiness: 'BLOCKED',
      shortageSummary: { MODULE_DCR_540W: 8, DC_CABLE_4SQMM: 120 },
      createdBy: admin.id,
    },
  });
  await prisma.epcBomLine.createMany({
    data: [
      {
        bomId: bom.id,
        itemType: 'MODULE',
        itemName: 'DCR Mono PERC Module',
        sku: 'DCR-540-WAAREE',
        brand: 'Waaree',
        wattage: 540,
        dcrType: 'DCR',
        quantity: 28,
        unit: 'Nos',
        approvedQty: 28,
        issuedQty: 20,
        notes: '8 modules short',
      },
      {
        bomId: bom.id,
        itemType: 'CABLE',
        itemName: 'DC Cable 4 sqmm',
        sku: 'DC-CABLE-4',
        quantity: 250,
        unit: 'Meter',
        approvedQty: 250,
        issuedQty: 130,
        notes: '120 meter short',
      },
    ],
  });

  await prisma.epcMaterialMovement.createMany({
    data: [
      {
        projectId: projects[2].id,
        customerId: customers[2].id,
        movementType: 'DISPATCH',
        challanNumber: 'DC-RS2-1001',
        items: [{ sku: 'INV-5KW-GROWATT', qty: 1 }, { sku: 'STRUCT-RAIL', qty: 18 }],
        receiverName: customers[2].name,
        receiverPhone: customers[2].phone,
        receiverProofUrl: 'demo://receiver-proof-1001.jpg',
        performedBy: admin.id,
        performedAt: new Date(),
      },
      {
        projectId: projects[4].id,
        customerId: customers[4].id,
        movementType: 'RETURN',
        challanNumber: 'RT-RS2-1002',
        items: [{ sku: 'MC4-CONNECTOR', qty: 4 }],
        returnReason: 'Extra MC4 returned after QC',
        receiverName: 'Rocker Warehouse',
        performedBy: admin.id,
        performedAt: new Date(),
      },
    ],
  });

  await prisma.epcInstallationControl.createMany({
    data: [
      {
        projectId: projects[2].id,
        installationTeamId: owner(4),
        plannedInstallationAt: daysAgo(4),
        structureStatus: 'DONE',
        moduleMountingStatus: 'DONE',
        dcWiringStatus: 'PENDING',
        acWiringStatus: 'PENDING',
        inverterInstallationStatus: 'DONE',
        earthingStatus: 'PENDING',
        testingStatus: 'PENDING',
        handoverStatus: 'PENDING',
        mandatoryPhotoUrls: ['demo://structure.jpg', 'demo://modules.jpg'],
        delayReason: 'DC wiring route blocked by customer civil work',
        delayOwnerDepartment: 'Installation',
        qcStatus: 'PENDING',
      },
      {
        projectId: projects[4].id,
        installationTeamId: owner(4),
        plannedInstallationAt: daysAgo(2),
        actualInstallationAt: daysAgo(1),
        structureStatus: 'DONE',
        moduleMountingStatus: 'DONE',
        dcWiringStatus: 'DONE',
        acWiringStatus: 'DONE',
        inverterInstallationStatus: 'DONE',
        earthingStatus: 'DONE',
        testingStatus: 'DONE',
        handoverStatus: 'PENDING',
        mandatoryPhotoUrls: ['demo://handover-pending.jpg'],
        delayReason: 'Customer handover signature pending',
        delayOwnerDepartment: 'Installation',
        qcStatus: 'PENDING',
      },
    ],
  });

  await prisma.epcPunchPoint.createMany({
    data: [
      {
        projectId: projects[2].id,
        title: 'Close DC cable conduit near inverter wall',
        ownerDepartment: 'Installation',
        ownerUserId: owner(4),
        severity: 'HIGH',
        dueAt: daysAgo(1),
        createdBy: admin.id,
      },
      {
        projectId: projects[4].id,
        title: 'Upload final handover signature photo',
        ownerDepartment: 'Installation',
        ownerUserId: owner(4),
        severity: 'MEDIUM',
        dueAt: daysFromNow(1),
        createdBy: admin.id,
      },
    ],
  });

  await prisma.epcSubsidyTracker.createMany({
    data: [
      {
        projectId: projects[3].id,
        customerId: customers[3].id,
        caNumber: customers[3].electricityConsumerNo || 'CA-DEMO-1004',
        subsidyId: 'SUB-DEMO-1004',
        b2cClaimId: 'B2C-DEMO-1004',
        dcrCertificateStatus: 'DONE',
        customerDocsStatus: 'DONE',
        firstStageApplicationStatus: 'DONE',
        discomApprovalStatus: 'PENDING',
        netMeterFileStatus: 'PENDING',
        inspectionStatus: 'PENDING',
        netMeterInstalledStatus: 'PENDING',
        subsidyClaimSubmittedStatus: 'PENDING',
        subsidyReceivedStatus: 'PENDING',
        currentStage: 'DISCOM_APPROVAL',
        delayReason: 'DISCOM approval pending at file desk',
        delayOwnerDepartment: 'Documentation',
        assignedTo: owner(3),
      },
    ],
  });

  await Promise.all(
    leads.slice(0, 3).map((lead, index) =>
      prisma.epcLeadControl.upsert({
        where: { leadId: lead.id },
        update: {
          mobile: lead.phone,
          caNumber: `CA-MISSED-${index + 1}`,
          customerNameKey: lead.name.toLowerCase(),
          addressKey: (lead.address || '').toLowerCase(),
          sourceDetail: 'Demo founder missed follow-up queue',
          nextFollowUpAt: daysAgo(index + 1),
          missedFollowUpAt: null,
          hotScore: 80 - index * 8,
          isHot: true,
          duplicateGroupKey: `${lead.phone}|CA-MISSED-${index + 1}|${(lead.address || '').toLowerCase()}|${lead.name.toLowerCase()}`,
          duplicateFields: [],
        },
        create: {
          leadId: lead.id,
          mobile: lead.phone,
          caNumber: `CA-MISSED-${index + 1}`,
          customerNameKey: lead.name.toLowerCase(),
          addressKey: (lead.address || '').toLowerCase(),
          sourceDetail: 'Demo founder missed follow-up queue',
          nextFollowUpAt: daysAgo(index + 1),
          hotScore: 80 - index * 8,
          isHot: true,
          duplicateGroupKey: `${lead.phone}|CA-MISSED-${index + 1}|${(lead.address || '').toLowerCase()}|${lead.name.toLowerCase()}`,
          duplicateFields: [],
        },
      })
    )
  );

  console.log({
    projects: projects.length,
    paymentPending: 2,
    materialStuck: 2,
    installationStuck: 2,
    qcPending: 2,
    netMeteringStuck: 1,
    missedFollowUps: 3,
    designPending: 2,
    openPunchPoints: 2,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
