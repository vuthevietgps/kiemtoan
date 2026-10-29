# Đối chiếu hiện trạng với tài liệu mô tả chức năng

> Báo cáo lịch sử ngày 14/10/2026. Xem [phạm vi cập nhật](../../requirements/scope-and-traceability.md) và [hiện trạng](../../planning/current-status.md). Các nhận định chờ câu trả lời dưới đây chưa bao gồm DOCX bổ sung ngày 15/10.

Ngày rà soát: **14/10/2026**.

Nguồn yêu cầu: [PDF gốc, 21 trang](<C:/Users/PC/Downloads/Tài liệu mô tả chức năng – Phần mềm quản lý công ty dịch vụ Kế toán & Kiểm toán.pdf>).
Số trang bên dưới là số trang hiển thị trong PDF.

Phạm vi rà soát: schema Prisma, API/controller/service, route và màn hình Angular, test hiện có,
cấu hình dự án và các đặc tả rút gọn trong `docs/features/`.
Đây là báo cáo đối chiếu; **không sửa code nghiệp vụ, không thay đổi database, không commit/push**.

## 1. Kết luận hiện trạng

**Sản phẩm hiện là bản demo có nhiều luồng nghiệp vụ chính, chưa phải bản hoàn chỉnh theo PDF.**

Đã có đăng nhập, năm vai trò mặc định, khách hàng, kho tài liệu cơ bản, danh mục dịch vụ,
hợp đồng nhiều dòng dịch vụ, duyệt hợp đồng và sinh việc lần đầu, cập nhật công việc kèm bằng chứng,
lịch công việc tháng, phiếu thu/công nợ, sổ hoá đơn nội bộ, Dashboard và bốn báo cáo.

Khoảng thiếu lớn nằm ở **bảo mật và phân quyền hoàn chỉnh, sinh việc theo từng kỳ, deadline pháp lý,
nhắc việc tự động, duyệt phiếu thu, mẫu in/xuất Word–PDF–Excel và cài đặt**.
Có cả sai khác hành vi và số liệu cần sửa, không chỉ những màn hình chưa làm.

Không quy đổi thành phần trăm hoàn thành: chưa có danh sách tiêu chí nghiệm thu được chốt và trọng số
khối lượng; đếm số menu sẽ đánh giá quá cao tiến độ.

Các tài liệu trong `docs/features/` mô tả phạm vi demo hẹp hơn PDF. Ví dụ: người dùng được tạo bằng mật khẩu
do quản trị nhập, báo cáo xuất CSV, lịch chỉ hiển thị công việc, thông báo chỉ cho việc được giao.
**Không coi những phần rút gọn này là thay đổi yêu cầu đã được chủ đầu tư duyệt.**

Quy ước trong báo cáo:

- **Có cơ bản**: thấy luồng chính trong code/API/UI; vẫn có thể thiếu phần yêu cầu bổ sung.
- **Một phần**: đã có một số khả năng nhưng thiếu nghiệp vụ quan trọng.
- **Chưa thấy**: không tìm thấy model/API/UI hoặc cơ chế xử lý tương ứng trong workspace đã rà soát.
- **Chưa kiểm chứng**: cần kiểm thử thực tế, đo đạc hoặc xác nhận nghiệp vụ thêm.

## 2. Các sai khác cần ưu tiên

### P1 — Hai màn hình tính số tiền quá hạn khác nhau

PDF mục 4.4 và 5.1, trang 8–9 yêu cầu công nợ nhất quán theo hợp đồng/khách hàng.

Đã chạy trực tiếp hai hàm nghiệp vụ với dữ liệu giả, không dùng database:

| Dữ liệu tại ngày 14/10/2026 | Giá trị |
| --- | --- |
| Đợt A, hạn 01/10/2026, chưa thu | 1.000.000 đ |
| Đợt B, hạn 01/12/2026 | 1.000.000 đ |
| Phiếu thu được gắn rõ vào đợt B | 1.000.000 đ |
| Số quá hạn từ hàm dùng cho Thu tiền/Công nợ | **1.000.000 đ** |
| Số quá hạn từ hàm dùng cho Báo cáo/Công nợ | **0 đ** |

Nguyên nhân: [Thu tiền phân bổ theo đợt](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/payments/receivables.util.ts:30>),
còn [Báo cáo trừ tổng đã thu khỏi tổng đợt quá hạn](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/reports/utils/report-grouping.util.ts:133>),
không giữ thông tin phiếu thu thuộc đợt nào.
Cần thống nhất quy tắc và dùng chung phép tính trước khi nghiệm thu tài chính.

### P1 — Phạm vi quyền người dùng/báo cáo rộng hơn ma trận đề xuất

