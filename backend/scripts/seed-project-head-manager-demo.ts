import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const actor =
    (await prisma.user.findFirst({ where: { role: 'PROJECT_HEAD' } })) ||
    (await prisma.user.findFirst({ where: { role: 'ADMIN' } }));
  if (!actor) throw new Error('No Project Head/Admin user found for demo quotation seed.');

  const project = await prisma.epcProject.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!project) throw new Error('No EPC project found. Run EPC v2 demo seed first.');

  await prisma.epcQuotationCostSheet.updateMany({
    where: { projectId: project.id, lowMarginWarning: true, founderApprovalStatus: 'PENDING' },
    data: { isActive: false },
  });

  const totalCost = 520000;
  const sellingPrice = 535000;
  const grossProfit = sellingPrice - totalCost;
  const marginPercent = Number(((grossProfit / sellingPrice) * 100).toFixed(2));

  const quotation = await prisma.epcQuotationCostSheet.create({
    data: {
      projectId: project.id,
      revisionNo: 1,
      moduleBrand: 'Waaree',
      moduleWattage: 540,
      moduleType: 'DCR',
      inverterBrand: 'Growatt',
      inverterKw: 10,
      structureCost: 85000,
      moduleCost: 260000,
      inverterCost: 95000,
      labourIcCost: 45000,
      transportationCost: 15000,
      netMeteringCost: 12000,
      subsidyProcessingCost: 3000,
      otherCost: 5000,
      totalCost,
      sellingPrice,
      grossProfit,
      marginPercent,
      lowMarginThresholdPercent: 12,
      lowMarginWarning: true,
      founderApprovalStatus: 'PENDING',
      createdBy: actor.id,
    },
  });

  console.log(`Seeded pending low-margin quotation ${quotation.id} for ${project.projectCode}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
