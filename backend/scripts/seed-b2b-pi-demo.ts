import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const db = prisma as any;

const money = (value: number) => Number(value.toFixed(2));

async function ensurePriceItem(actorId: string, item: any) {
  return db.b2bPriceListItem.upsert({
    where: { sku: item.sku },
    update: { ...item, isActive: true },
    create: { ...item, createdBy: actorId },
  });
}

async function createDemoPi(input: {
  partyId: string;
  item: any;
  salespersonId: string;
  piNumber: string;
  quantity: number;
  adjustmentPercent: number;
  adjustmentReason: string;
}) {
  const limit = 2;
  const finalPrice = money(Number(input.item.basePrice) * (1 + input.adjustmentPercent / 100));
  const lineSubtotal = money(finalPrice * input.quantity);
  const lineGst = money(lineSubtotal * (Number(input.item.gstPercent) / 100));
  const lineTotal = money(lineSubtotal + lineGst);
  const marginImpactAmount = money((finalPrice - Number(input.item.basePrice)) * input.quantity);
  const requiresApproval = Math.abs(input.adjustmentPercent) > limit;
  const status = requiresApproval ? 'APPROVAL_PENDING' : 'GENERATED';
  const approvalReason = requiresApproval
    ? `Price adjustment ${Math.abs(input.adjustmentPercent)}% exceeds configured ${limit}% limit.`
    : undefined;

  const pi = await db.b2bPi.upsert({
    where: { piNumber: input.piNumber },
    update: {
      status,
      approvalStatus: status,
      maxLineAdjustmentPercent: Math.abs(input.adjustmentPercent),
      subtotal: lineSubtotal,
      gstAmount: lineGst,
      totalAmount: lineTotal,
      marginImpactAmount,
      approvalReason,
    },
    create: {
      piNumber: input.piNumber,
      validityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      partyId: input.partyId,
      salespersonId: input.salespersonId,
      status,
      approvalStatus: status,
      maxAdjustmentPercent: limit,
      maxLineAdjustmentPercent: Math.abs(input.adjustmentPercent),
      subtotal: lineSubtotal,
      gstAmount: lineGst,
      totalAmount: lineTotal,
      marginImpactAmount,
      paymentTerms: '40% advance, 60% before dispatch',
      dispatchTimeline: 'Dispatch within 3 working days after payment clearance',
      approvalReason,
      createdBy: input.salespersonId,
      lines: {
        create: {
          priceListItemId: input.item.id,
          sku: input.item.sku,
          materialDescription: input.item.itemName,
          brand: input.item.brand,
          model: input.item.model,
          wattage: input.item.wattage,
          capacity: input.item.capacity,
          dcrType: input.item.dcrType,
          quantity: input.quantity,
          unit: input.item.unit,
          basePrice: Number(input.item.basePrice),
          adjustmentPercent: input.adjustmentPercent,
          finalPrice,
          gstPercent: Number(input.item.gstPercent),
          lineSubtotal,
          lineGst,
          lineTotal,
          adjustmentReason: input.adjustmentReason,
          marginImpactAmount,
        },
      },
    },
  });

  await db.b2bPiAuditLog.create({
    data: {
      piId: pi.id,
      action: requiresApproval ? 'APPROVAL_REQUESTED' : 'GENERATED_WITHIN_LIMIT',
      newValue: {
        piNumber: pi.piNumber,
        status,
        adjustmentPercent: input.adjustmentPercent,
        totalAmount: lineTotal,
      },
      reason: approvalReason || 'Generated within configured adjustment limit.',
      changedBy: input.salespersonId,
    },
  });

  return pi;
}

async function main() {
  const salesperson =
    (await prisma.user.findFirst({ where: { email: 'demo-salesperson-01@slarcrm.com' } })) ||
    (await prisma.user.findFirst({ where: { role: 'SALESPERSON' as any } }));
  const projectHead =
    (await prisma.user.findFirst({ where: { email: 'demo-project-head-01@slarcrm.com' } })) ||
    (await prisma.user.findFirst({ where: { role: 'PROJECT_HEAD' as any } })) ||
    (await prisma.user.findFirst({ where: { role: 'ADMIN' as any } }));

  if (!salesperson) throw new Error('No salesperson user found. Run demo user seed first.');
  if (!projectHead) throw new Error('No project head/admin user found. Run demo user seed first.');

  const moduleItem = await ensurePriceItem(projectHead.id, {
    sku: 'B2B-MOD-WAAREE-540-DCR',
    category: 'Solar Module',
    itemName: 'Waaree 540Wp DCR Mono PERC Module',
    brand: 'Waaree',
    model: 'WSMD-540',
    wattage: 540,
    dcrType: 'DCR',
    unit: 'Nos',
    basePrice: 11800,
    gstPercent: 12,
  });

  const inverterItem = await ensurePriceItem(projectHead.id, {
    sku: 'B2B-INV-GROWATT-5KW',
    category: 'Inverter',
    itemName: 'Growatt 5kW On-Grid Inverter',
    brand: 'Growatt',
    model: 'MIN 5000TL-X',
    capacity: 5,
    unit: 'Nos',
    basePrice: 42500,
    gstPercent: 18,
  });

  const existingParty = await db.b2bParty.findFirst({ where: { phone: '9876501201' } });
  const party = existingParty
    ? await db.b2bParty.update({
        where: { id: existingParty.id },
        data: {
          partyName: 'Aarav Solar Trading Co.',
          firmName: 'Aarav Solar Trading Co.',
          gstNumber: '08AARCS2026R1Z5',
          billingAddress: 'Mansarovar, Jaipur, Rajasthan',
          shippingAddress: 'VKIA Warehouse, Jaipur, Rajasthan',
          contactPerson: 'Aarav Sharma',
          email: 'aarav.trading@example.com',
          creditTerms: '40% advance, 60% before dispatch',
          materialInterest: 'DCR modules, on-grid inverter',
          assignedSalespersonId: salesperson.id,
          isActive: true,
        },
      })
    : await db.b2bParty.create({
        data: {
      partyName: 'Aarav Solar Trading Co.',
      firmName: 'Aarav Solar Trading Co.',
      gstNumber: '08AARCS2026R1Z5',
      billingAddress: 'Mansarovar, Jaipur, Rajasthan',
      shippingAddress: 'VKIA Warehouse, Jaipur, Rajasthan',
      contactPerson: 'Aarav Sharma',
      email: 'aarav.trading@example.com',
      creditTerms: '40% advance, 60% before dispatch',
      materialInterest: 'DCR modules, on-grid inverter',
      assignedSalespersonId: salesperson.id,
      phone: '9876501201',
      createdBy: salesperson.id,
        },
      });

  const withinLimit = await createDemoPi({
    partyId: party.id,
    item: moduleItem,
    salespersonId: salesperson.id,
    piNumber: 'PI-DEMO-B2B-WITHIN-2PCT',
    quantity: 20,
    adjustmentPercent: 1.5,
    adjustmentReason: 'Channel partner launch pricing within policy',
  });

  const approvalPending = await createDemoPi({
    partyId: party.id,
    item: inverterItem,
    salespersonId: salesperson.id,
    piNumber: 'PI-DEMO-B2B-ABOVE-2PCT',
    quantity: 2,
    adjustmentPercent: 3,
    adjustmentReason: 'Dealer requested introductory discount above policy',
  });

  console.log(
    `Seeded B2B PI demo: party=${party.firmName}, withinLimit=${withinLimit.status}, approvalPending=${approvalPending.status}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
