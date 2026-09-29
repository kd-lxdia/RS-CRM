const { PrismaClient } = require('@prisma/client');

async function checkEscalationData() {
  const prisma = new PrismaClient();
  
  try {
    const count = await prisma.escalationLog.count();
    console.log(`EscalationLog records count: ${count}`);
    
    if (count > 0) {
      const sample = await prisma.escalationLog.findMany({
        take: 5,
        select: {
          id: true,
          customerId: true,
          taskType: true,
          delayDays: true,
          notifiedAt: true,
          resolved: true
        }
      });
      console.log('Sample records:', JSON.stringify(sample, null, 2));
    }
  } catch (error) {
    console.error('Error checking data:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEscalationData();