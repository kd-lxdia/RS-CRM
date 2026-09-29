import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function seedTravelLogs() {
  const users = await prisma.user.findMany({
    where: { role: { in: ['SALESPERSON', 'INSTALLATION'] } },
    take: 3
  });

  if (users.length === 0) {
    console.log("No users found to assign travel logs.");
    return;
  }

  for (const user of users) {
    console.log(`Creating demo travel logs for user: ${user.name}`);
    const demoLogs = [
      {
        userId: user.id,
        date: new Date('2026-05-27T10:00:00Z'),
        totalDistanceKm: 15.5,
        petrolAmount: 77.5,
        status: 'PENDING' as any,
        notes: '[DEMO_DATA] Daily route - North Zone',
        routeDetails: [
          { name: 'Home Base', lat: 28.7041, lng: 77.1025, status: 'PENDING' },
          { name: 'Site A', lat: 28.7141, lng: 77.1225, distanceFromPrev: 5.2, status: 'PENDING' },
          { name: 'Site B', lat: 28.7541, lng: 77.1625, distanceFromPrev: 10.3, status: 'PENDING' }
        ]
      },
      {
        userId: user.id,
        date: new Date('2026-05-26T10:00:00Z'),
        totalDistanceKm: 42.1,
        petrolAmount: 210.5,
        status: 'APPROVED' as any,
        notes: '[DEMO_DATA] Long distance installation trip',
        routeDetails: [
          { name: 'Office', lat: 28.6139, lng: 77.2090, status: 'APPROVED' },
          { name: 'Industrial Park', lat: 28.4595, lng: 77.0266, distanceFromPrev: 30.5, status: 'APPROVED' },
          { name: 'Warehouse pickup', lat: 28.5355, lng: 77.3910, distanceFromPrev: 11.6, status: 'APPROVED' }
        ]
      },
      {
        userId: user.id,
        date: new Date('2026-05-28T10:00:00Z'),
        totalDistanceKm: 8.2,
        petrolAmount: 41.0,
        status: 'PENDING' as any,
        notes: '[DEMO_DATA] Local follow-ups',
        routeDetails: [
          { name: 'Home Base', lat: 28.7041, lng: 77.1025, status: 'PENDING' },
          { name: 'Customer #102', lat: 28.7081, lng: 77.1055, distanceFromPrev: 3.1, status: 'PENDING' },
          { name: 'Customer #105', lat: 28.7111, lng: 77.1125, distanceFromPrev: 5.1, status: 'PENDING' }
        ]
      }
    ];

    for (const log of demoLogs) {
      await prisma.travelLog.create({ data: log });
    }
  }



  console.log("Demo travel logs seeded successfully.");
}

seedTravelLogs()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
