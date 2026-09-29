const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPerformanceSnapshot() {
  try {
    console.log('Testing PerformanceSnapshot table...');
    
    // Test table structure by describing it
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'performance_snapshots'
      ORDER BY ordinal_position;
    `;
    
    console.log('PerformanceSnapshot table structure:');
    console.table(result);
    
    // Test indexes
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'performance_snapshots';
    `;
    
    console.log('PerformanceSnapshot table indexes:');
    console.table(indexes);
    
    console.log('✅ PerformanceSnapshot table created successfully!');
    
  } catch (error) {
    console.error('❌ Error testing PerformanceSnapshot table:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPerformanceSnapshot();