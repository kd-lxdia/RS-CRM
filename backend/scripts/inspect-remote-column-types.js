const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    select table_name, column_name, data_type, udt_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'Customer' and column_name = 'designStatus')
        or (table_name in ('Lead', 'RawLead') and column_name = 'priority')
      )
    order by table_name, column_name
  `);
  const enums = await prisma.$queryRawUnsafe(`
    select t.typname as enum_name, e.enumlabel as enum_value
    from pg_type t
    join pg_enum e on t.oid = e.enumtypid
    where t.typname in ('DesignStatus', 'LeadPriority')
    order by t.typname, e.enumsortorder
  `);
  console.log(JSON.stringify({ columns: rows, enums }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
