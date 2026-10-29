import { PrismaService } from '../../src/core/prisma/prisma.service';
import {
  confirmPlan,
  createPlan,
} from '../../src/modules/contracts/contract-plan.builder';

/**
 * Lập và xác nhận kế hoạch mặc định cho mọi dòng dịch vụ của HĐ (đặc tả 04-B, E1: việc chỉ sinh
 * từ kế hoạch đã xác nhận). Dùng trong test cần việc được sinh mà không kiểm tra màn hình kế hoạch.
 */
export async function confirmDefaultPlans(
  prisma: PrismaService,
  contractId: string,
  userId: string,
): Promise<void> {
  const lines = await prisma.contractService.findMany({
    where: { contractId, plan: null },
    select: { id: true },
  });
  for (const line of lines) {
    await prisma.$transaction(async (tx) => {
      const planId = await createPlan(tx, line.id, { userId });
      await confirmPlan(tx, planId, userId);
    });
  }
}
