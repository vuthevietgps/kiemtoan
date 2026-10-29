import { PrismaClient } from '@prisma/client';
import { seedAuditEngagements } from './audit-engagements.seed';
import { seedCatalog } from './catalog.seed';
import { seedContracts } from './contracts.seed';
import { seedCustomers } from './customers.seed';
import { seedPayments } from './payments.seed';
import { seedTasks } from './tasks.seed';
import { seedTemplates } from './templates.seed';
import { seedUsers } from './users.seed';

/** Dữ liệu demo. Chạy trên database dev đã được migrate: npm run db:seed. */
async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedUsers(prisma);
    await seedCatalog(prisma);
    await seedCustomers(prisma);
    await seedContracts(prisma);
    await seedAuditEngagements(prisma);
    await seedTasks(prisma);
    await seedPayments(prisma);
    const director = await prisma.user.findFirstOrThrow({
      where: { role: 'DIRECTOR', deletedAt: null },
    });
    await seedTemplates(prisma, director.id);
    console.log('Đã tạo dữ liệu demo. Mật khẩu mọi tài khoản: Demo@123');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
