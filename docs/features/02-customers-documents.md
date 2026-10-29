# 02 — Khách hàng và kho hồ sơ

Ngày 15/10/2026. **Đã được người dùng duyệt trong chat: “Duyệt đặc tả 02 và phạm vi helper scope”.** Căn cứ YC04/05 và các điểm nối YC06–20 trong [phạm vi](../requirements/scope-and-traceability.md); C4/C7/C23, PL1; [kế hoạch](../planning/completion-plan.md). [Đặc tả demo cũ](02-customers.md) chỉ dùng đối chiếu. Quyền kế thừa [ma trận 01 đã chốt](01-users-access-control.md).

## Phạm vi

Chỉ customers/documents, giao diện customers, schema và migration tương ứng, test. Hoàn thiện thông tin/liên hệ/phân công, nhập/xuất Excel, hồ sơ nhóm/phiên bản/tìm/preview, KH360 nối dữ liệu đã có. Không sửa quy trình/hợp đồng/thu tiền/hoá đơn/kho bí mật; nếu phát sinh sửa module khác phải xin phạm vi cụ thể.

QD00 về portal vẫn mở: gói này làm hồ sơ nội bộ; không tạo tài khoản khách hàng ngoài. QD08 chưa có Excel thật: cung cấp mẫu chuẩn và thử dữ liệu giả; không tự kết luận chuyển đổi dữ liệu thật đã đạt.

## 02-A — Thông tin, liên hệ và phân công

- Giữ mã số thuế duy nhất gồm 10 số hoặc 10 số + `-xxx`; tên, địa chỉ, đại diện pháp luật, loại hình, kỳ thuế, trạng thái và ghi chú. Chuẩn hoá khoảng trắng, giới hạn độ dài; MST trùng kể cả đã xoá trả 409. MST theo định danh nguồn hiện có; khi có yêu cầu định danh khác phải thay đổi đặc tả.
- Nhiều người liên hệ: họ tên, chức danh/bộ phận, điện thoại, email, ghi chú, đánh dấu đầu mối chính. Tối đa một đầu mối chính đang hoạt động. Liên hệ cũ chuyển thành đầu mối chính, giữ thông tin cũ trong migration.
- Giữ một owner chịu trách nhiệm; thêm danh sách nhân sự phụ trách khách hàng với ngày giao, người giao và ghi chú. Nhân sự phải đang hoạt động/chưa nghỉ việc. Trưởng nhóm chỉ chọn người trong nhóm, không tự giao sang nhóm khác để mở rộng quyền. Giám đốc phân công toàn công ty.
- Nhân viên thấy KH owner/hợp đồng/dịch vụ/việc hoặc được phân công trực tiếp; không tự sửa phân công. Ngoài phạm vi trả 404, options và danh sách đều cùng scope. Thay đổi owner/phân công có audit trước–sau, không tự di chuyển HĐ/việc.
- Xoá mềm KH giữ liên hệ/hồ sơ/lịch sử nhưng chặn truy cập thông qua KH đã xoá. Không xoá vật lý file.

## 02-B — Nhập và xuất Excel

- Tải mẫu XLSX gồm hướng dẫn và các cột chuẩn: tên, MST, địa chỉ, đại diện, loại hình, kỳ thuế, trạng thái, liên hệ chính, điện thoại, email, email người phụ trách, ghi chú. MST/điện thoại là text để giữ số 0 đầu.
- Hai bước bắt buộc: upload → xem trước/lỗi theo dòng → xác nhận nhập. Chưa xác nhận không ghi khách hàng. Không tự cập nhật bản ghi cũ theo MST.
- Chỉ nhận XLSX, tối đa 5 MB/2.000 dòng dữ liệu mỗi lần; giới hạn giải nén/kích thước worksheet, từ chối macro, ô công thức và link ngoài. Không chạy nội dung trong workbook. Mẫu dữ liệu lớn hơn chia lô hoặc cập nhật giới hạn sau khi đo.
- Validate trường như form, enum và email; trùng trong file, DB và KH đã xoá; owner ngoài phạm vi/ngừng hoạt động đều báo lỗi dòng. Không tự chuyển owner không hợp lệ về người tạo.
- Xác nhận chỉ nhập dòng hợp lệ đã hiển thị; UI cho biết số dòng hợp lệ/bị loại và yêu cầu chọn rõ nhập các dòng hợp lệ. Kiểm tra lại DB/quyền khi xác nhận; có thay đổi hoặc xung đột mới thì không ghi nửa chừng, yêu cầu xem trước lại. Mỗi phiếu xem trước gắn người dùng, thời hạn 30 phút; một lần xác nhận, chống submit/retry trùng.
- Xuất XLSX theo bộ lọc và scope, tối đa 10.000 KH; vượt giới hạn yêu cầu thu hẹp bộ lọc. Không xuất bí mật hoặc tiền ngoài quyền; ô text không thành công thức. Có audit import/export, số dòng và lỗi tổng quát, không ghi toàn bộ liên hệ nhạy cảm vào log.

## 02-C — Kho hồ sơ

