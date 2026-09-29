import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

export const calculatePayroll = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;
    
    if (!month || !year) {
      return res.status(400).json({ success: false, message: 'Month and year required' });
    }

    const m = parseInt(month as string);
    const y = parseInt(year as string);
    
    const targetMonth = dayjs().year(y).month(m - 1);
    const daysInMonth = targetMonth.daysInMonth();
    const prefix = `${y}-${m.toString().padStart(2, '0')}`;

    // 1. Calculate weekends in this month
    let weekends = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      const d = targetMonth.date(i);
      if (d.day() === 0 || d.day() === 6) weekends++;
    }

    // 2. Fetch Holidays for this month
    const holidays = await prisma.holiday.findMany({
      where: { date: { startsWith: prefix } }
    });
    const holidayCount = holidays.length;

    // 3. Working Days = Total - Weekends - Holidays
    const workingDays = daysInMonth - weekends - holidayCount;

    // 4. Fetch all active users with their salary
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true, monthlySalary: true }
    });

    // 5. Fetch all attendances for the month
    const attendances = await prisma.dailyAttendance.findMany({
      where: {
        date: { startsWith: prefix },
        status: 'PRESENT'
      }
    });

    // Group by user
    const attendanceMap: Record<string, number> = {};
    attendances.forEach(a => {
      // Don't count check-ins on weekends or holidays towards "working days" present 
      // if we are strictly calculating based on working days. Or we just count all PRESENTs.
      // Usually, present count directly corresponds to working days present.
      attendanceMap[a.userId] = (attendanceMap[a.userId] || 0) + 1;
    });

    const payroll = users.map(user => {
      const baseSalary = user.monthlySalary || 0;
      const dailyRate = workingDays > 0 ? baseSalary / workingDays : 0;
      const presentDays = attendanceMap[user.id] || 0;
      
      // Calculate absent days based on working days
      const absentDays = Math.max(0, workingDays - presentDays);
      const deductions = absentDays * dailyRate;
      
      // Final payout cannot be negative
      let finalPayout = baseSalary - deductions;
      if (finalPayout < 0) finalPayout = 0;

      // If they worked overtime (present > workingDays), they might get > baseSalary.
      // E.g. they worked a weekend.
      if (presentDays > workingDays) {
        finalPayout = presentDays * dailyRate; 
      }

      return {
        userId: user.id,
        name: user.name,
        role: user.role,
        monthlySalary: baseSalary,
        dailyRate: Math.round(dailyRate),
        workingDays,
        presentDays,
        absentDays,
        deductions: Math.round(deductions),
        finalPayout: Math.round(finalPayout)
      };
    });

    res.json({ success: true, data: { payroll, stats: { daysInMonth, weekends, holidayCount, workingDays } } });

  } catch (error) {
    console.error('Error calculating payroll:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