PDF mục 2, trang 2–3 và mục 6.2, trang 11:

- Trưởng nhóm chỉ xem thành viên nhóm. Hiện [API danh sách và chi tiết người dùng](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/users/users.service.ts:36>)
  không nhận người đang đăng nhập và không lọc `teamId`; quyền `users:view` của MANAGER mở được dữ liệu toàn hệ thống.
- Kế toán thu tiền được đề xuất xem doanh thu/công nợ. Hiện CASHIER có `reports:view` và
  [cả bốn báo cáo cùng dùng quyền này](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/reports/reports.controller.ts:35>),
  gồm tuân thủ deadline và hiệu suất nhân viên. `staffPerformance()` dùng phạm vi ALL của CASHIER.
- DIRECTOR đang được cấp `*`, bao gồm tạo/sửa/khoá tài khoản và thay đổi vai trò trực tiếp;
  ma trận PDF đề xuất giám đốc xem/duyệt vai trò, còn quản trị hệ thống quản lý tài khoản.

Đây là kết luận từ đường đi controller/service và ma trận quyền, chưa chạy thử qua HTTP trong lượt rà soát này.
Ma trận PDF tự ghi là đề xuất chờ xác nhận: cần chốt trước khi sửa.

### P1 — Chưa có kiểm soát dữ liệu tài chính theo trường

PDF mục 6.2, trang 11 yêu cầu ẩn giá trị hợp đồng/doanh thu với vai trò không liên quan.
Hiện [API chi tiết hợp đồng](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/contracts/contracts-query.service.ts:103>)
trả tổng tiền, danh sách phiếu thu, hoá đơn và số đã thu cho mọi người có `contracts:view` trong phạm vi hợp đồng,
không có điều kiện lọc trường theo quyền tài chính. Test hiện có còn kiểm tra nhân viên nhận được phần thanh toán này.
Dashboard cũng trả số liệu thanh toán trong response, dù giao diện có ẩn biểu đồ với người thiếu `payments:view`.

Cần xác nhận vai trò nào được xem trường nào, rồi kiểm soát ở API; việc ẩn tab/nút chưa đủ.
Không kết luận rằng mọi giá trị tài chính đều phải ẩn với nhân viên: chính sách chi tiết còn chờ câu 21.

### P1 — Chưa có bước duyệt phiếu thu

PDF mục 4.4, trang 8 yêu cầu phiếu thu được duyệt trước khi tính vào số đã thu.
Hiện model Payment không có trạng thái duyệt, người duyệt hay thời điểm duyệt; API chỉ có tạo/xem/xoá mềm.
[Tạo phiếu thu](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/payments/payments.service.ts:87>)
được đưa ngay vào các phép cộng số đã thu.

Ngoài ra, trang 8 nói kế toán trưởng hoặc giám đốc duyệt, trong khi ma trận trang 3 chỉ ghi quyền duyệt ở giám đốc.
Cần chốt người duyệt; việc chưa có luồng duyệt là khoảng thiếu rõ ràng ở cả hai cách hiểu.

### P1 — Bảo mật tài khoản mới ở mức demo

PDF mục 6.1–6.3 và 8, trang 11–13 yêu cầu lời mời email, tự đặt/khôi phục mật khẩu,
2FA cho vai trò xem mật khẩu khách hàng, khoá tạm sau nhiều lần đăng nhập sai, quản lý phiên và refresh token.
Hiện có bcrypt, JWT hết hạn, chặn tài khoản bị khoá; **chưa thấy các cơ chế còn lại**.
Quản trị hiện nhập mật khẩu ban đầu và có thể đặt lại trực tiếp, khác mô hình lời mời trong PDF.

### P2 — Chọn kỳ Dashboard chưa áp dụng cho mọi khối

PDF mục 3.1, trang 4 ghi mọi số liệu cập nhật theo kỳ.
Trong [DashboardService.overview](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/dashboard/dashboard.service.ts:57>),
chỉ KPI/biểu đồ nhận `period`; hợp đồng gần đây và công việc/nhắc việc không nhận khoảng ngày đó.
Người dùng đổi kỳ vẫn thấy các danh sách lấy theo thời điểm hiện tại hoặc toàn bộ thời gian.

### P2 — Sao chép mật khẩu chưa được ghi log riêng

PDF mục 5.2, trang 10 yêu cầu mỗi lần xem hoặc sao chép đều có nhật ký.
API `reveal()` đã ghi `VIEW_SECRET`. Nhưng [nút sao chép](<C:/Users/PC/Documents/code/kiểm toán/apps/web/src/app/features/client-credentials/components/credential-table/credential-table.component.ts:165>)
chỉ ghi clipboard, không gọi API audit. Nhiều lần sao chép sau một lần xem chỉ có log của lần xem.

