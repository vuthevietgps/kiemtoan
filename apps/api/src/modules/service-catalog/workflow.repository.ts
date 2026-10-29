import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  DocumentRequirementDto,
  WorkflowStepDto,
} from './dto/workflow.dto';

/** Truy vấn và ghi dữ liệu quy trình dùng chung cho các service quy trình mẫu. */

export const VERSION_DETAIL = {
  template: {
    select: {
      id: true,
      code: true,
      name: true,
      isDefault: true,
      isActive: true,
      serviceType: { select: { id: true, code: true, name: true } },
    },
  },
  requirements: {
    orderBy: { sortOrder: 'asc' },
    include: { step: { select: { stepKey: true } } },
  },
  steps: {
    orderBy: { sortOrder: 'asc' },
    include: {
      dependsOn: { select: { dependsOn: { select: { stepKey: true } } } },
    },
  },
} satisfies Prisma.WorkflowTemplateVersionInclude;

export type VersionDetail = Prisma.WorkflowTemplateVersionGetPayload<{
  include: typeof VERSION_DETAIL;
}>;

type StoredStep = VersionDetail['steps'][number];

/** Bước theo đúng dạng nhập (WorkflowStepDto); phụ thuộc biểu diễn bằng khoá bước. */
function toStepShape(s: StoredStep): WorkflowStepDto {
  return {
    key: s.stepKey,
    phase: s.phase,
    name: s.name,
    instructions: s.instructions,
    required: s.required,
    durationDays: s.durationDays,
    dueOffsetDays: s.dueOffsetDays,
    performerRole: s.performerRole,
    defaultAssigneeId: s.defaultAssigneeId,
    reviewLevels: s.reviewLevels,
    reviewerRole: s.reviewerRole,
    defaultReviewerId: s.defaultReviewerId,
    defaultApproverId: s.defaultApproverId,
    requiresEvidence: s.requiresEvidence,
    evidenceHint: s.evidenceHint,
    isStatutory: s.isStatutory,
    requiresDelivery: s.requiresDelivery,
    obligationTypeId: s.obligationTypeId,
    dependsOn: s.dependsOn.map((d) => d.dependsOn.stepKey),
  };
}

/** Phiên bản trả về API: bước cùng dạng với nội dung gửi lên khi lưu nháp. */
export function toVersionView(version: VersionDetail) {
  return {
    ...version,
    steps: version.steps.map(toStepShape),
    requirements: version.requirements.map((r): DocumentRequirementDto => ({
      name: r.name,
      instructions: r.instructions,
      required: r.required,
      category: r.category,
      perPeriod: r.perPeriod,
      stepKey: r.step?.stepKey ?? null,
    })),
  };
}

export type VersionView = ReturnType<typeof toVersionView>;

/** Bước để kiểm tra, lập lịch hoặc chép sang phiên bản mới. */
export function toStepInputs(version: VersionView): WorkflowStepDto[] {
  return version.steps.map((s) => ({ ...s, dependsOn: [...s.dependsOn] }));
}

/** Ghi lại toàn bộ bước và phụ thuộc của một phiên bản (đã xoá bước cũ trước đó). */
export async function writeSteps(
  tx: Prisma.TransactionClient,
  versionId: string,
  steps: WorkflowStepDto[],
): Promise<Map<string, string>> {
  const ids = new Map(steps.map((s) => [s.key, randomUUID()]));
  await tx.workflowStep.createMany({
    data: steps.map((s, index) => ({
      id: ids.get(s.key)!,
      versionId,
      stepKey: s.key,
      sortOrder: index + 1,
      phase: s.phase?.trim() || null,
      name: s.name.trim(),
      instructions: s.instructions?.trim() || null,
      required: s.required ?? true,
      durationDays: s.durationDays ?? null,
      dueOffsetDays: s.dueOffsetDays ?? null,
      performerRole: s.performerRole ?? null,
      defaultAssigneeId: s.defaultAssigneeId ?? null,
      reviewLevels: s.reviewLevels ?? 0,
      reviewerRole: s.reviewerRole ?? null,
      defaultReviewerId: s.defaultReviewerId ?? null,
      defaultApproverId: s.defaultApproverId ?? null,
      requiresEvidence: s.requiresEvidence ?? true,
      evidenceHint: s.evidenceHint?.trim() || null,
      isStatutory: s.isStatutory ?? false,
      requiresDelivery: s.requiresDelivery ?? s.isStatutory ?? false,
      obligationTypeId: s.isStatutory ? (s.obligationTypeId ?? null) : null,
    })),
  });
  const dependencies = steps.flatMap((s) =>
    s.dependsOn.map((dep) => ({
      stepId: ids.get(s.key)!,
      dependsOnStepId: ids.get(dep)!,
    })),
  );
  if (dependencies.length > 0)
    await tx.workflowStepDependency.createMany({ data: dependencies });
  return ids;
}

