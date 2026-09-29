import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up demo data...');

  try {
    const demoUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'demo-' } },
      select: { id: true },
    });
    const demoUserIds = demoUsers.map((user) => user.id);

    // Delete sales leads created for the demo team
    const { count: leadsDeleted } = await prisma.lead.deleteMany({
      where: { leadCode: { startsWith: 'DEMO-LEAD-' } },
    });
    console.log(`Deleted ${leadsDeleted} demo leads.`);

    // Delete Tasks
    const { count: tasksDeleted } = await prisma.task.deleteMany({
      where: { title: { startsWith: '[DEMO]' } },
    });
    console.log(`Deleted ${tasksDeleted} demo tasks.`);

    // Delete DocumentationChecklist first to avoid FK constraint violations
    const demoCustomers = await prisma.customer.findMany({
      where: { name: { startsWith: '[DEMO]' } },
      select: { id: true }
    });
    
    const { count: checklistsDeleted } = await prisma.documentationChecklist.deleteMany({
      where: { customerId: { in: demoCustomers.map(c => c.id) } },
    });
    console.log(`Deleted ${checklistsDeleted} demo checklists.`);

    // Delete Customers
    const { count: customersDeleted } = await prisma.customer.deleteMany({
      where: { name: { startsWith: '[DEMO]' } },
    });
    console.log(`Deleted ${customersDeleted} demo customers.`);

    // Delete Raw Leads
    const { count: rawLeadsDeleted } = await prisma.rawLead.deleteMany({
      where: { name: { startsWith: '[DEMO]' } },
    });
    console.log(`Deleted ${rawLeadsDeleted} demo raw leads.`);

    // Delete team hierarchy rows first, then users
    const { count: hierarchyDeleted } = await prisma.teamHierarchy.deleteMany({
      where: { userId: { in: demoUserIds } },
    });
    console.log(`Deleted ${hierarchyDeleted} demo hierarchy rows.`);

    const { count: usersDeleted } = await prisma.user.deleteMany({
      where: { email: { startsWith: 'demo-' } },
    });
    console.log(`Deleted ${usersDeleted} demo users.`);

    const { count: dealersDeleted } = await prisma.dealer.deleteMany({
      where: { email: { startsWith: 'demo-' } },
    });
    console.log(`Deleted ${dealersDeleted} demo dealers.`);

    // Delete Zones
    const { count: zonesDeleted } = await prisma.zone.deleteMany({
      where: { name: { startsWith: '[DEMO]' } },
    });
    console.log(`Deleted ${zonesDeleted} demo zones.`);

    console.log('Demo data successfully cleaned up!');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });