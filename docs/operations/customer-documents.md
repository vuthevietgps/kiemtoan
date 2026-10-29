# Khách hàng, Excel và hồ sơ

Chức năng 02, đặc tả được người dùng duyệt ngày 15/10/2026: [đặc tả](../features/02-customers-documents.md), [bằng chứng kiểm chứng](../features/02-customers-acceptance.md).

## Migration và dữ liệu cũ

Sao lưu DB và upload trước khi triển khai; chạy thử trên bản sao theo [quy trình migration](database-migration.md). Sau cập nhật dependencies/schema, chạy Prisma generate, migrate deploy rồi build API/web theo README. Không sửa migration đã áp dụng.

Các migration mới: `20261015040000_customer_relationships`, `20261015050000_customer_import_batches`, `20261015060000_document_versions`, `20261015070000_customer_audit_metadata`.

- Liên hệ cũ được chuyển thành đầu mối chính; nếu chỉ có email/điện thoại thì dùng tên KH làm tên đầu mối để không mất thông tin. Một KH có tối đa một đầu mối chính đang hoạt động.
- Metadata file cũ thành v1, đường dẫn vật lý giữ nguyên, không di chuyển/ghi đè file. File cũ dạng TXT vẫn tải được; upload mới theo định dạng cho phép.
- `createdById` của KH cũ chưa biết giữ null; không gán người tạo giả. Tài khoản/nhóm và khoá mã hoá cũ giữ nguyên. Seed demo đã đồng bộ đầu mối chính và không tạo trùng khi chạy lại; chỉ dùng seed trên DB demo riêng.
- API danh sách hồ sơ chuyển sang `{items,total,page,pageSize}`. Client tích hợp cũ cần cập nhật; tải file cũ qua endpoint download vẫn được hỗ trợ.

## Khách hàng và phân công

Giám đốc/trưởng nhóm có quyền tạo/sửa KH và liên hệ; trưởng nhóm chỉ chọn người đang hoạt động trong nhóm. Owner là đầu mối chịu trách nhiệm, danh sách phân công là nhân sự cùng xử lý. Gỡ phân công không tự gỡ owner hoặc phân công HĐ/việc; người đó có thể vẫn thấy KH nếu còn một căn cứ khác. Nhân viên chỉ xem và xử lý trong quyền 01, không tự phân công.

Thêm liên hệ trong tab Liên hệ và phân công; chọn đầu mối chính để cập nhật phần tóm tắt Thông tin. Xoá đầu mối chính để trống phần tóm tắt; không tự chọn người khác. Xoá KH/hồ sơ là xoá mềm, giữ dữ liệu cho bàn giao.

## Nhập và xuất Excel

1. Ở Khách hàng, chọn Nhập khách hàng từ Excel → Tải mẫu Excel. Giữ tên cột/sheet, điền dữ liệu vào `Khach hang`. Sheet hướng dẫn ghi giá trị kỳ thuế/trạng thái hợp lệ. MST/điện thoại phải định dạng text để giữ số 0 đầu; không dùng công thức/link ngoài/macro.
2. Chọn file XLSX tối đa 5 MB, 2.000 dòng. Xem số dòng hợp lệ/lỗi, lỗi từng dòng. File sai cấu trúc, ô MST/điện thoại là số hoặc nội dung nén vượt giới hạn bị từ chối; không ghi KH khi xem trước.
3. Sửa dòng lỗi rồi xem trước lại, hoặc chọn rõ đồng ý nhập các dòng hợp lệ. Chỉ khi bấm Xác nhận mới ghi dữ liệu. Không cập nhật KH cũ dựa MST; MST đã xoá mềm vẫn được giữ duy nhất.
4. Bản xem trước gắn người tạo, hết hạn 30 phút và dùng một lần. Nếu dữ liệu/quyền thay đổi, xem trước lại; không nhập nửa chừng khi xác nhận bị xung đột. Không tự gửi lại yêu cầu xác nhận liên tục khi mạng lỗi: kiểm tra danh sách/MST trước.

Email người phụ trách để trống thì giao người nhập; email được điền phải tồn tại, đang hoạt động và trong phạm vi quản lý. Không thay owner sai thành người nhập một cách ngầm định.

Xuất Excel áp bộ lọc tên/MST/liên hệ, trạng thái, người phụ trách và scope; tối đa 10.000 KH/lần, vượt giới hạn phải thu hẹp bộ lọc. Không xuất mật khẩu/tài chính ngoài quyền. Dữ liệu text không thành công thức Excel.

## Hồ sơ và phiên bản

- Chọn nhóm, kỳ/HĐ/ghi chú rồi tải file. Cho PDF, PNG/JPEG, DOCX/XLSX/PPTX không macro/nhúng OLE, tối đa 20 MB; kiểm tra đuôi và dấu hiệu nội dung, tên lưu do server sinh. HĐ phải thuộc KH.
- Chọn Tải phiên bản mới để bổ sung vào cùng hồ sơ; bản cũ vẫn trong Lịch sử, số phiên bản cấp tuần tự cả khi có nhiều lượt tải đồng thời. Xoá hồ sơ ẩn toàn bộ lịch sử; không xoá file vật lý trong bước này.
- Tìm tên file/ghi chú, lọc nhóm/kỳ/HĐ và phân trang. Lịch sử có tải từng bản; preview PDF/PNG/JPEG qua API có xác thực. Office tải về, không có preview Word/Excel.
- PDF được dựng bằng PDF.js tải khi cần; worker/font/CMap/WASM phục vụ từ assets cùng ứng dụng, không gửi tài liệu tới dịch vụ ngoài. Nginx có location riêng trả MIME JavaScript cho worker `.mjs`, thiếu file trả 404. Khi triển khai phải giữ các assets đi cùng web build.
- Tài liệu bằng chứng hiện có vẫn tải được; phiên bản gốc được bảo toàn khi bổ sung bản mới. Không thay quy trình hồ sơ bắt buộc/soát xét của 03/05 bằng upload file.

Kiểm chứng hiện dùng dữ liệu giả. Chưa có Excel thật để mapping/đối soát/chuyển đổi (QD08), chưa mở portal khách ngoài (QD00), chưa triển khai cloud hoặc UAT thật.
