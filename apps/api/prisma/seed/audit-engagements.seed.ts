import { AuditDeadlineKind, AuditStage, PrismaClient } from '@prisma/client';

/** Ngày nghiệp vụ (giờ VN, UTC 00:00) lệch `days` ngày so với hôm nay — demo luôn có đủ trường hợp. */
const rel = (days: number) => {
  const now = new Date(Date.now() + 7 * 3_600_000);
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
  );
};

/** [loại hạn, hạn gốc, hạn hiện hành, lúc đạt]; hạn hiện hành khác hạn gốc = đã gia hạn. */
type DeadlineSeed = [AuditDeadlineKind, Date, Date, Date | null];

interface EngagementSeed {
  contract: string;
  stage: AuditStage;
  /** Email theo thứ tự: Manager, trưởng nhóm, người ký 1, trợ lý. */
  manager: string;
  lead: string;
  signer1: string;
  assistants: string[];
  report?: { number: string; date: string };
  deadlines: DeadlineSeed[];
}

const SEEDS: EngagementSeed[] = [
  {
    contract: 'HD-2025-013',
    stage: AuditStage.REVIEW,
    manager: 'ketoantruong@demo.vn',
    lead: 'nhanvien1@demo.vn',
    signer1: 'giamdoc@demo.vn',
    assistants: ['nhanvien2@demo.vn', 'nhanvien3@demo.vn'],
    // Kết thúc kiểm toán đúng hạn, soát xét đang quá hạn, phát hành sắp tới.
    deadlines: [
      ['FIELDWORK_END', rel(-20), rel(-20), rel(-22)],
      ['REVIEW_END', rel(-2), rel(-2), null],
      ['REPORT_ISSUE', rel(15), rel(15), null],
    ],
  },
  {
    contract: 'HD-2025-018',
    stage: AuditStage.FIELDWORK,
    manager: 'ketoantruong@demo.vn',
    lead: 'nhanvien2@demo.vn',
    signer1: 'giamdoc@demo.vn',
    assistants: ['nhanvien1@demo.vn'],
    // Sắp đến hạn kết thúc kiểm toán; hạn phát hành đã được gia hạn.
    deadlines: [
      ['FIELDWORK_END', rel(5), rel(5), null],
      ['REPORT_ISSUE', rel(30), rel(40), null],
    ],
  },
  {
    contract: 'HD-2025-019',
    stage: AuditStage.ISSUED,
    manager: 'ketoantruong@demo.vn',
    lead: 'nhanvien3@demo.vn',
    signer1: 'giamdoc@demo.vn',
    assistants: ['nhanvien2@demo.vn'],
    report: { number: '150425/2025/BCKT-DEMO', date: '2025-04-15' },
    // Báo cáo năm trước: kết thúc kiểm toán trễ 5 ngày, phát hành trễ 5 ngày.
    deadlines: [
      [
        'FIELDWORK_END',
        new Date('2025-03-15'),
        new Date('2025-03-15'),
        new Date('2025-03-20T03:00:00Z'),
      ],
      [
        'REVIEW_END',
        new Date('2025-04-05'),
        new Date('2025-04-05'),
        new Date('2025-04-04T03:00:00Z'),
      ],
      [
        'REPORT_ISSUE',
        new Date('2025-04-10'),
        new Date('2025-04-10'),
        new Date('2025-04-15T03:00:00Z'),
      ],
    ],
  },
];

const PATH: AuditStage[] = [
  AuditStage.NOT_STARTED,
  AuditStage.FIELDWORK,
  AuditStage.REVIEW,
  AuditStage.AWAITING_ISSUE,
  AuditStage.ISSUED,
];

/**
 * Hồ sơ kiểm toán demo (04-F): nhóm, người ký, giai đoạn, một báo cáo đã phát hành; một HĐ có BBNT
 * đang chờ ký. Chạy sau seedContracts; dòng đã có hồ sơ thì bỏ qua.
 */