## 3. Đối chiếu từng nhóm chức năng

### 3.1 Tổng quan — PDF mục 3.1, trang 4

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Chọn kỳ, 5 KPI và so sánh kỳ trước | Có cơ bản | Chưa có chọn nhanh tháng/quý/năm; giới hạn áp dụng kỳ như P2 ở trên |
| Biểu đồ doanh thu, tình trạng dịch vụ, thanh toán | Có cơ bản | Chưa có bấm cột để mở danh sách HĐ theo loại dịch vụ |
| Hợp đồng gần đây và công việc 3 trạng thái | Có | Giới hạn 5 dòng; không đồng nghĩa hoàn thành toàn bộ các khối ở màn mẫu |
| Nhắc việc, lịch báo cáo, tình trạng tài khoản KH | Một phần | Có danh sách task gần hạn; chưa có trạng thái nộp báo cáo pháp lý hay khối kết nối tài khoản KH |
| Nội dung khác nhau theo vai trò | Một phần | Có scope dữ liệu và một số điều kiện UI; chưa có chính sách trường/nhóm báo cáo đầy đủ |

### 3.2 Khách hàng — PDF mục 3.2, trang 4–5

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Tên, MST, địa chỉ, đại diện, loại hình | Có | Chưa có ngành nghề, ngày thành lập, năm tài chính |
| Thông tin thuế/kế toán | Một phần | Có kỳ khai tháng/quý; thiếu phương pháp thuế, chế độ kế toán, cơ quan thuế |
| Nhiều người liên hệ, chức vụ, email, Zalo | Một phần | Chỉ có một bộ tên/điện thoại/email liên hệ; chưa có bảng nhiều liên hệ/chức vụ/Zalo |
| Trạng thái KH, nhóm, nguồn | Một phần | Có bốn trạng thái; thiếu nhóm và nguồn khách hàng |
| Phân công trưởng nhóm và nhân viên chính | Một phần | KH có một `ownerId`; nhóm suy ra từ người phụ trách; HĐ/dịch vụ có người riêng |
| Trang 360° | Một phần | Có thông tin, HĐ, tài liệu, tài khoản đăng nhập; chưa tập hợp đầy đủ dịch vụ/việc/công nợ/hoá đơn/lịch sử trao đổi |
| Tra MST tự điền, nhập/xuất Excel | Chưa thấy | Chặn trùng MST đã có |

### 3.3 Kho hồ sơ — PDF mục 3.2, trang 5

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Nhóm pháp lý/HĐ/dịch vụ/bằng chứng | Có cơ bản | Là nhóm loại tài liệu và liên kết HĐ/kỳ, chưa là cây thư mục theo từng HĐ/dịch vụ/kỳ như mô tả |
| Bằng chứng tự liên kết vào hồ sơ KH | Có | Có customerId/contractId/taskId/period và người tải |
| Tải nhiều file | Có qua bộ chọn nhiều file | Chưa có vùng kéo thả chuyên dụng |
| Xem trước PDF/ảnh, tìm tên, phiên bản khi tải đè | Chưa thấy luồng hoàn chỉnh | Có link mở/tải file; không có UI preview nội bộ, tìm tên hay chuỗi phiên bản/khôi phục |
| Phân quyền và xoá mềm | Có cơ bản | Kế thừa scope KH; lưu file hiện trên ổ đĩa local |

### 3.4 Hợp đồng — PDF mục 3.3, trang 5–6

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Mã tự sinh, nhiều dịch vụ, VAT, ngày và đợt thanh toán | Có | Form tạo/sửa đã được sửa thêm ở lượt trước |
| Gửi duyệt, duyệt, trạng thái thực hiện, thanh lý/huỷ | Có cơ bản | Chưa có hồ sơ biên bản thanh lý/mẫu in tương ứng |
| Trạng thái thu tiền, tiến độ công việc | Có | Cần giải quyết bước duyệt phiếu thu và chính sách trường tài chính |
| Duyệt HĐ sinh công việc | Có lần đầu | Không tự sinh lặp các kỳ tiếp theo |
| Mẫu Word, xuất Word/PDF, phụ lục, thanh lý | Chưa thấy | Đây là chức năng trong phạm vi mô tả; mẫu Word cụ thể còn chờ câu 8 |
| Scan HĐ đã ký | Một phần | Upload qua kho hồ sơ KH, có gắn HĐ; chưa có luồng đính kèm riêng ngay trang HĐ |
| Cảnh báo hết hạn, sao chép để gia hạn/tái ký | Chưa thấy | Chưa có scheduler/endpoint/UI tương ứng |

