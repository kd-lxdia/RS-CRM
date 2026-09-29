import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check calling staff users
  const callingUser = await prisma.user.findUnique({ 
    where: { email: 'calling@slarcrm.com' },
    select: { id: true, dealerId: true, name: true }
  });
  console.log('calling@slarcrm.com:', callingUser);

  const salesUser = await prisma.user.findUnique({ 
    where: { email: 'sales@slarcrm.com' },
    select: { id: true, dealerId: true, name: true }
  });
  console.log('sales@slarcrm.com:', salesUser);

  // Check demo calling staff
  const demoCallingUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'demo-calling-' } },
    select: { id: true, email: true }
  });
  console.log('\nDemo calling staff:', demoCallingUsers.length, 'users');

  // Check raw leads assigned to calling staff
  if (callingUser) {
    const rawLeadsCount = await prisma.rawLead.count({
      where: { assignedTo: callingUser.id }
    });
    console.log(`Raw leads assigned to calling@slarcrm.com: ${rawLeadsCount}`);
    
    const rawLeadsWithDealer = await prisma.rawLead.count({
      where: { assignedTo: callingUser.id, dealerId: callingUser.dealerId }
    });
    console.log(`  - with correct dealerId: ${rawLeadsWithDealer}`);
  }

  // Check raw leads assigned to demo calling staff
  if (demoCallingUsers.length > 0) {
    const demoRawLeadsCount = await prisma.rawLead.count({
      where: { assignedTo: { in: demoCallingUsers.map(u => u.id) } }
    });
    console.log(`Raw leads assigned to demo calling staff: ${demoRawLeadsCount}`);
  }

  // Check leads assigned to sales
  if (salesUser) {
    const leadsCount = await prisma.lead.count({
      where: { assignedSalesperson: salesUser.id }
    });
    console.log(`\nLeads assigned to sales@slarcrm.com: ${leadsCount}`);
    
    const leadsWithDealer = await prisma.lead.count({
      where: { assignedSalesperson: salesUser.id, dealerId: salesUser.dealerId }
    });
    console.log(`  - with correct dealerId: ${leadsWithDealer}`);
  }

  // Check dealers
  const dealers = await prisma.dealer.findMany({
    select: { id: true, email: true, companyName: true }
  });
  console.log('\nDealers:');
  dealers.forEach(d => console.log(`  - ${d.companyName} (${d.email}): ${d.id}`));
}

main().finally(() => prisma.$disconnect());
