import { BadRequestException } from '@nestjs/common';

/** Dấu mở/đóng trường trộn trong file Word, ví dụ {{customer.name}}. */
export const FIELD_DELIMITERS: [string, string] = ['{{', '}}'];

export interface TemplateField {
  key: string;
  label: string;
}

export interface TemplateList {
  key: TemplateListKey;
  label: string;
  fields: TemplateField[];
}

export type TemplateListKey = 'services' | 'installments';

/**
 * Danh sách trường trộn công bố (đặc tả 04-C): thông tin công ty, khách hàng, hợp đồng,
 * dòng dịch vụ, đợt thanh toán, tổng tiền bằng số và chữ. Mẫu dùng trường ngoài danh sách bị chặn.
 */
export const TEMPLATE_FIELDS: TemplateField[] = [
  { key: 'company.name', label: 'Tên công ty' },
  { key: 'company.taxCode', label: 'Mã số thuế công ty' },
  { key: 'company.address', label: 'Địa chỉ công ty' },
  { key: 'company.phone', label: 'Điện thoại công ty' },
  { key: 'company.representative', label: 'Người đại diện công ty' },
  { key: 'company.representativeTitle', label: 'Chức vụ người đại diện' },
  { key: 'company.bankAccount', label: 'Số tài khoản công ty' },
  { key: 'company.bankName', label: 'Ngân hàng' },
  { key: 'customer.name', label: 'Tên khách hàng' },
  { key: 'customer.taxCode', label: 'Mã số thuế khách hàng' },
  { key: 'customer.address', label: 'Địa chỉ khách hàng' },
  { key: 'customer.legalRep', label: 'Người đại diện khách hàng' },
  { key: 'customer.contactName', label: 'Người liên hệ' },
  { key: 'customer.contactPhone', label: 'Điện thoại liên hệ' },
  { key: 'customer.contactEmail', label: 'Email liên hệ' },
  { key: 'contract.code', label: 'Số hợp đồng' },
  { key: 'contract.signedDate', label: 'Ngày ký (dd/MM/yyyy)' },
  { key: 'contract.startDate', label: 'Ngày bắt đầu' },
  { key: 'contract.endDate', label: 'Ngày kết thúc' },
  { key: 'contract.ownerName', label: 'Người phụ trách hợp đồng' },
  { key: 'contract.note', label: 'Ghi chú hợp đồng' },
  { key: 'contract.vatRate', label: 'Thuế suất VAT (%)' },
  { key: 'contract.subtotal', label: 'Tiền trước VAT' },
  { key: 'contract.vatAmount', label: 'Tiền VAT' },
  { key: 'contract.total', label: 'Tổng thanh toán' },
  { key: 'contract.subtotalInWords', label: 'Tiền trước VAT bằng chữ' },
  { key: 'contract.totalInWords', label: 'Tổng thanh toán bằng chữ' },
  { key: 'today.date', label: 'Ngày lập (dd/MM/yyyy)' },
  { key: 'today.day', label: 'Ngày lập — ngày' },
  { key: 'today.month', label: 'Ngày lập — tháng' },
  { key: 'today.year', label: 'Ngày lập — năm' },
  // 07-D3 (J9): đề nghị thanh toán — các đợt được chọn (mẫu khác: mọi đợt còn nợ).
  { key: 'payment.installments', label: 'Đợt đề nghị thanh toán' },
  { key: 'payment.amount', label: 'Số tiền đề nghị thanh toán' },
  { key: 'payment.amountInWords', label: 'Số tiền đề nghị bằng chữ' },
  { key: 'payment.dueDate', label: 'Hạn thanh toán sớm nhất' },
  { key: 'payment.transferContent', label: 'Nội dung chuyển khoản' },
];

/** Ảnh chèn bằng lệnh IMAGE: chỉ mã VietQR của đề nghị thanh toán (07-D3). */
export const TEMPLATE_IMAGES: TemplateField[] = [
  { key: 'payment.qr', label: 'Ảnh mã VietQR — dùng {{IMAGE payment.qr}}' },
];