### 3.5 Dịch vụ và bảng giá — PDF mục 3.4, trang 6

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Danh mục thêm/sửa/tắt, chu kỳ phí | Có | Có seed sáu loại dịch vụ và giá chuẩn |
| Giá theo quy mô/số chứng từ | Chưa thấy | Mỗi loại dịch vụ chỉ có một `defaultPrice` |
| Checklist, vai trò mặc định, thời gian dự kiến | Một phần | Có tên, thứ tự, ngày lệch cuối kỳ, bắt buộc bằng chứng; chưa có vai trò mặc định/thời lượng/loại bằng chứng gợi ý |
| Tiến độ theo dòng dịch vụ của HĐ | Có | Đồng bộ từ trạng thái các task |

### 3.6 Công việc và tiến độ — PDF mục 4.1–4.2, trang 6–8

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Sinh việc KH × dịch vụ × từng kỳ | Một phần | Chỉ sinh khi duyệt HĐ; dòng đã có task được bỏ qua. Chưa có lịch sinh tháng/quý/năm suốt thời hạn HĐ |
| Thêm việc phát sinh | Có cho quản lý | STAFF chưa có `tasks:create`; mục 4.1 ghi nhân viên cũng thêm được, cần chốt với ma trận mục 2 |
| 3 trạng thái, cờ quá hạn, file bằng chứng bắt buộc | Có | Có kiểm tra ở backend, không chỉ ở UI |
| Lịch sử, duyệt/trả lại | Một phần | Có người/thời gian và log trạng thái/duyệt; chưa có nhận xét gắn riêng lần trả lại và cấu hình bật/tắt bước duyệt |
| Tiến độ từ việc lên dịch vụ/HĐ/KH | Một phần | Có lên dịch vụ/HĐ; KH mới có số việc chưa xong, chưa có tổng hợp % đầy đủ |
| Lọc KH, HĐ, dịch vụ, kỳ, người làm, nhóm/chi nhánh | Một phần | API có HĐ/dòng dịch vụ/kỳ; UI chưa có đủ các bộ chọn đó; chưa có nhóm/chi nhánh như yêu cầu |
| Đếm nhanh, bảng, Kanban, theo KH, khối lượng nhân viên | Có cơ bản | Kanban chuyển bằng nút; nút đã đáp ứng lựa chọn “nút hoặc kéo thả”, không coi thiếu kéo thả là thiếu luồng trạng thái |
| Cập nhật/giao việc hàng loạt, lưu bộ lọc, Gantt | Chưa thấy | Hiện thao tác từng việc |
| Bình luận, @nhắc tên, bàn giao nghỉ phép/nghỉ việc | Chưa thấy luồng hoàn chỉnh | Có đổi người làm từng việc, chưa có bàn giao hàng loạt hoặc trao đổi trong việc |

### 3.7 Lịch và nhắc việc — PDF mục 4.2–4.3, trang 8

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Lịch tháng/tuần gộp việc và deadline pháp lý | Một phần | Có lịch tháng của Task bằng NG-ZORRO; chưa có tuần và lịch pháp lý riêng |
| Bộ lịch pháp lý chỉnh sửa được | Chưa thấy | Không có model/module cấu hình quy tắc hạn pháp lý |
| Sinh hạn theo kỳ khai/năm tài chính, tránh ngày lễ | Chưa thấy | Ngày task chỉ tính cuối kỳ + offset; KH chưa có năm tài chính |
| Báo cáo chưa đến/đang chuẩn bị/đã nộp/trễ, biên nhận | Chưa thấy nghiệp vụ riêng | Trạng thái Task 3 bước không thay thế trạng thái báo cáo pháp lý |
| Nhắc trước N ngày/đến hạn/quá hạn, báo quản lý, bản tin sáng | Chưa thấy | Khối nhắc trên Dashboard chỉ là truy vấn hiển thị, chưa phải bộ máy gửi thông báo tự động |
| Thông báo giao việc, đánh dấu đã đọc | Có | Chuông polling 60 giây; backend mới nghe `TASK_ASSIGNED` |
| Email nhắc việc | Chưa thấy | Chưa có SMTP/scheduler; Zalo và đồng bộ Google/Outlook được tài liệu đánh dấu tuỳ chọn |

