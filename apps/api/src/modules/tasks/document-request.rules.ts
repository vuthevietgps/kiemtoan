import { DocumentCategory, DocumentRequestStatus } from '@prisma/client';

/**
 * Hồ sơ yêu cầu của khách (đặc tả 05, PL1 V, H4). Hàm thuần: sinh danh sách theo kỳ, chuyển trạng
 * thái, xác định việc còn bị chặn vì hồ sơ bắt buộc chưa "Đã chấp nhận".
 */

const S = DocumentRequestStatus;

export type DocumentRequestAction =
  'REQUEST' | 'UPLOAD' | 'REVIEW' | 'SUPPLEMENT' | 'ACCEPT';

/** Trạng thái được phép thực hiện từng thao tác và trạng thái đích. */
export const REQUEST_TRANSITIONS: Record<
  DocumentRequestAction,
  { from: DocumentRequestStatus[]; to: DocumentRequestStatus }
> = {
  // Ghi nhận đã yêu cầu khách (lần đầu hoặc yêu cầu lại sau "Cần bổ sung").
  REQUEST: { from: [S.NOT_REQUESTED, S.NEEDS_SUPPLEMENT], to: S.REQUESTED },
  // Tải thay khách: không tự hoàn tất việc (PL1 V.4).
  UPLOAD: {
    from: [S.NOT_REQUESTED, S.REQUESTED, S.NEEDS_SUPPLEMENT, S.UPLOADED],
    to: S.UPLOADED,
  },
  REVIEW: { from: [S.UPLOADED], to: S.IN_REVIEW },
  SUPPLEMENT: { from: [S.UPLOADED, S.IN_REVIEW], to: S.NEEDS_SUPPLEMENT },
  ACCEPT: { from: [S.UPLOADED, S.IN_REVIEW], to: S.ACCEPTED },
};

export const REQUEST_STATUS_LABELS: Record<DocumentRequestStatus, string> = {
  NOT_REQUESTED: 'Chưa yêu cầu',
  REQUESTED: 'Đã yêu cầu',
  UPLOADED: 'Khách hàng đã tải lên',
  IN_REVIEW: 'Đang kiểm tra',
  NEEDS_SUPPLEMENT: 'Cần bổ sung',
  ACCEPTED: 'Đã chấp nhận',
};

export function requestActionError(
  action: DocumentRequestAction,
  status: DocumentRequestStatus,
): string | null {
  return REQUEST_TRANSITIONS[action].from.includes(status)
    ? null
    : `Hồ sơ đang ở trạng thái "${REQUEST_STATUS_LABELS[status]}", không thực hiện được thao tác này`;
}

export interface PlanRequirementInput {
  id: string;
  name: string;
  instructions: string | null;
  required: boolean;
  category: DocumentCategory;
  perPeriod: boolean;
  stepKey: string | null;
}

export interface RequestDraft {
  planRequirementId: string;
  period: string;
  perPeriod: boolean;
  stepKey: string | null;
  name: string;
  instructions: string | null;
  required: boolean;
  category: DocumentCategory;
}

/** Hồ sơ "theo kỳ" sinh cho từng kỳ; hồ sơ "một lần" sinh một bản (lưu ở kỳ đầu). */
export function requestDrafts(
  requirements: PlanRequirementInput[],
  periods: string[],
): RequestDraft[] {
  if (periods.length === 0) return [];
  return requirements.flatMap((r) =>
    (r.perPeriod ? periods : [periods[0]]).map((period) => ({
      planRequirementId: r.id,
      period,
      perPeriod: r.perPeriod,
      stepKey: r.stepKey,
      name: r.name,
      instructions: r.instructions,
      required: r.required,
      category: r.category,
    })),
  );
}

export interface GateRequest {
  name: string;
  stepKey: string | null;
  period: string | null;
  perPeriod: boolean;
  required: boolean;
  status: DocumentRequestStatus;
}

/**
 * H4: tên hồ sơ bắt buộc của bước (cùng kỳ, hoặc hồ sơ một lần) chưa "Đã chấp nhận" — việc của bước
 * đó chưa bắt đầu được.
 */
export function missingDocuments(
  task: { stepKey: string | null; period: string | null },
  requests: GateRequest[],
): string[] {
  if (!task.stepKey) return [];
  return requests
    .filter(
      (r) =>
        r.required &&
        r.stepKey === task.stepKey &&
        (!r.perPeriod || r.period === task.period) &&
        r.status !== S.ACCEPTED,
    )
    .map((r) => r.name);
}
