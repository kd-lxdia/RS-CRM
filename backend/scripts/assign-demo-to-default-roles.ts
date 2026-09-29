/**
 * assign-demo-to-default-roles.ts
 *
 * Copies all demo assignments to the named default role accounts AND
 * re-stamps dealerId so the backend dealer-scoping filters pass.
 *
 * Default users (from prisma/seed.ts):
 *   sales@slarcrm.com        SALESPERSON     ← demo-salesperson-*
 *   calling@slarcrm.com      CALLING_STAFF   ← demo-calling-*
 *   docs@slarcrm.com         DOCUMENTATION   ← demo-documentation-*
 *   install@slarcrm.com      INSTALLATION    ← demo-installation-*
 *   finance@slarcrm.com      ACCOUNTANT      ← demo-accountant-*
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
declare const process: { exit(code?: number): void };

async function getUser(email: string) {
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error(`User not found: ${email}. Run 'npx prisma db seed' first.`);
  return u;
}

async function getDemoUserIds(rolePrefix: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: `demo-${rolePrefix}-` } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function main() {
  console.log('\n🚀  Assigning demo data to all default role accounts...\n');

  // ── Resolve the seed dealer (needed to re-stamp dealerId) ─────────────────
  const seedDealer = await prisma.dealer.findFirst({ where: { email: 'dealer@slarcrm.com' } });
  if (!seedDealer) throw new Error(`Seed dealer 'dealer@slarcrm.com' not found. Run 'npx prisma db seed' first.`);

  // ── Resolve demo dealer ───────────────────────────────────────────────────
  const demoDealer = await prisma.dealer.findFirst({ where: { email: 'demo-dealer@slarcrm.com' } });
  if (!demoDealer) throw new Error(`Demo dealer not found. Run 'npm run demo:insert' first.`);

  console.log(`Seed dealer : ${seedDealer.companyName} (${seedDealer.id})`);
  console.log(`Demo dealer : ${demoDealer.companyName} (${demoDealer.id})\n`);

  // ── 1. SALESPERSON ────────────────────────────────────────────────────────
  {
    const target = await getUser('sales@slarcrm.com');
    const sourceIds = await getDemoUserIds('salesperson');

    // Re-stamp dealerId + reassign salesperson on customers
    const { count: c1 } = await prisma.customer.updateMany({
      where: { assignedSalesperson: { in: sourceIds } },
      data: { assignedSalesperson: target.id, dealerId: seedDealer.id },
    });

    // Re-stamp dealerId + reassign salesperson on leads
    const { count: c2 } = await prisma.lead.updateMany({
      where: { assignedSalesperson: { in: sourceIds } },
      data: { assignedSalesperson: target.id, dealerId: seedDealer.id },
    });

    // Fix any leads already assigned to sales@ but with wrong dealerId
    const { count: c3 } = await prisma.lead.updateMany({
      where: { 
        assignedSalesperson: target.id,
        dealerId: { not: seedDealer.id }
      },
      data: { dealerId: seedDealer.id },
    });

    console.log(`✓ SALESPERSON   → sales@slarcrm.com`);
    console.log(`    Customers updated : ${c1}`);
    console.log(`    Leads updated     : ${c2}`);
    console.log(`    Leads dealerId fixed : ${c3}`);
  }

  // ── 2. CALLING STAFF ──────────────────────────────────────────────────────
  {
    const target = await getUser('calling@slarcrm.com');
    const sourceIds = await getDemoUserIds('calling');

    // Re-stamp dealerId + reassign calling staff on leads
    const { count: c1 } = await prisma.lead.updateMany({
      where: { assignedCallingStaff: { in: sourceIds } },
      data: { assignedCallingStaff: target.id, dealerId: seedDealer.id },
    });

    // Re-stamp dealerId + reassign on raw leads
    const { count: c2 } = await prisma.rawLead.updateMany({
      where: { assignedTo: { in: sourceIds } },
      data: { assignedTo: target.id, dealerId: seedDealer.id },
    });

    // Fix any raw leads already assigned to calling@ but with wrong dealerId
    const { count: c3 } = await prisma.rawLead.updateMany({
      where: { 
        assignedTo: target.id,
        dealerId: { not: seedDealer.id }
      },
      data: { dealerId: seedDealer.id },
    });

    // Fix any leads already assigned to calling@ but with wrong dealerId
    const { count: c4 } = await prisma.lead.updateMany({
      where: { 
        assignedCallingStaff: target.id,
        dealerId: { not: seedDealer.id }
      },
      data: { dealerId: seedDealer.id },
    });

    console.log(`\n✓ CALLING_STAFF → calling@slarcrm.com`);
    console.log(`    Leads updated     : ${c1}`);
    console.log(`    Raw leads updated : ${c2}`);
    console.log(`    Raw leads dealerId fixed : ${c3}`);
    console.log(`    Leads dealerId fixed : ${c4}`);
  }

  // ── 3. DOCUMENTATION ──────────────────────────────────────────────────────
  {
    const target = await getUser('docs@slarcrm.com');
    const sourceIds = await getDemoUserIds('documentation');

    const affectedCustomers = await prisma.customer.findMany({
      where: { assignedDocumentation: { in: sourceIds } },
      select: { id: true },
    });
    const affectedIds = affectedCustomers.map((c) => c.id);

    const { count: c1 } = await prisma.customer.updateMany({
      where: { assignedDocumentation: { in: sourceIds } },
      data: { assignedDocumentation: target.id, dealerId: seedDealer.id },
    });

    // Also catch customers that are ALREADY pointing at docs@slarcrm.com
    // but still carry demoDealer id (from the earlier partial script run)
    const { count: c1b } = await prisma.customer.updateMany({
      where: { assignedDocumentation: target.id, dealerId: demoDealer.id },
      data: { dealerId: seedDealer.id },
    });

    const { count: c2 } = await prisma.documentationChecklist.updateMany({
      where: { customerId: { in: affectedIds } },
      data: { assignedTo: target.id },
    });

    // Also fix checklists whose customer already points at docs@slarcrm but checklist still has old assignee
    const stillWrongChecklists = await prisma.customer.findMany({
      where: { assignedDocumentation: target.id },
      select: { id: true },
    });
    await prisma.documentationChecklist.updateMany({
      where: { customerId: { in: stillWrongChecklists.map((c) => c.id) } },
      data: { assignedTo: target.id },
    });

    console.log(`\n✓ DOCUMENTATION → docs@slarcrm.com`);
    console.log(`    Customers updated       : ${c1 + c1b}`);
    console.log(`    Checklists updated      : ${c2}`);
  }

  // ── 4. INSTALLATION ───────────────────────────────────────────────────────
  {
    const target = await getUser('install@slarcrm.com');
    const sourceIds = await getDemoUserIds('installation');

    const { count: c1 } = await prisma.customer.updateMany({
      where: { assignedInstallation: { in: sourceIds } },
      data: { assignedInstallation: target.id, dealerId: seedDealer.id },
    });

    // Fix any already-assigned-to-install but wrong dealer
    const { count: c1b } = await prisma.customer.updateMany({
      where: { assignedInstallation: target.id, dealerId: demoDealer.id },
      data: { dealerId: seedDealer.id },
    });

    console.log(`\n✓ INSTALLATION  → install@slarcrm.com`);
    console.log(`    Customers updated : ${c1 + c1b}`);
  }

  // ── 5. ACCOUNTANT ─────────────────────────────────────────────────────────
  {
    const target = await getUser('finance@slarcrm.com');
    const sourceIds = await getDemoUserIds('accountant');

    const { count: c1 } = await prisma.customer.updateMany({
      where: { assignedAccountant: { in: sourceIds } },
      data: { assignedAccountant: target.id, dealerId: seedDealer.id },
    });

    // Stamp all remaining demo-dealer customers with the correct dealer too
    const { count: c1b } = await prisma.customer.updateMany({
      where: { assignedAccountant: target.id, dealerId: demoDealer.id },
      data: { dealerId: seedDealer.id },
    });

    console.log(`\n✓ ACCOUNTANT    → finance@slarcrm.com`);
    console.log(`    Customers updated : ${c1 + c1b}`);
  }

  // ── 6. Fix any remaining demo customers still carrying demoDealer id ──────
  {
    const { count: remaining } = await prisma.customer.updateMany({
      where: { dealerId: demoDealer.id, name: { startsWith: '[DEMO]' } },
      data: { dealerId: seedDealer.id },
    });
    if (remaining > 0) {
      console.log(`\n✓ Fixed ${remaining} remaining demo customers still on demo dealer`);
    }
  }

  console.log('\n✅  All done! Every default account now has demo data filtered correctly.');
  console.log('   Password for all accounts: Password@123\n');
}

main()
  .catch((e) => {
    console.error('\n❌  Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