### 3.8 Thu tiền và công nợ — PDF mục 4.4, trang 8

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Đợt thu từ HĐ, phiếu thu một phần, tiền mặt/chuyển khoản | Có cơ bản | Chưa có ảnh chứng từ phiếu thu và danh sách nhắc thu sắp hạn hoàn chỉnh |
| Duyệt trước khi tính đã thu | Chưa có | Sai khác P1 ở mục 2 |
| Công nợ/tuổi nợ theo HĐ và KH | Một phần | Có theo HĐ và báo cáo gom KH; hai cách tính quá hạn chưa nhất quán |
| Đề nghị thanh toán PDF, VietQR, email nhắc nợ | Chưa thấy | Không chỉ là phần tích hợp ngân hàng tự động |
| Nhập sao kê và tự đối soát | Chưa thấy; giai đoạn sau | Không đưa vào điều kiện bắt buộc của demo nếu chưa chọn làm |

### 3.9 Hoá đơn — PDF mục 4.5, trang 9

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Đề nghị xuất và sổ hoá đơn | Có cơ bản | Đề nghị từ HĐ, chưa từ đợt thu |
| Phát hành, điều chỉnh, thay thế, huỷ, PDF/XML | Một phần | Chỉ REQUESTED/ISSUED/CANCELLED; “phát hành” hiện là nhập số/ký hiệu/ngày và cập nhật sổ nội bộ |
| Đối chiếu đã thu chưa xuất/đã xuất chưa thu | Chưa thấy báo cáo/chức năng riêng | Trang HĐ có số liệu nhưng chưa thay thế bảng đối chiếu |
| Phát hành qua API nhà cung cấp | Chưa thấy; giai đoạn sau | Không coi đây là yêu cầu đã chốt cho bản đầu |

### 3.10 Báo cáo — PDF mục 5.1, trang 9

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Doanh thu theo kỳ/dịch vụ/KH/người phụ trách | Có cơ bản | Chưa có so sánh cùng kỳ trên báo cáo |
| Công nợ, tuân thủ deadline, hiệu suất | Một phần | Công nợ là hiện tại, không có snapshot theo kỳ; tuân thủ task theo tháng/nhân viên, chưa theo KH và báo cáo nộp pháp lý |
| Báo cáo hợp đồng, khách hàng, hoá đơn | Chưa thấy | Thiếu thống kê tái ký, giữ chân và đối chiếu hoá đơn/thu tiền |
| Xuất Excel/PDF | Chưa có đúng định dạng | Hiện xuất CSV; CSV mở được bằng Excel nhưng không phải file XLSX hay PDF theo mô tả |
| Lưu bộ lọc, gửi email định kỳ | Chưa thấy | Chưa có cơ chế lịch gửi/lưu cấu hình |

### 3.11 Tài khoản công ty khách hàng — PDF mục 5.2, trang 10

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Kho tài khoản theo loại/KH, trạng thái cập nhật tay | Có | Phù hợp phương án bản đầu của PDF |
| AES-256, chỉ xem mật khẩu khi có quyền, log xem | Có cơ bản | Dùng AES-256-GCM, khoá cấu hình tách khỏi bản ghi; chưa có 2FA và log sao chép |
| Chữ ký số: NCC, serial, hạn, người giữ, cảnh báo | Một phần | Có loại DIGITAL_SIGNATURE, nhãn và hạn, cảnh báo màu ≤30 ngày trên danh sách; thiếu trường NCC/serial/người giữ và cảnh báo chủ động |
| Lịch sử đổi mật khẩu và người cập nhật | Một phần | Có người cập nhật gần nhất và log thao tác; chưa có lịch sử chuyên biệt cho việc đổi mật khẩu |
| Tự đăng nhập/kiểm tra cổng bên ngoài | Chờ làm rõ | Không nên coi các trạng thái hiện tại là kết nối thật |

### 3.12 Cài đặt và tiện ích chung — PDF mục 5.3–5.4, trang 10

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Công ty/logo/MST/ngân hàng, mẫu in, quy tắc đánh số | Chưa thấy module cài đặt | Mã HĐ/PT và nhiều hằng số đang viết trong code |
| Danh mục dùng chung | Một phần | Có dịch vụ; các nhóm KH/nguồn/ngân hàng/loại tài khoản tuỳ chỉnh chưa có |
| Cấu hình nhắc việc, ngày lễ, SMTP/kết nối | Chưa thấy | Có tên quyền `settings` nhưng không có route/API/model thực thi |
| Tìm kiếm toàn cục | Chưa thấy | Chỉ có tìm kiếm riêng từng trang |
| Chuông các loại sự kiện | Một phần | Chỉ giao việc; chưa có sắp hạn/quá hạn/HĐ chờ duyệt/khoản thu mới |
| Bộ chọn kỳ chung trên thanh đầu | Chưa thấy | Dashboard và Báo cáo có bộ chọn riêng |
| Hồ sơ cá nhân, ảnh, đổi mật khẩu, tuỳ chọn thông báo | Một phần | Menu tài khoản hiện chỉ có đăng xuất |
| Responsive | Có CSS và bảng cuộn ngang | Chưa kiểm thử đủ ở 375px, tablet và bốn trình duyệt |
| Chọn doanh nghiệp | Chờ làm rõ | Câu 3 chưa được trả lời |

