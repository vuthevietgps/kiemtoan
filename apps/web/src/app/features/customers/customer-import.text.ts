export const IMPORT_TEXT = {
  title: 'Nhập khách hàng từ Excel', template: 'Tải mẫu Excel', choose: 'Chọn file XLSX để xem trước',
  export: 'Xuất Excel', confirm: 'Xác nhận nhập các dòng hợp lệ', close: 'Đóng', row: 'Dòng',
  name: 'Tên khách hàng', taxCode: 'Mã số thuế', owner: 'Email phụ trách', errors: 'Lỗi cần sửa', valid: 'Hợp lệ',
  warning: 'Chỉ các dòng hợp lệ bên dưới được nhập. Dòng lỗi bị loại; sửa file rồi xem trước lại để nhập các dòng đó. Không cập nhật khách hàng cũ.',
  approve: 'Tôi đã kiểm tra và đồng ý nhập các dòng hợp lệ', validCount: 'Dòng hợp lệ', invalidCount: 'Dòng lỗi',
  expires: 'Bản xem trước có hiệu lực 30 phút, chỉ xác nhận một lần.', invalidFile: 'Chỉ nhận XLSX tối đa 5 MB và 2.000 dòng.',
  success: 'Đã nhập khách hàng', view: 'Xem trước',
} as const;
