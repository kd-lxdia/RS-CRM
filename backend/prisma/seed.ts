import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // 1. Create Delhi Zones
  const delhiZones = [
    { name: 'North Delhi', city: 'Delhi', coordinates: {} },
    { name: 'South Delhi', city: 'Delhi', coordinates: {} },
    { name: 'East Delhi', city: 'Delhi', coordinates: {} },
    { name: 'West Delhi', city: 'Delhi', coordinates: {} },
    { name: 'Central Delhi', city: 'Delhi', coordinates: {} },
    { name: 'New Delhi', city: 'Delhi', coordinates: {} },
    { name: 'North West Delhi', city: 'Delhi', coordinates: {} },
    { name: 'South West Delhi', city: 'Delhi', coordinates: {} },
  ];

  const createdZones: any[] = [];
  for (const zone of delhiZones) {
    const createdZone = await prisma.zone.create({ data: zone });
    createdZones.push(createdZone);
  }
  console.log(`Created ${createdZones.length} zones for Delhi.`);

  // 2. Create Dummy Dealer
  const dummyDealer = await prisma.dealer.create({
    data: {
      companyName: 'Dummy Solar Dealer',
      contactName: 'Dealer Contact',
      email: 'dealer@slarcrm.com',
      phone: '8888888888',
      address: '123 Solar Street',
      isActive: true,
    }
  });

  // 3. Create Users
  const passwordHash = await bcrypt.hash('Password@123', 10);
  
  const users = [
    { email: 'admin@slarcrm.com', name: 'System Admin', role: 'ADMIN', zoneId: createdZones[0].id },
    { email: 'dealer@slarcrm.com', name: 'Dealer Admin', role: 'DEALER_ADMIN', dealerId: dummyDealer.id, zoneId: createdZones[0].id },
    { email: 'dealerstaff@slarcrm.com', name: 'Dealer Staff', role: 'DEALER_STAFF', dealerId: dummyDealer.id, zoneId: createdZones[0].id },
    { email: 'sales@slarcrm.com', name: 'Sales Person', role: 'SALESPERSON', dealerId: dummyDealer.id, zoneId: createdZones[0].id },
    { email: 'calling@slarcrm.com', name: 'Calling Staff', role: 'CALLING_STAFF', dealerId: dummyDealer.id, zoneId: createdZones[0].id },
    { email: 'projecthead@slarcrm.com', name: 'Project Head', role: 'PROJECT_HEAD', zoneId: createdZones[0].id },
    { email: 'docs@slarcrm.com', name: 'Documentation Team', role: 'DOCUMENTATION', zoneId: createdZones[0].id },
    { email: 'warehouse@slarcrm.com', name: 'Warehouse Manager', role: 'WAREHOUSE', zoneId: createdZones[0].id },
    { email: 'install@slarcrm.com', name: 'Installation Team', role: 'INSTALLATION', zoneId: createdZones[0].id },
    { email: 'finance@slarcrm.com', name: 'Accountant', role: 'ACCOUNTANT', zoneId: createdZones[0].id }
  ];

  const createdUsers: Record<string, any> = {};
  for (const u of users) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: { password: passwordHash },
      create: {
        email: u.email,
        password: passwordHash,
        name: u.name,
        phone: '9999999999',
        role: u.role as any,
        isActive: true,
        zoneId: u.zoneId,
        dealerId: u.dealerId
      },
    });
    createdUsers[u.email] = created;
    console.log('Created user:', created.email);
  }

  // 4. Create Demo Customers
  const salesUser = createdUsers['sales@slarcrm.com'];
  const docsUser = createdUsers['docs@slarcrm.com'];
  const installUser = createdUsers['install@slarcrm.com'];
  const financeUser = createdUsers['finance@slarcrm.com'];

  const demoCustomers = [
    {
      customerCode: 'CUST-001',
      name: 'Ramesh Singh',
      phone: '9876543210',
      address: 'Plot No 4, Paschim Vihar',
      city: 'Delhi',
      pincode: '110063',
      zoneId: createdZones[0].id,
      assignedSalesperson: salesUser.id,
      assignedDocumentation: docsUser.id,
      assignedInstallation: installUser.id,
      assignedAccountant: financeUser.id,
      dealerId: dummyDealer.id,
      status: 'ACTIVE' as const
    },
    {
      customerCode: 'CUST-002',
      name: 'Suresh Kumar',
      phone: '9876543211',
      address: '12, Dwarka Sector 6',
      city: 'Delhi',
      pincode: '110075',
      zoneId: createdZones[0].id,
      assignedSalesperson: salesUser.id,
      assignedDocumentation: docsUser.id,
      assignedInstallation: installUser.id,
      assignedAccountant: financeUser.id,
      dealerId: dummyDealer.id,
      status: 'ACTIVE' as const
    },
    {
      customerCode: 'CUST-003',
      name: 'Priya Sharma',
      phone: '9876543212',
      address: 'Flat 45, Rohini Sector 9',
      city: 'Delhi',
      pincode: '110085',
      zoneId: createdZones[0].id,
      assignedSalesperson: salesUser.id,
      assignedDocumentation: docsUser.id,
      dealerId: dummyDealer.id,
      status: 'ACTIVE' as const
    }
  ];

  for (const c of demoCustomers) {
    const createdCustomer = await prisma.customer.upsert({
      where: { customerCode: c.customerCode },
      update: c,
      create: c
    });
    console.log('Created Customer:', createdCustomer.customerCode);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