### 3.13 Người dùng, phân quyền, nhật ký — PDF mục 6, trang 11–12

| Yêu cầu | Hiện trạng | Còn thiếu / khác tài liệu |
| --- | --- | --- |
| Hồ sơ người dùng, nhóm, chi nhánh, quản lý, ngày vào làm | Một phần | Có họ tên/email/điện thoại/chức danh/nhóm; thiếu chi nhánh, quản lý trực tiếp, ngày vào làm, ảnh |
| Mời email/tự đặt mật khẩu/khôi phục | Chưa có | Hiện quản trị nhập mật khẩu ban đầu/đặt lại |
| Hoạt động/khoá/nghỉ việc và bàn giao | Một phần | Có active/lock; chưa có trạng thái nghỉ việc và quy trình bàn giao hàng loạt |
| 5 vai trò mặc định | Có | Vai trò là enum, quyền là hằng số trong code |
| Tạo vai trò, bảng tick quyền, phạm vi chi nhánh | Chưa có | Có scope ALL/TEAM/OWN/NONE cố định, không có cấu hình quyền qua UI |
| Cây phòng ban, duyệt cấp quyền cao | Chưa có | Team là danh sách phẳng; đổi vai trò trực tiếp |
| Chính sách mật khẩu, 2FA, khoá sai 5 lần, quản lý phiên | Một phần nhỏ | Bcrypt và mật khẩu tối thiểu 6 ký tự; JWT 8 giờ mặc định. Chưa có độ phức tạp/lịch sử/2FA/khoá do sai/refresh/thu hồi phiên |
| Nhật ký CRUD/duyệt/login/xem bí mật | Có cơ bản | Interceptor lưu method/path; chưa lưu diff trước–sau |
| Logout/export/đổi quyền, xuất Excel nhật ký | Một phần hoặc chưa có | Logout chỉ xoá token phía trình duyệt; GET xuất CSV không qua interceptor ghi thay đổi; chưa có xuất nhật ký |
| Không sửa/xoá nhật ký | Có ở bề mặt API | Chỉ thấy GET, chưa có bằng chứng cơ chế bất biến ở tầng DB/quyền DB |

## 4. Phi chức năng, kiến trúc và điều kiện bàn giao

Đối chiếu PDF mục 7–9, trang 12–17 và quy tắc code trong dự án:

| Hạng mục | Đánh giá |
| --- | --- |
| NestJS/Angular/PostgreSQL/Prisma, API v1, validation, lazy-load, OnPush/signals | Đã có nền tảng phù hợp |
| Tiền chính xác, UUID, quan hệ/index, xoá mềm | Có ở nhiều bảng nghiệp vụ; thiếu một số trường quy tắc như `created_by`; nhiều bảng danh mục chưa có xoá mềm |
| Lịch FullCalendar/Gantt | Hiện dùng NG-ZORRO calendar tháng, chưa có FullCalendar/Gantt theo công nghệ đề xuất |
| Redis/BullMQ và S3 | Chưa có; demo dùng event trong tiến trình và lưu file local, đúng ngoại lệ demo trong quy tắc nội bộ; chưa đủ vận hành đầy đủ theo PDF |
| Migration database | Chỉ thấy `schema/`, `seed/`; script hiện dùng `prisma db push`. Chưa thấy lịch sử migrations |
| Docker triển khai ứng dụng/Nginx/CI/CD | Compose hiện chỉ có PostgreSQL; chưa thấy Dockerfile app, Nginx hoặc workflow CI trong workspace |
| Git, nhánh, nghiệm thu/merge theo từng chức năng | Workspace chưa có `.git`; không xác nhận được quy trình hoặc các mốc đã nghiệm thu |
| Kiến trúc frontend theo store, chuỗi ngôn ngữ | Chưa thấy `*.store.ts`; nhiều page/component tự quản lý state/gọi API service, nhiều chuỗi tiếng Việt còn viết trực tiếp |
| Giới hạn dòng code | Đạt kiểm tra hiện tại: không file nào vượt 1.000 dòng |
| Lint | Chưa đạt: backend 25 lỗi/9 cảnh báo; frontend chưa có script lint |
| Coverage ≥70% cho tiền/phân quyền | Chưa đo/xác nhận trong lần này; số test pass không chứng minh đạt coverage |
| HTTPS, OWASP, bảo vệ dữ liệu/thời hạn lưu hồ sơ | Chưa có bằng chứng triển khai/kiểm thử đáp ứng để nghiệm thu |
| <2 giây/100 người đồng thời/5.000 KH/50.000 task/năm | Chưa kiểm thử tải; 50 nhân viên và 500 KH ở câu hỏi là dữ liệu quy mô, không phải kết quả benchmark |
| Backup hằng ngày/giữ 30 ngày/RPO 24 giờ/RTO 4 giờ/uptime 99,5% | Chưa thấy job backup, kiểm thử khôi phục hay số liệu theo dõi |
| Sentry, Prometheus/Grafana, giám sát vận hành | Chưa thấy tích hợp tương ứng |
| UAT, dữ liệu Excel cũ, đào tạo, tài liệu người dùng | Chưa có bằng chứng hoàn tất; README hiện chủ yếu hướng dẫn chạy demo |
| Bảo hành 3 tháng | Là cam kết bàn giao/hợp đồng, không thể xác nhận chỉ từ code |