export const TEMPLATE_LISTS: TemplateList[] = [
  {
    key: 'services',
    label: 'Dòng dịch vụ',
    fields: [
      { key: 'index', label: 'STT' },
      { key: 'code', label: 'Mã dịch vụ' },
      { key: 'name', label: 'Tên dịch vụ' },
      { key: 'description', label: 'Diễn giải' },
      { key: 'period', label: 'Kỳ' },
      { key: 'quantity', label: 'Số lượng' },
      { key: 'unitPrice', label: 'Đơn giá' },
      { key: 'amount', label: 'Thành tiền' },
    ],
  },
  {
    key: 'installments',
    label: 'Đợt thanh toán',
    fields: [
      { key: 'index', label: 'STT' },
      { key: 'name', label: 'Tên đợt' },
      { key: 'dueDate', label: 'Hạn thanh toán' },
      { key: 'amount', label: 'Số tiền' },
      { key: 'amountInWords', label: 'Số tiền bằng chữ' },
    ],
  },
];

export interface TemplateCommand {
  type: string;
  code: string;
}

const SCALAR_KEYS = new Set(TEMPLATE_FIELDS.map((f) => f.key));
const IMAGE_KEYS = new Set(TEMPLATE_IMAGES.map((f) => f.key));
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;
const LOOP = /^([A-Za-z][A-Za-z0-9_]*)\s+IN\s+([A-Za-z][A-Za-z0-9_]*)$/;
const LIST_VAR = /^\$([A-Za-z][A-Za-z0-9_]*)\.([A-Za-z][A-Za-z0-9_]*)$/;

/**
 * Kiểm tra lệnh trong mẫu chỉ là trường công bố, vòng lặp FOR … IN services|installments và
 * END-FOR tương ứng, IMAGE payment.qr. Trả về danh sách trường dùng; sai thì báo 400 liệt kê lệnh không hợp lệ.
 */
export function validateTemplateCommands(
  commands: TemplateCommand[],
): string[] {
  const used = new Set<string>();
  const invalid: string[] = [];
  const loops: { variable: string; list: TemplateList }[] = [];
  for (const command of commands) {
    const code = command.code.trim();
    const type = command.type.toUpperCase();
    if (type === 'INS' && SCALAR_KEYS.has(code)) {
      used.add(code);
    } else if (type === 'IMAGE' && IMAGE_KEYS.has(code)) {
      used.add(code);
    } else if (type === 'INS' && LIST_VAR.test(code)) {
      const [, variable, field] = LIST_VAR.exec(code)!;
      const loop = loops.find((l) => l.variable === variable);
      if (loop?.list.fields.some((f) => f.key === field))
        used.add(`${loop.list.key}.${field}`);
      else invalid.push(command.code);
    } else if (type === 'FOR' && LOOP.test(code)) {
      const [, variable, listKey] = LOOP.exec(code)!;
      const list = TEMPLATE_LISTS.find((l) => l.key === listKey);
      if (list && !loops.some((l) => l.variable === variable)) {
        loops.push({ variable, list });
        used.add(list.key);
      } else invalid.push(`FOR ${command.code}`);
    } else if (type === 'END-FOR' && IDENTIFIER.test(code)) {
      if (loops.at(-1)?.variable === code) loops.pop();
      else invalid.push(`END-FOR ${command.code}`);
    } else {
      invalid.push(type === 'INS' ? command.code : `${type} ${command.code}`);
    }
  }
  invalid.push(...loops.map((l) => `FOR ${l.variable} (thiếu END-FOR)`));
  if (invalid.length)
    throw new BadRequestException(
      `Mẫu có trường trộn không hợp lệ: ${[...new Set(invalid)].slice(0, 10).join(', ')}`,
    );
  return [...used].sort();
}
