import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function run() {
  console.log('Seeding mock attendance and holidays...');

  // 1. Create some holidays
  const currentMonth = dayjs().startOf('month');
  const lastMonth = dayjs().subtract(1, 'month').startOf('month');
  
  const holidays = [
    { date: currentMonth.add(10, 'day').format('YYYY-MM-DD'), name: 'Public Holiday' },
    { date: currentMonth.add(15, 'day').format('YYYY-MM-DD'), name: 'Company Anniversary' },
    { date: lastMonth.add(5, 'day').format('YYYY-MM-DD'), name: 'Local Festival' },
    { date: lastMonth.add(12, 'day').format('YYYY-MM-DD'), name: 'National Holiday' }
  ];

  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: {},
      create: h
    });
  }

  // 2. Generate mock attendance for past 2 months up to today
  const users = await prisma.user.findMany({ where: { isActive: true } });
  const today = dayjs();
  
  let currentIter = lastMonth.clone();

  while (currentIter.isBefore(today) || currentIter.isSame(today, 'day')) {
    const isWeekend = currentIter.day() === 0 || currentIter.day() === 6;
    const dateStr = currentIter.format('YYYY-MM-DD');
    const isHoliday = holidays.some(h => h.date === dateStr);

    if (!isWeekend && !isHoliday) {
      for (const user of users) {
        // Randomly absent (10% chance)
        const isAbsent = Math.random() < 0.1;
        const locationType = user.role === 'SALESPERSON' || user.role === 'INSTALLATION'
          ? (Math.random() < 0.5 ? 'OFFICE' : 'SITE')
          : 'OFFICE';

        await prisma.dailyAttendance.upsert({
          where: { userId_date: { userId: user.id, date: dateStr } },
          update: {},
          create: {
            userId: user.id,
            date: dateStr,
            status: isAbsent ? 'ABSENT' : 'PRESENT',
            locationType: isAbsent ? null : locationType,
            checkInAt: isAbsent ? null : currentIter.hour(9).minute(Math.floor(Math.random() * 30)).toDate()
          }
        });
      }
    }

    currentIter = currentIter.add(1, 'day');
  }

  // 3. Set random monthly salaries for users
  for (const user of users) {
    const salary = Math.floor(Math.random() * 5 + 3) * 10000; // 30k to 70k
    await prisma.user.update({
      where: { id: user.id },
      data: { monthlySalary: salary }
    });
  }

  console.log('Seeding complete!');
}

run().catch(console.error).finally(() => prisma.$disconnect());