## 5. Những điểm cần chủ đầu tư chốt

Đọc mục 10, trang 18–21: chỉ thấy câu 1 có **50** và câu 2 có **500**; không suy diễn 500 là số hợp đồng/năm
vì câu hỏi gộp cả khách hàng và hợp đồng. Các câu còn lại chưa có trả lời trong PDF.

Cần ưu tiên chốt trước khi triển khai sâu:

1. Một hay nhiều pháp nhân/chi nhánh; nội bộ hay SaaS — câu 3, 5.
2. Ma trận quyền/phạm vi/trường tài chính; ai duyệt phiếu thu; nhân viên có được tạo việc phát sinh — câu 13, 21, 22 và các điểm chưa thống nhất giữa các mục PDF.
3. Chỉ theo dõi kiểm toán hay cả hồ sơ kiểm toán chuyên môn — câu 11.
4. Hoá đơn công ty xuất hay cả hoá đơn đầu vào/đầu ra của KH — câu 14; code hiện theo phương án công ty xuất.
5. Tài khoản KH chỉ lưu an toàn hay đăng nhập cổng thật; quản lý người giữ token — câu 18, 19.
6. Mẫu hợp đồng/checklist, nhu cầu timesheet/hoa hồng, kênh nhắc, import dữ liệu — câu 4, 8–10, 12, 24.
7. Cổng KH, SSO/lịch, app riêng và tích hợp ngoài — câu 15–17, 23, 25, 29.
8. Môi trường vận hành, mốc đưa vào dùng, ngân sách và người duyệt — câu 26–28, 30.

Ngân hàng tự động, phát hành e-invoice qua nhà cung cấp, Zalo, cổng KH và app riêng được mô tả là
giai đoạn sau/tuỳ chọn. Chưa chọn làm thì không cộng chúng vào danh sách thiếu bắt buộc của bản đầu.
Ngược lại, lời mời tài khoản, 2FA cho vai trò xem bí mật, deadline pháp lý, duyệt thu và cài đặt nằm trong mô tả bản đầy đủ.

## 6. Kết quả kiểm tra và giới hạn bằng chứng

| Kiểm tra trong lượt đối chiếu này | Kết quả |
| --- | --- |
| Đọc PDF | Đã trích đọc 21 trang; xem hình các trang 2, 3, 9, 10, 11 để đối chiếu sơ đồ/ma trận/bảng |
| Unit backend | **13 suites, 71 tests passed** |
| Unit frontend | **1 file, 7 tests passed**; chỉ có bộ test form hợp đồng |
| ESLint backend không `--fix` | **25 lỗi, 9 cảnh báo**, exit 1 |
| Lint frontend | Chưa có script/cấu hình tương ứng trong package hiện tại |
| `node scripts/check-max-lines.mjs` | **OK**, không file nào vượt 1.000 dòng |
| Tái hiện số tiền quá hạn | Gọi hai hàm hiện tại với cùng dữ liệu giả: **1.000.000 đ và 0 đ** |
| Kiểm tra bộ lọc tài khoản KH | Probe xác nhận điều kiện scope vẫn giữ cả khi có `search`; không kết luận có lỗi mất scope ở truy vấn này |
| E2e trong lượt này | **Không chạy lại**: Docker Engine hiện không kết nối được. Lượt trước đã đạt 19 test thuộc hai bộ hợp đồng; không coi đó là toàn bộ e2e dự án |
| Build trong lượt này | Không chạy lại vì không sửa source; backend/frontend development đã build đạt ở lượt phát triển trước |
| Giao diện thực tế trong lượt này | Không chạy lại toàn bộ; lượt trước đã thử tạo/sửa/lưu/xoá trường hợp đồng trên database test riêng |