- Nhóm hồ sơ pháp lý/HĐ/dịch vụ/bằng chứng/khác; lọc theo nhóm, tên file, kỳ, HĐ; phân trang server. Không tự thay tài liệu yêu cầu của workflow 03/05 bằng danh sách file đã upload.
- Một hồ sơ có chuỗi phiên bản: tải lần đầu v1, tải phiên bản mới giữ bản cũ; số phiên bản cấp nguyên tử, không ghi đè file. Xem lịch sử và tải từng bản trong cùng scope. File cũ được coi là v1, không chuyển/mất file đang lưu.
- Nhập nhóm/kỳ/HĐ/ghi chú; HĐ phải thuộc đúng KH và chưa xoá. Bằng chứng hiện có vẫn tải được, không sửa hành vi sinh việc/duyệt việc ở 05.
- Giới hạn 20 MB/file; kiểm tra loại file và nội dung phù hợp. Cho PDF, ảnh PNG/JPEG và Office phổ biến không macro; không cho HTML/SVG/script/executable. Tên lưu do server sinh, tên gốc chỉ để hiển thị. Khi ghi DB thất bại phải dọn file vừa lưu an toàn.
- Preview chỉ PDF/PNG/JPEG, tải có kiểm tra quyền rồi trả blob; không nhúng HTML/SVG hoặc URL file công khai. Office tải về, không tuyên bố có preview Word/Excel. Header chống sniff, tên file an toàn. Preview/download có audit.
- Xoá mềm cả hồ sơ theo quyền documents:delete; lịch sử file vẫn giữ cho quản trị/khôi phục theo chính sách vận hành, không có endpoint xem xuyên scope. Không thêm nút khôi phục/xoá vĩnh viễn trong gói này.

## 02-D — Khách hàng 360 và giao diện

- Danh sách tìm tên/MST/liên hệ, lọc trạng thái/người phụ trách, phân trang; form và phần liên hệ/phân công có kiểm tra lỗi tiếng Việt.
- Chi tiết KH: thông tin, liên hệ, nhân sự phụ trách, HĐ hiện có và kho hồ sơ. Hiển thị công việc đang mở/hạn gần nhất và đường dẫn tới màn hình hiện có khi có quyền; số liệu vẫn cùng scope. Không tự triển khai vòng đời thu/hoá đơn mới hoặc tính lại công nợ.
- Chỉ hiện tab/nút/trường theo quyền server 01; nhân viên không thấy tiền, admin không có dữ liệu nghiệp vụ. Trang lỗi phân biệt tải thất bại với không tìm thấy; có thử lại, trạng thái tải và ngăn submit lặp.
- Store/API ở data-access; component trình bày chỉ input/output; chuỗi UI trong file ngôn ngữ; dùng được từ 375px, bảng có cuộn ngang.

## Dữ liệu và phân kỳ triển khai

1. Chốt đặc tả → 02-A schema/migration/liên hệ/phân công + API/UI/test.
2. 02-B import/export và mẫu XLSX + thử lỗi/trùng/retry.
3. 02-C metadata/phiên bản/search/preview + migration/file/scope/test.
4. 02-D hoàn thiện KH360, test hồi quy, demo và biên bản nghiệm thu toàn 02.

Các phần A–D thuộc cùng chức năng 02, làm lần lượt. Migration chỉ thêm bảng/cột có dữ liệu mặc định phù hợp; không sửa baseline hoặc migration 01. Cần helper scope chung nhận phân công trực tiếp; xin phép phạm vi core trước khi sửa. Không sửa test chỉ để pass.

## Tiêu chí nghiệm thu

- CRUD/liên hệ/phân công đúng scope, role, validation và audit; trưởng nhóm không chọn người ngoài nhóm; nhân viên ngoài KH 404; owner ngừng hoạt động bị từ chối.
- Mẫu XLSX mở đúng; preview không ghi DB, lỗi chính xác dòng/cột; MST giữ 0 đầu; trùng/xung đột/retry không tạo bản ghi sai hoặc nhập một phần ngoài lựa chọn xác nhận; export đúng lọc/scope.
- File sai loại/size/tên đường dẫn bị từ chối; ghi DB lỗi không để file mồ côi; phiên bản đồng thời không trùng; bản cũ/tài liệu bằng chứng vẫn tải được; preview/download/delete ngoài scope bị chặn và có audit phù hợp.
- Migration trên DB trống và bản sao có KH/liên hệ/file cũ giữ dữ liệu. Unit/e2e và test UI quan trọng đạt; lint/build/max-lines đạt; mọi cảnh báo báo thật.
- Kiểm tra desktop/375px luồng tạo KH → liên hệ/phân công → import xem trước/xác nhận → upload v1/v2 → tìm/preview/tải. Không ghi đã chuyển đổi Excel thật hoặc mở portal khi chưa có đầu vào/quyết định.

## Bằng chứng triển khai và quyền tích hợp

Sau khi duyệt đặc tả, người dùng tiếp tục cho phép các điểm core/storage, guard/interceptor liên quan hồ sơ và location PDF worker trong Nginx. Đã thực hiện A–D và kiểm chứng kỹ thuật; [biên bản](02-customers-acceptance.md), [hướng dẫn](../operations/customer-documents.md). Chờ nghiệm thu người dùng, chưa ghi đã merge/UAT thật; QD00/08 vẫn mở.