export async function seedAuditEngagements(
  prisma: PrismaClient,
): Promise<void> {
  const users = new Map(
    (await prisma.user.findMany({ select: { id: true, email: true } })).map(
      (u) => [u.email, u.id],
    ),
  );
  const director = users.get('giamdoc@demo.vn');
  if (!director) return;
  for (const s of SEEDS) {
    const line = await prisma.contractService.findFirst({
      where: {
        contract: { code: s.contract },
        serviceType: { issuesAuditReport: true },
      },
      include: { audit: true },
    });
    const ids = [s.manager, s.lead, s.signer1, ...s.assistants].map((e) =>
      users.get(e),
    );
    if (!line || ids.some((id) => !id)) continue;
    const [managerId, leadId, signer1Id, ...assistantIds] = ids as string[];
    const steps = PATH.slice(0, PATH.indexOf(s.stage) + 1);
    const engagement =
      line.audit ??
      (await prisma.auditEngagement.create({
        data: {
          contractServiceId: line.id,
          stage: s.stage,
          managerId,
          leadId,
          signer1Id,
          revision: steps.length,
          ...(s.report && {
            reportNumber: s.report.number,
            reportNumberKey: s.report.number.toLowerCase(),
            reportDate: new Date(s.report.date),
            issuedById: director,
            issuedAt: new Date(s.report.date),
          }),
          members: {
            create: assistantIds.map((userId, sortOrder) => ({
              userId,
              sortOrder,
            })),
          },
          roleHistory: {
            create: [
              { role: 'MANAGER' as const, userId: managerId },
              { role: 'LEAD' as const, userId: leadId },
              { role: 'SIGNER1' as const, userId: signer1Id },
              ...assistantIds.map((userId) => ({
                role: 'ASSISTANT' as const,
                userId,
              })),
            ].map((r) => ({ ...r, fromAt: TEAM_FROM })),
          },
          stageEvents: {
            create: steps.slice(1).map((toStage, i) => ({
              fromStage: steps[i],
              toStage,
              actorId: toStage === AuditStage.ISSUED ? director : leadId,
            })),
          },
        },
      }));
    await seedDeadlines(prisma, engagement.id, s.deadlines, director);
  }
  await prisma.contract.updateMany({
    where: { code: 'HD-2025-013', acceptanceStatus: 'NONE' },
    data: {
      acceptanceStatus: 'AWAITING_SIGNATURE',
      clientDeliveryStatus: 'HARD_AND_SOFT',
      clientDeliveredAt: new Date('2025-05-12'),
      originalFilingStatus: 'FILED',
      originalFiledAt: new Date('2025-05-20'),
      originalFilingNote: 'Tủ hồ sơ 2, ngăn A',
    },
  });
}

/** Nhóm demo coi như được giao từ 120 ngày trước, trước mọi hạn mẫu (để tính trách nhiệm F10). */
const TEAM_FROM = rel(-120);

/** Thêm hạn cho hồ sơ chưa có hạn (kể cả hồ sơ tạo trước 04-F2); đã có thì bỏ qua. */
async function seedDeadlines(
  prisma: PrismaClient,
  engagementId: string,
  deadlines: DeadlineSeed[],
  director: string,
) {
  if (await prisma.auditEngagementDeadline.count({ where: { engagementId } }))
    return;
  for (const [kind, originalDue, currentDue, achievedAt] of deadlines)
    await prisma.auditEngagementDeadline.create({
      data: {
        engagementId,
        kind,
        originalDue,
        currentDue,
        achievedAt,
        ...(originalDue.getTime() !== currentDue.getTime() && {
          changes: {
            create: {
              oldDue: originalDue,
              newDue: currentDue,
              reason: 'Khách hàng chậm gửi số liệu (dữ liệu demo)',
              changedById: director,
            },
          },
        }),
      },
    });
  await prisma.auditEngagement.update({
    where: { id: engagementId },
    data: { deadlinesLockedAt: TEAM_FROM },
  });
  await prisma.auditEngagementRoleHistory.updateMany({
    where: { engagementId, fromAt: { gt: TEAM_FROM } },
    data: { fromAt: TEAM_FROM },
  });
}