Các mục “chưa thấy” là kết quả kiểm tra workspace, không khẳng định không tồn tại ở một hệ thống triển khai
hoặc kho mã khác chưa được cung cấp. Các yêu cầu hiệu năng, khôi phục, browser/mobile và UAT vẫn cần kiểm chứng riêng.

## 7. Thứ tự xử lý đề xuất

Tuân theo mục 9 của quy tắc: **mỗi lần một chức năng, đặc tả được duyệt trước, nghiệm thu xong mới chuyển tiếp**.
Phần này là lộ trình đề xuất, chưa phải lệnh triển khai đồng thời các module.

1. **Nền tảng và người dùng/phân quyền:** chốt ma trận, sửa phạm vi và lọc trường, làm lint/CI/migration,
   sau đó hoàn thiện lời mời/khôi phục/2FA/quản lý phiên và audit. Đây là các phụ thuộc dùng chung cần ổn định trước.
2. **Khách hàng/hồ sơ:** hoàn thiện dữ liệu thuế/năm tài chính, nhiều liên hệ, nhóm/nguồn và kho tài liệu.
3. **Dịch vụ:** chốt checklist/vai trò mặc định và mô hình giá.
4. **Hợp đồng:** mẫu in, đính kèm, gia hạn và các tiêu chí còn thiếu.
5. **Công việc → deadline/nhắc việc:** sinh lặp từng kỳ, lịch pháp lý/ngày nghỉ, thông báo chủ động, sau đó các tiện ích quản lý.
6. **Thu tiền:** chốt và làm bước duyệt, thống nhất phép tính công nợ giữa các module, chứng từ và đề nghị thanh toán.
7. **Hoá đơn → tài khoản KH → Dashboard/báo cáo → cài đặt:** hoàn thiện theo thứ tự dự án, nghiệm thu từng phần.
8. Trước đưa vào dùng thật: e2e toàn bộ, đo coverage, UAT, kiểm thử tải/bảo mật/backup–restore và xác nhận phạm vi tích hợp.

## 8. Điểm đọc code chính để kiểm tra báo cáo

| Chủ đề | Bằng chứng |
| --- | --- |
| Ma trận quyền và phạm vi | [permissions.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/core/access-control/permissions.ts:34>), [data-scope.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/core/access-control/data-scope.ts:11>) |
| Người dùng/đăng nhập | [users.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/users/users.service.ts:36>), [user.dto.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/users/dto/user.dto.ts>), [auth.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/core/auth/auth.service.ts>) |
| Schema KH/tài liệu/tài khoản | [customers.prisma](<C:/Users/PC/Documents/code/kiểm toán/apps/api/prisma/schema/customers.prisma>) |
| Schema HĐ/dịch vụ/phiếu thu/hoá đơn | [contracts.prisma](<C:/Users/PC/Documents/code/kiểm toán/apps/api/prisma/schema/contracts.prisma>) |
| Trang KH và hồ sơ | [customer-detail.page.html](<C:/Users/PC/Documents/code/kiểm toán/apps/web/src/app/features/customers/pages/customer-detail/customer-detail.page.html>), [customer-documents.component.html](<C:/Users/PC/Documents/code/kiểm toán/apps/web/src/app/features/customers/components/customer-documents/customer-documents.component.html>) |
| Sinh việc và đồng bộ tiến độ | [task-generator.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/tasks/task-generator.ts:75>), [tasks.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/tasks/tasks.service.ts>), [task-progress.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/tasks/task-progress.ts>) |
| Lịch và thông báo | [calendar.page.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/web/src/app/features/calendar/pages/calendar.page.ts>), [notifications.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/notifications/notifications.service.ts:18>) |
| Thu tiền và hoá đơn | [payments.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/payments/payments.service.ts:87>), [invoices.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/invoices/invoices.service.ts>) |
| Báo cáo và Dashboard | [reports.controller.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/reports/reports.controller.ts>), [reports.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/reports/reports.service.ts>), [dashboard.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/dashboard/dashboard.service.ts>) |
| Tài khoản KH | [client-credentials.service.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/client-credentials/client-credentials.service.ts:121>), [credential-table.component.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/web/src/app/features/client-credentials/components/credential-table/credential-table.component.ts:165>) |
| Audit | [audit.interceptor.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/core/audit/audit.interceptor.ts>), [audit-log.controller.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/api/src/modules/audit-log/audit-log.controller.ts>) |
| Route/menu và cấu hình chạy | [app.routes.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/web/src/app/app.routes.ts>), [menu.ts](<C:/Users/PC/Documents/code/kiểm toán/apps/web/src/app/core/layout/menu.ts>), [docker-compose.yml](<C:/Users/PC/Documents/code/kiểm toán/docker-compose.yml>) |

