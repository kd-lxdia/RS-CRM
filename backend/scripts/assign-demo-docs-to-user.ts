import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
declare const process: { exit(code?: number): void };

async function main() {
  const SOURCE_EMAIL = 'demo-documentation-01@slarcrm.com';
  const TARGET_EMAIL = 'docs@slarcrm.com';

  console.log(`Assigning demo documentation data from [${SOURCE_EMAIL}] → [${TARGET_EMAIL}]...`);

  // 1. Find source user
  const sourceUserRaw = await prisma.user.findUnique({ where: { email: SOURCE_EMAIL } });
  if (!sourceUserRaw) {
    console.error(`Source user not found: ${SOURCE_EMAIL}`);
    console.log('Hint: Run `npm run demo:insert` first to create demo data.');
    process.exit(1);
  }
  const sourceUser = sourceUserRaw!;

  // 2. Find target user
  const targetUserRaw = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });
  if (!targetUserRaw) {
    console.error(`Target user not found: ${TARGET_EMAIL}`);
    console.log('Make sure the user exists in the database.');
    process.exit(1);
  }
  const targetUser = targetUserRaw!;

  console.log(`Source user: ${sourceUser.name} (${sourceUser.id})`);
  console.log(`Target user: ${targetUser.name} (${targetUser.id})`);

  // 3. Find all customers assigned to source documentation user
  const customers = await prisma.customer.findMany({
    where: { assignedDocumentation: sourceUser.id },
    include: { docChecklist: true },
  });

  console.log(`Found ${customers.length} customers assigned to ${SOURCE_EMAIL}`);

  if (customers.length === 0) {
    console.log('No customers to reassign. Exiting.');
    process.exit(0);
  }

  // 4. Reassign customers to target user
  const { count: customersUpdated } = await prisma.customer.updateMany({
    where: { assignedDocumentation: sourceUser.id },
    data: { assignedDocumentation: targetUser.id },
  });
  console.log(`✓ Reassigned ${customersUpdated} customers to ${TARGET_EMAIL}`);

  // 5. Reassign documentation checklists to target user
  const customerIds = customers.map((c) => c.id);
  const { count: checklistsUpdated } = await prisma.documentationChecklist.updateMany({
    where: { customerId: { in: customerIds } },
    data: { assignedTo: targetUser.id },
  });
  console.log(`✓ Reassigned ${checklistsUpdated} documentation checklists to ${TARGET_EMAIL}`);

  console.log('\nDone! Log in as docs@slarcrm.com to see the documentation dashboard populated.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
