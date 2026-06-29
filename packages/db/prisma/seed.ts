import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@salesense.local' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@salesense.local',
      phone: '9999999999',
      passwordHash,
      systemRole: 'SUPER_ADMIN',
    },
  });

  const store = await prisma.store.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Main HQ Store',
    },
  });

  await prisma.storeUser.upsert({
    where: {
      storeId_userId: {
        storeId: store.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      storeId: store.id,
      userId: user.id,
      role: 'OWNER',
    },
  });

  console.log('Seeding complete. Admin user created: admin@salesense.local / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
