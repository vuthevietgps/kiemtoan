import type { RuleInput } from './data-access/deadline-settings.api';
import { CONDITION_FIELDS, SHIFT_LABELS } from './deadline-settings.text';

const vnDate = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

/** Mô tả quy tắc hạn bằng lời để KTT/GĐ đối chiếu trước khi xác nhận (I1/I3). */
export function ruleSummary(rule: RuleInput): string {
  const day = rule.dueDay === 31 ? 'ngày cuối tháng' : `ngày ${rule.dueDay}`;
  const due =
    rule.dueRule === 'FIXED_IN_YEAR'
      ? `Hạn ${day} tháng ${rule.dueMonth ?? '?'} của năm sau kỳ`
      : rule.monthsAfter === 0
        ? `Hạn ${day} của tháng cuối kỳ`
        : `Hạn ${day} của tháng thứ ${rule.monthsAfter ?? '?'} sau tháng cuối kỳ`;
  const parts = [
    due,
    `trùng ngày nghỉ: ${SHIFT_LABELS[rule.holidayShift].toLowerCase()}`,
    `áp dụng cho kỳ kết thúc từ ${vnDate(rule.effectiveFrom)}`,
  ];
  if (rule.useFiscalYear) parts.push('kỳ năm theo năm tài chính của KH');
  const conditions = CONDITION_FIELDS.filter((f) => rule.conditions?.[f.key]?.length).map(
    (f) => `${f.label}: ${rule.conditions[f.key]!.map((v) => f.options[v] ?? v).join(', ')}`,
  );
  if (conditions.length) parts.push(`chỉ khi ${conditions.join('; ')}`);
  return parts.join('; ');
}
