import {
  PrismaClient,
  Role,
  WorkflowScheduleMode,
  WorkflowVersionStatus,
} from '@prisma/client';

/** Mẫu 12 bước "Làm lại sổ sách" theo PL1 II.1: [giai đoạn, tên, số ngày, vai trò]. Dữ liệu mẫu, quản lý điều chỉnh được. */
const REBUILD_BOOKS: [string, string, number, Role][] = [
  ['Tiếp nhận hồ sơ', 'Tiếp nhận hồ sơ', 2, Role.STAFF],
  ['Rà soát dữ liệu', 'Kiểm tra dữ liệu', 3, Role.STAFF],
  ['Rà soát dữ liệu', 'Lập danh sách hồ sơ thiếu', 2, Role.STAFF],
  ['Rà soát dữ liệu', 'Đối chiếu số dư', 5, Role.STAFF],
  ['Rà soát dữ liệu', 'Kiểm tra hóa đơn', 5, Role.STAFF],
  ['Rà soát dữ liệu', 'Kiểm tra lương, BHXH', 5, Role.STAFF],
  ['Rà soát dữ liệu', 'Kiểm tra hàng tồn kho', 5, Role.STAFF],
  ['Hoàn thiện sổ sách', 'Hoàn thiện sổ sách', 10, Role.STAFF],
  ['Hoàn thiện sổ sách', 'Lập báo cáo tài chính', 3, Role.STAFF],
  ['Kiểm tra và bàn giao', 'Kiểm tra nội bộ', 3, Role.MANAGER],
  ['Kiểm tra và bàn giao', 'Phê duyệt', 2, Role.MANAGER],
  ['Kiểm tra và bàn giao', 'Bàn giao khách hàng', 1, Role.STAFF],
];

/** Hồ sơ hoàn thuế GTGT theo PL1 V.1: [tên, bắt buộc]. Hồ sơ "nếu có" là tuỳ chọn. */
const VAT_REFUND_DOCUMENTS: [string, boolean][] = [
  ['Tờ khai thuế GTGT', true],
  ['Bảng kê hóa đơn', true],
  ['Hợp đồng kinh tế', true],
  ['Chứng từ thanh toán', true],
  ['Hồ sơ xuất khẩu', false],
  ['Tờ khai hải quan', false],
  ['Các chứng từ liên quan khác', false],
];

const key = (i: number) => `B${String(i + 1).padStart(2, '0')}`;

/**
 * Quy trình mặc định QT-<mã>-001, phiên bản 1 đang hiệu lực. Dịch vụ làm lại sổ sách dùng mẫu
 * 12 bước nối tiếp theo dự án; dịch vụ khác lập lịch theo kỳ từ danh sách việc mẫu cũ.
 * Chỉ tạo khi dịch vụ chưa có quy trình (DB đã chạy migration giữ dữ liệu chuyển đổi).
 */
export async function seedWorkflow(
  prisma: PrismaClient,
  service: { id: string; code: string; name: string },
  templates: [string, number, boolean][],
): Promise<void> {
  const exists = await prisma.workflowTemplate.count({
    where: { serviceTypeId: service.id, deletedAt: null },
  });
  if (exists > 0) return;
  const project = service.code === 'LLSS';
  const steps = project
    ? REBUILD_BOOKS.map(([phase, name, durationDays, performerRole], i) => ({
        stepKey: key(i),
        sortOrder: i + 1,
        phase,
        name,
        durationDays,
        performerRole,
        reviewLevels: performerRole === Role.STAFF ? 1 : 0,
        reviewerRole: performerRole === Role.STAFF ? Role.MANAGER : null,
      }))
    : templates.map(([name, dueOffsetDays, requiresEvidence], i) => ({
        stepKey: key(i),
        sortOrder: i + 1,
        name,
        dueOffsetDays,
        requiresEvidence,
        reviewLevels: 1,
        reviewerRole: Role.MANAGER,
      }));
  const template = await prisma.workflowTemplate.create({
    data: {
      code: `QT-${service.code}-001`,
      serviceTypeId: service.id,
      name: `Quy trình ${service.name}`,
      isDefault: true,
      versions: {
        create: {
          versionNo: 1,
          status: WorkflowVersionStatus.PUBLISHED,
          publishedAt: new Date(),
          scheduleMode: project
            ? WorkflowScheduleMode.PROJECT
            : WorkflowScheduleMode.PERIODIC,
          note: 'Dữ liệu mẫu cho môi trường dev',
          steps: { create: steps },
        },
      },
    },
    include: { versions: { include: { steps: true } } },
  });
  const version = template.versions[0];
  if (service.code === 'HT') {
    // Hồ sơ cần cho bước lập hồ sơ đề nghị hoàn thuế (B02).
    const step = version.steps.find((s) => s.stepKey === 'B02');
    await prisma.documentRequirement.createMany({
      data: VAT_REFUND_DOCUMENTS.map(([name, required], i) => ({
        versionId: version.id,
        sortOrder: i + 1,
        name,
        required,
        stepId: required ? (step?.id ?? null) : null,
      })),
    });
  }
  if (!project) return;
  // Mẫu PL1: các bước nối tiếp, bước sau chờ bước trước.
  const created = version.steps.sort((a, b) => a.sortOrder - b.sortOrder);
  await prisma.workflowStepDependency.createMany({
    data: created.slice(1).map((step, i) => ({
      stepId: step.id,
      dependsOnStepId: created[i].id,
    })),
  });
}
