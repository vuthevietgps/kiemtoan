import { AuditRole, AuditStage, ContractStatus } from '@prisma/client';

const { NOT_STARTED, FIELDWORK, REVIEW, AWAITING_ISSUE, ISSUED } = AuditStage;

/** Thứ tự giai đoạn BCKT (04-F). */
export const STAGE_ORDER: readonly AuditStage[] = [
  NOT_STARTED,
  FIELDWORK,
  REVIEW,
  AWAITING_ISSUE,
  ISSUED,
];

/** HĐ đã duyệt (chưa huỷ) mới được chuyển giai đoạn và phát hành. */
export const STAGE_CONTRACT_STATUSES: readonly ContractStatus[] = [
  ContractStatus.NOT_STARTED,
  ContractStatus.IN_PROGRESS,
  ContractStatus.COMPLETED,
  ContractStatus.LIQUIDATED,
];

export const MAX_ASSISTANTS = 10;
export const REASON_MIN = 5;
export const REASON_MAX = 500;

export function validReason(reason: string | null | undefined): boolean {
  const length = reason?.trim().length ?? 0;
  return length >= REASON_MIN && length <= REASON_MAX;
}

/**
 * Kiểm tra chuyển giai đoạn qua API "stage": chỉ tiến một bước, lùi phải có lý do; phát hành và
 * mở lại có API riêng. Trả thông báo lỗi hoặc null khi hợp lệ.
 */
export function stageMoveError(
  from: AuditStage,
  to: AuditStage,
  reason?: string | null,
): string | null {
  if (from === ISSUED)
    return 'Báo cáo đã phát hành; mở lại trước khi đổi giai đoạn';
  if (to === ISSUED) return 'Dùng chức năng Phát hành để phát hành báo cáo';
  if (to === from) return 'Hồ sơ đã ở giai đoạn này';
  const step = STAGE_ORDER.indexOf(to) - STAGE_ORDER.indexOf(from);
  if (step > 1) return 'Chỉ chuyển tới giai đoạn kế tiếp';
  if (step < 0 && !validReason(reason))
    return `Lùi giai đoạn phải ghi lý do (${REASON_MIN}–${REASON_MAX} ký tự)`;
  return null;
}

export function isBackward(from: AuditStage, to: AuditStage): boolean {
  return STAGE_ORDER.indexOf(to) < STAGE_ORDER.indexOf(from);
}

/** Số BCKT để so trùng (F5): bỏ khoảng trắng đầu/cuối, không phân biệt hoa thường. */
export function reportNumberKey(reportNumber: string): string {
  return reportNumber.trim().toLowerCase();
}

/** Năm kiểm toán: năm của kỳ dòng dịch vụ (2025, 2025-12, 2025-Q4); không có kỳ thì năm bắt đầu HĐ. */
export function auditYear(period: string | null, contractStart: Date): number {
  const match = period?.match(/^(\d{4})/);
  return match ? Number(match[1]) : contractStart.getUTCFullYear();
}

export interface TeamInput {
  managerId: string | null;
  leadId: string | null;
  signer1Id: string | null;
  signer2Id: string | null;
  assistantIds: string[];
}

/** Ràng buộc nhóm: không ai giữ hai vai trong nhóm, người ký 1 ≠ người ký 2, có ký 1 mới có ký 2. */
export function teamError(team: TeamInput): string | null {
  if (team.assistantIds.length > MAX_ASSISTANTS)
    return `Tối đa ${MAX_ASSISTANTS} trợ lý`;
  const members = [team.managerId, team.leadId, ...team.assistantIds].filter(
    (id): id is string => !!id,
  );
  if (new Set(members).size !== members.length)
    return 'Một người không giữ hai vai trong cùng nhóm kiểm toán';
  if (team.signer2Id && !team.signer1Id)
    return 'Chọn người ký 1 trước người ký 2';
  if (team.signer1Id && team.signer1Id === team.signer2Id)
    return 'Người ký 1 và người ký 2 phải khác nhau';
  return null;
}

export interface RoleAssignment {
  role: AuditRole;
  userId: string;
}

export function roleAssignments(team: TeamInput): RoleAssignment[] {
  const single: [AuditRole, string | null][] = [
    [AuditRole.MANAGER, team.managerId],
    [AuditRole.LEAD, team.leadId],
    [AuditRole.SIGNER1, team.signer1Id],
    [AuditRole.SIGNER2, team.signer2Id],
  ];
  return [
    ...single
      .filter((entry): entry is [AuditRole, string] => !!entry[1])
      .map(([role, userId]) => ({ role, userId })),
    ...team.assistantIds.map((userId) => ({
      role: AuditRole.ASSISTANT,
      userId,
    })),
  ];
}

/** Vai bị bỏ (đóng lịch sử) và vai mới (mở lịch sử) giữa hai đội hình. */
export function diffRoles(before: RoleAssignment[], after: RoleAssignment[]) {
  const key = (a: RoleAssignment) => `${a.role}:${a.userId}`;
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  return {
    closed: before.filter((a) => !afterKeys.has(key(a))),
    opened: after.filter((a) => !beforeKeys.has(key(a))),
  };
}