/** Ghi lại danh sách hồ sơ yêu cầu, nối với bước theo khoá (stepIds từ writeSteps). */
export async function writeRequirements(
  tx: Prisma.TransactionClient,
  versionId: string,
  requirements: DocumentRequirementDto[],
  stepIds: Map<string, string>,
): Promise<void> {
  if (requirements.length === 0) return;
  await tx.documentRequirement.createMany({
    data: requirements.map((r, index) => ({
      versionId,
      sortOrder: index + 1,
      name: r.name.trim(),
      instructions: r.instructions?.trim() || null,
      required: r.required ?? true,
      category: r.category ?? 'SERVICE',
      perPeriod: r.perPeriod ?? false,
      stepId: r.stepKey ? (stepIds.get(r.stepKey) ?? null) : null,
    })),
  });
}

/** Người mặc định trong các bước phải là tài khoản nghiệp vụ đang hoạt động. */
export async function assertActiveUsers(
  client: Pick<Prisma.TransactionClient, 'user'>,
  steps: WorkflowStepDto[],
): Promise<void> {
  const ids = [
    ...new Set(
      steps.flatMap((s) =>
        [s.defaultAssigneeId, s.defaultReviewerId, s.defaultApproverId].filter(
          (id): id is string => !!id,
        ),
      ),
    ),
  ];
  if (ids.length === 0) return;
  const found = await client.user.findMany({
    where: {
      id: { in: ids },
      isActive: true,
      deletedAt: null,
      leftAt: null,
      role: { not: 'ADMIN' },
    },
    select: { id: true },
  });
  if (found.length !== ids.length)
    throw new BadRequestException(
      'Người thực hiện/kiểm tra/phê duyệt mặc định phải là nhân sự đang hoạt động',
    );
}

/** 06 (I6): loại nghĩa vụ gắn bước phải tồn tại, chưa ngừng, và chỉ cho bước có hạn pháp lý. */
export async function assertObligationTypes(
  client: Pick<Prisma.TransactionClient, 'obligationType'>,
  steps: WorkflowStepDto[],
): Promise<void> {
  const linked = steps.filter((s) => s.obligationTypeId);
  const notStatutory = linked.find((s) => !s.isStatutory);
  if (notStatutory)
    throw new BadRequestException(
      `Bước "${notStatutory.name}": chỉ bước có hạn pháp lý mới chọn loại nghĩa vụ`,
    );
  const ids = [...new Set(linked.map((s) => s.obligationTypeId!))];
  if (!ids.length) return;
  const found = await client.obligationType.count({
    where: { id: { in: ids }, retiredAt: null },
  });
  if (found !== ids.length)
    throw new BadRequestException('Loại nghĩa vụ không tồn tại hoặc đã ngừng');
}

/** Mã quy trình kế tiếp QT-<mã DV>-NNN, tính cả quy trình đã xoá để không dùng lại mã. */
export async function nextTemplateCode(
  tx: Pick<Prisma.TransactionClient, 'workflowTemplate'>,
  serviceCode: string,
): Promise<string> {
  const prefix = `QT-${serviceCode}-`;
  const rows = await tx.workflowTemplate.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  const max = rows
    .map((r) => Number(r.code.slice(prefix.length)))
    .filter((n) => Number.isInteger(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}
