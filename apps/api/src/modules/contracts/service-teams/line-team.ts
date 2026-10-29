import { Prisma } from '@prisma/client';
import { ServiceTeamInput } from './service-team.rules';

type Client = Pick<Prisma.TransactionClient, 'contractService'>;

/**
 * Nhóm thực hiện hiện tại của một dòng dịch vụ (H8): dòng kiểm toán đọc nhóm 04-F, dòng khác đọc
 * bảng nhóm dịch vụ kế toán. Một hàm dùng chung cho công việc (05) và đánh giá (10).
 */
export async function lineTeam(
  prisma: Client,
  contractServiceId: string,
): Promise<ServiceTeamInput | null> {
  const line = await prisma.contractService.findUnique({
    where: { id: contractServiceId },
    select: {
      serviceType: { select: { issuesAuditReport: true } },
      audit: {
        select: {
          managerId: true,
          leadId: true,
          members: { orderBy: { sortOrder: 'asc' }, select: { userId: true } },
        },
      },
      team: {
        select: {
          managerId: true,
          leadId: true,
          members: { orderBy: { sortOrder: 'asc' }, select: { userId: true } },
        },
      },
    },
  });
  if (!line) return null;
  const source = line.serviceType.issuesAuditReport ? line.audit : line.team;
  if (!source) return null;
  return {
    managerId: source.managerId,
    leadId: source.leadId,
    assistantIds: source.members.map((m) => m.userId),
  };
}
