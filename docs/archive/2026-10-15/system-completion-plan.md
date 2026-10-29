# Kế hoạch hoàn thiện hệ thống quản lý dịch vụ kế toán và kiểm toán

> Bản lưu trữ trước khi tổ chức lại ngày 15/10/2026. Đọc [kế hoạch hiện hành](../../planning/completion-plan.md); các câu hỏi và ước lượng dưới đây phản ánh thời điểm cũ.

Ngày lập: **14/10/2026**. Trạng thái: **Đề xuất triển khai, chưa phải đặc tả nghiệp vụ đã được duyệt**.

## 1. Mục tiêu và căn cứ

Hoàn thiện bản demo hiện có thành hệ thống đáp ứng tài liệu gốc, có số liệu nhất quán,
phân quyền được kiểm chứng và đủ điều kiện đưa vào sử dụng thực tế.

Căn cứ:

- [Tài liệu mô tả chức năng, 21 trang](<C:/Users/PC/Downloads/Tài liệu mô tả chức năng – Phần mềm quản lý công ty dịch vụ Kế toán & Kiểm toán.pdf>).
- [Đối chiếu hiện trạng](requirements-gap-analysis.md), gồm các sai khác đã tái hiện và phần chưa kiểm chứng.
- [Quy tắc code](../../quy-tac-code.md), đặc biệt mục 8–10.
- [Bàn giao phần tiếp nối Claude](continuation-status.md).

Giữ lại các luồng hiện có đáp ứng yêu cầu; bổ sung và sửa theo từng chức năng.
Không tính tỷ lệ hoàn thành bằng số menu hoặc số test đang có.
Các đặc tả demo trong `docs/features/` cần được cập nhật theo PDF trước khi nghiệm thu bản đầy đủ.

## 2. Phạm vi và nguyên tắc thực hiện

**Bản đầy đủ đầu tiên:** các chức năng bắt buộc trong PDF, bao gồm bảo mật, duyệt thu,
sinh việc định kỳ, lịch pháp lý, nhắc việc, mẫu in, xuất XLSX/PDF và cài đặt.

**Chờ quyết định riêng:** tự đối soát ngân hàng, API phát hành hoá đơn điện tử, Zalo,
cổng khách hàng, ứng dụng di động riêng, SSO/đồng bộ lịch và tự đăng nhập cổng bên ngoài.
Không đưa các tích hợp tùy chọn vào tiến độ cơ sở khi chưa chốt làm.
Hồ sơ kiểm toán chuyên môn, timesheet/hoa hồng và mô hình SaaS cũng cần chốt phạm vi trước khi ước lượng.

- Triển khai lần lượt 00 → 11 đúng mục 9 của quy tắc; mỗi lần chỉ một chức năng.
- Chia mỗi chức năng thành các gói nhỏ, đủ để demo và kiểm chứng; không mở nhiều module song song.
- Trước khi code: cập nhật đặc tả chức năng, xác nhận quyền, trạng thái, API và tiêu chí nghiệm thu.
- Khi cần sửa module khác: liệt kê chính xác phạm vi và xin xác nhận trước khi sửa.
- Chức năng sau chỉ bắt đầu khi chức năng trước được nghiệm thu và merge theo quy tắc.
  Workspace hiện chưa có `.git`; cần xác định kho mã chính và quy trình Git ở giai đoạn 00.
  Không tự commit, push hoặc merge khi chưa có yêu cầu.
- Không đặt trạng thái “xong” khi chỉ có API hoặc giao diện; phải hoàn tất dữ liệu, nghiệp vụ, UI và kiểm chứng.
- Chạy e2e/migration trên database test riêng; không reset hoặc dùng dữ liệu demo để thử phá huỷ.

## 3. Các quyết định cần chốt và thời điểm cần

Đây là danh sách đầu vào cho từng giai đoạn, không yêu cầu trả lời tất cả mới bắt đầu lập đặc tả nền tảng.
Chủ đầu tư chỉ định một người có quyền duyệt; bộ phận kế toán/kiểm toán xác nhận nghiệp vụ chuyên môn.

| Mã | Quyết định / dữ liệu cần cung cấp | Cần trước | Ảnh hưởng nếu chưa chốt |
| --- | --- | --- | --- |
| D01 | Một/nhiều pháp nhân, chi nhánh; nội bộ hay SaaS | Thiết kế dữ liệu 00–01 | Chưa chốt ranh giới dữ liệu và quyền |
| D02 | Ma trận vai trò × thao tác × phạm vi × trường tài chính; người duyệt cấp quyền | 01 | Chưa sửa quyền theo giả định |
| D03 | Cấu trúc nhóm, quản lý trực tiếp, bàn giao nghỉ việc; ai được xem/sao chép bí mật | 01 | Ảnh hưởng hồ sơ người dùng, 2FA và audit |
| D04 | Dữ liệu KH/thuế/năm tài chính, nhiều liên hệ; file Excel thực tế | 02 | Ảnh hưởng schema, nhập dữ liệu và deadline |
| D05 | Bảng giá, checklist, chu kỳ, người thực hiện mặc định; phạm vi hồ sơ kiểm toán | 03 | Chưa đóng mô hình sinh việc |
| D06 | Mẫu hợp đồng/phụ lục/thanh lý và quy tắc gia hạn | 04 | Chưa nghiệm thu mẫu in và tái ký |
| D07 | Nhân viên có được tạo việc; duyệt/trả lại; tính kỳ đầu/cuối, việc khi huỷ HĐ | 05 | Tránh sinh sai hoặc trùng công việc |
| D08 | Bộ hạn pháp lý, hiệu lực, ngày nghỉ, người kiểm duyệt; kênh và giờ nhắc | 06 | Không tự suy diễn quy tắc pháp lý |
| D09 | Ai duyệt phiếu thu; tự duyệt có được không; phân bổ tiền, huỷ/đảo thu, dữ liệu cũ | 07 | Không thể nghiệm thu đã thu/còn nợ/tuổi nợ |
| D10 | Hoá đơn công ty xuất hay cả hoá đơn KH; điều chỉnh/thay thế; phạm vi tích hợp | 08 | Chốt ranh giới sổ hoá đơn |
| D11 | Kho tài khoản cập nhật tay hay kết nối thật; người giữ chữ ký số, quy tắc đổi mật khẩu | 09 | Chốt luồng quản lý tài khoản và token |
| D12 | Định nghĩa doanh thu, kỳ so sánh, công nợ tại thời điểm, mẫu báo cáo | 10; chuẩn bị từ 07 | Tránh mỗi báo cáo một phép tính |
| D13 | Thông tin công ty/ngân hàng, mẫu mã chứng từ, SMTP, danh mục và mẫu in | Thu thập từ 00; hoàn tất 11 | Các module trước dùng hợp đồng cấu hình đã thống nhất |
| D14 | Môi trường triển khai, người vận hành, ngân sách, ngày mong muốn, người ký UAT | 00; xác nhận lại trước triển khai | Chưa cam kết lịch đưa vào dùng thật |

Ma trận quyền trong PDF còn là đề xuất. PDF cũng chưa thống nhất người duyệt thu và quyền nhân viên tạo việc.
Các điểm này phải được ghi thành quyết định, không coi đặc tả demo hoặc quyền đang hard-code là câu trả lời.

## 4. Lộ trình theo chức năng

Mỗi mã dưới đây là một giai đoạn, thực hiện các gói con theo thứ tự ghi trong bảng.
Ước lượng là **ngày công kỹ thuật sơ bộ**, gồm đặc tả chi tiết, code, test và sửa sau demo;
chưa gồm thời gian chờ quyết định, chờ hạ tầng hay tích hợp tùy chọn. Không phải cam kết ngày bàn giao.

| Giai đoạn | Gói công việc tuần tự | Điều kiện nghiệm thu chính | Ước lượng |
| --- | --- | --- | --- |
| **00. Nền tảng** | Xác định repo/bản bàn giao; chuẩn hoá lệnh lint/test/build; thiết lập lint web và CI; baseline migration; môi trường test; Docker app; chuẩn shared/store/ngôn ngữ | Có cách dựng sạch lặp lại được; baseline chạy trên DB trống và bản sao DB có dữ liệu; không mất dữ liệu; build production khởi động được; CI thực thi kiểm tra | 5–8 |
| **01. Người dùng, bảo mật, quyền, audit** | Chốt D01–D03; hồ sơ/cây nhóm/chi nhánh; quyền động và duyệt cấp quyền; scope và chính sách trường; mời/khôi phục mật khẩu; chống thử sai, 2FA, phiên; nhật ký | Test cho 5 vai trò, truy cập ngoài nhóm, thao tác trực tiếp API, phiên bị thu hồi; không lộ trường bị cấm; không ghi bí mật vào log; coverage service phân quyền ≥70% | 12–20 |
| **02. Khách hàng và hồ sơ** | Bổ sung dữ liệu thuế/năm tài chính, nhiều liên hệ/nhóm/nguồn; phân công; nhập/xuất XLSX và tra MST theo nguồn được chốt; hồ sơ 360°; thư mục/phiên bản/tìm kiếm/preview; lưu qua S3 | Import có xem trước/lỗi theo dòng và chặn trùng MST; tài liệu đúng phạm vi KH; phiên bản cũ giữ được; preview PDF/ảnh và tải nhiều file hoạt động | 10–16 |
| **03. Dịch vụ và bảng giá** | Giá theo quy mô/chứng từ; checklist có vai trò/thời lượng/bằng chứng; quản lý phiên bản mẫu; hợp đồng dữ liệu phục vụ sinh việc | Giá chọn đúng điều kiện; tắt dịch vụ không phá HĐ cũ; chỉnh mẫu không âm thầm đổi việc đã phát sinh | 5–8 |
| **04. Hợp đồng** | Nghiệm thu lại form đã sửa; mẫu Word/PDF; phụ lục và thanh lý; scan tại HĐ; sao chép/gia hạn; sự kiện cảnh báo sắp hết hạn | Tạo → duyệt → phụ lục/gia hạn/thanh lý đúng quyền; mẫu in đúng dữ liệu; bản cũ truy vết được; không tạo trùng đợt thu/việc | 8–12 |
| **05. Công việc** | Sinh theo từng kỳ; bảo đảm chạy lại không sinh trùng; việc phát sinh; duyệt/trả lại; bộ lọc đủ; thao tác hàng loạt; bình luận/@nhắc; bàn giao; Gantt và tổng hợp tiến độ KH | Đủ việc qua tháng/quý/năm, kỳ đầu/cuối và HĐ dừng; chạy lại job không trùng; bằng chứng bắt buộc kiểm ở API; bàn giao không bỏ sót và có nhật ký | 12–20 |
| **06. Lịch, deadline, nhắc việc** | Bộ quy tắc pháp lý có hiệu lực; ngày nghỉ/năm tài chính; trạng thái nộp và biên nhận; lịch tháng/tuần; Redis/BullMQ; trước hạn/đến hạn/quá hạn/escalation/bản tin; email và chuông | Bộ tình huống hạn được nghiệp vụ duyệt; không trùng nhắc khi retry; gửi đúng người/giờ; phục hồi job sau restart; nộp báo cáo và lưu biên nhận truy vết được | 10–16 |
| **07. Thu tiền và công nợ** | Thống nhất phép tính công nợ; phân bổ theo đợt; duyệt/từ chối/huỷ hoặc đảo phiếu theo D09; chứng từ; đối chiếu/tuổi nợ; đề nghị thanh toán PDF/VietQR/email | Chỉ phiếu hợp lệ đã duyệt tính vào đã thu; không vượt số được phép khi duyệt đồng thời; Thu tiền/HĐ/Báo cáo khớp; coverage tiền ≥70%; bộ ví dụ D09 được xác nhận | 10–16 |
| **08. Hoá đơn** | Đề nghị từ HĐ/đợt thu; sổ hoá đơn; điều chỉnh/thay thế/huỷ có liên kết lịch sử; lưu PDF/XML; đối chiếu thu–xuất | Trạng thái và số tiền khớp chứng từ; truy vết chuỗi thay thế/điều chỉnh; lọc được đã thu chưa xuất và ngược lại; phân biệt ghi sổ với phát hành qua nhà cung cấp | 7–11 |
| **09. Tài khoản KH** | Tích hợp 2FA/quyền từ 01; log xem/sao chép; lịch sử đổi mật khẩu; NCC/serial/hạn/người giữ chữ ký số; nhắc hết hạn | Từng lần xem/sao chép trong ứng dụng có sự kiện audit; không lộ bí mật trong list/export/log; từ chối người thiếu quyền/2FA; cảnh báo đúng người giữ | 5–8 |
| **10. Dashboard và báo cáo** | Chuẩn hoá kỳ và KPI; phạm vi/trường theo vai trò; drill-down; báo cáo KH/HĐ/hoá đơn/tái ký; so sánh kỳ; XLSX/PDF; lưu bộ lọc/gửi lịch; tìm kiếm và bộ chọn kỳ chung | Đổi kỳ cập nhật đúng các khối theo định nghĩa đã chốt; tổng hợp khớp sổ chi tiết; bản xuất cùng quyền/bộ lọc; không tìm thấy dữ liệu ngoài scope | 10–16 |
| **11. Cài đặt hoàn chỉnh** | UI công ty/ngân hàng/mẫu in/đánh số; danh mục; quy tắc nhắc/ngày lễ/SMTP; hồ sơ cá nhân và tuỳ chọn thông báo; tích hợp cấu hình các module | Thay cấu hình có hiệu lực đúng thời điểm, có audit và validation; mã chứng từ không trùng khi đồng thời; cấu hình bí mật được bảo vệ; không phải sửa code để đổi thông tin công ty | 7–11 |
| **12. Nghiệm thu toàn hệ thống và đưa vào dùng** | Hồi quy xuyên module; tải/bảo mật/backup–restore; import thử rồi đối soát; UAT; đào tạo/tài liệu; triển khai có phương án quay lui | Đạt toàn bộ điều kiện mục 8; có biên bản UAT, dữ liệu đối soát và người chịu trách nhiệm vận hành | 10–15 |

Tổng cơ sở: **121–193 ngày công**. Dự phòng đề xuất 20%: khoảng **145–232 ngày công**.
Với một người thực hiện toàn thời gian 5 ngày/tuần, tương đương khoảng **29–47 tuần làm việc** có dự phòng,
chưa gồm thời gian chờ duyệt. Đây là khoảng lập ngân sách ban đầu, không suy ra tốc độ của AI hoặc cam kết tiến độ.
Sau giai đoạn 00–01 và khi D01–D03/D14 được chốt, ước lượng lại bằng tốc độ thực tế và backlog đã duyệt.
Không chia đơn giản tổng này cho số lập trình viên vì các giai đoạn có phụ thuộc và quy tắc triển khai tuần tự.

## 5. Xử lý phụ thuộc và các sai khác ưu tiên

### 5.1 Quyền và dữ liệu nhạy cảm

Giai đoạn 01 xây chính sách ở `access-control` và test dùng chung. Tích hợp chính sách vào endpoint
người dùng, hợp đồng, báo cáo, dashboard và tài khoản KH có thể cần sửa ngoài module đang thực hiện.
Đặc tả 01 phải liệt kê từng điểm chạm để được xác nhận trước khi code; không chỉ ẩn nút ở UI.
Chưa được mở pilot bằng dữ liệu thật khi các đường đọc dữ liệu nhạy cảm chưa qua kiểm tra quyền.

### 5.2 Công nợ sai khác giữa hai màn hình

Đặt tiêu chí hồi quy bắt buộc cho giai đoạn 07:
đợt quá hạn 1.000.000 đ chưa được trả, đợt tương lai 1.000.000 đ đã được trả đích danh,
thì công nợ quá hạn phải còn **1.000.000 đ** ở mọi màn hình, theo quy tắc phân bổ đã chốt.

Đưa phép tính dùng chung vào vị trí phù hợp thay vì sao chép giữa `payments` và `reports`.
Phạm vi sửa `reports`/`contracts`/`dashboard` nếu cần phải được nêu trong đặc tả 07.
Không chờ giai đoạn 10 mới sửa sai số tài chính. Trước giai đoạn 07, hệ thống vẫn là demo chưa nghiệm thu tài chính.
Nếu cần sửa lỗi này sớm hơn thứ tự quy định, trình một gói sửa lỗi riêng để chủ đầu tư duyệt ngoại lệ.

### 5.3 Module cài đặt ở cuối nhưng nhiều chức năng cần cấu hình sớm

Tại giai đoạn 00 chốt giao diện cấu hình và cách quản lý bí mật, chưa xây toàn bộ module settings.
Mỗi module sở hữu cấu hình nghiệp vụ tối thiểu của mình và xác thực đầu vào; tránh thêm hằng số khó thay đổi.
Giai đoạn 11 cung cấp màn hình quản trị thống nhất trên các giao diện đã thống nhất.
Khi cần tạo bảng/endpoint settings sớm, phải ghi rõ phụ thuộc và xin xác nhận phạm vi.

### 5.4 Sinh việc, cảnh báo và hồ sơ 360°

- Giai đoạn 04 định nghĩa sự kiện hết hạn HĐ; 05 cung cấp bộ sinh việc có thể chạy lại an toàn;
  06 nối scheduler/queue và các loại nhắc. Kiểm tra tích hợp lại 04–06 ở mốc hoàn tất 06.
- 02 hoàn thiện hồ sơ 360° từ dữ liệu đã có. Khi 07–10 thêm công nợ, hoá đơn và báo cáo,
  cập nhật phần tích hợp có phạm vi được duyệt; nghiệm thu cuối không để tab giả hoặc số liệu tĩnh.
- 01 cung cấp audit bảo mật; 09 tích hợp sự kiện sao chép và bước xác minh cho kho bí mật.
- 07 ghi nhận dữ liệu tài chính đủ để 10 lập báo cáo tại thời điểm, tránh chỉ lưu tổng hiện tại.

## 6. Gói công việc đầu tiên đề xuất

**Gói 00-A — thiết lập cơ sở kiểm tra và bàn giao có thể tái hiện.**

1. Xác định bản source chính, repo/remote nếu có, tình trạng tiếp nhận code Claude; giữ bản sao trước thay đổi.
2. Viết đặc tả 00 gồm danh sách file được phép sửa, lệnh kiểm tra, môi trường và tiêu chí nghiệm thu.
3. Bổ sung lệnh lint chỉ kiểm tra, không tự sửa; cấu hình ESLint cho frontend, xuất danh sách lỗi theo module.
4. Sửa lỗi trong phạm vi core/shared/tooling của 00. Lỗi thuộc users chỉ xử lý sau khi phạm vi được xác nhận;
   không tắt luật hoặc bỏ file khỏi lint để tạo kết quả xanh giả.
5. Chuẩn hoá lệnh unit/e2e/build/check-max-lines và đường dẫn chạy bản build backend.
6. Chuẩn bị thiết kế baseline migration và cách chạy trên bản sao dữ liệu; chưa reset DB hiện tại.
7. Ghi kết quả thực tế vào tài liệu bàn giao, demo cách dựng sạch và trình nghiệm thu.

Đầu ra: đặc tả 00, danh sách lỗi có chủ sở hữu, quy trình kiểm tra lặp lại được và kế hoạch migration an toàn.
Chỉ đóng giai đoạn 00 khi kiểm tra toàn cục đạt; nếu lỗi ở module khác chặn lint, xin xác nhận
phạm vi sửa tối thiểu để xử lý trước khi nghiệm thu, thay vì ghi nhận là đã hoàn tất.

## 7. Quy trình và tiêu chí hoàn thành từng chức năng

Mỗi chức năng đi qua sáu bước: **đặc tả được duyệt → migration/seed → API/test → UI → kiểm tra → nghiệm thu/merge**.
Kế hoạch này không thay thế việc duyệt đặc tả theo quy tắc.

Mỗi mục yêu cầu cần một dòng theo dõi:
`Mã yêu cầu | Trang/mục PDF | Quyết định liên quan | Gói thực hiện | Tiêu chí | Test/bằng chứng | Trạng thái | Người duyệt`.
Trạng thái thống nhất: Chưa đặc tả / Chờ quyết định / Sẵn sàng / Đang làm / Chờ nghiệm thu / Đã nghiệm thu.

Điều kiện đóng một chức năng:

- Đặc tả ghi rõ hành vi thành công, lỗi, trạng thái, phân quyền và những điểm khác PDF đã được chấp thuận.
- Migration chạy trên DB trống và bản sao DB có dữ liệu; đối soát trước/sau và có cách phục hồi.
- API, giao diện, file xuất cùng áp dụng scope và chính sách trường; có e2e cho từ chối truy cập.
- Unit và e2e liên quan đạt; frontend có test hành vi thiết yếu, tự thử luồng chính trên giao diện.
- Khi test fail, sửa nguyên nhân ở code hoặc môi trường; không sửa, skip hoặc nới kỳ vọng test để có kết quả xanh.
  Chỉ đổi test khi yêu cầu được duyệt thay đổi hoặc test sai với đặc tả, và ghi lý do cùng bằng chứng.
- Lint backend/frontend, build và `node scripts/check-max-lines.mjs` đạt; tách file >800 dòng trước khi thêm code.
- Đo coverage service tiền/phân quyền ≥70%; thêm tình huống biên theo rủi ro, không dùng số test thay coverage.
- Chuỗi tiếng Việt đặt trong file ngôn ngữ; kiến trúc store/API/component theo quy tắc.
- Có nhật ký thay đổi, bằng chứng kiểm tra và xác nhận nghiệm thu của người được chỉ định.

## 8. Điều kiện đưa vào sử dụng thực tế

| Nhóm | Bằng chứng phải có |
| --- | --- |
| Luồng xuyên hệ thống | KH → HĐ → duyệt → sinh việc nhiều kỳ → bằng chứng/nộp báo cáo → duyệt thu → hoá đơn → báo cáo; có nhánh huỷ/từ chối/bàn giao |
| Phân quyền và bảo mật | Ma trận đã duyệt; kiểm tra API và bản xuất theo từng vai trò; 2FA cho người xem bí mật; thu hồi phiên; đánh giá bảo mật và xử lý phát hiện nghiêm trọng |
| Số liệu | Đối soát tổng HĐ, phiếu thu đã duyệt, phân bổ đợt, còn nợ, tuổi nợ, hoá đơn và mọi báo cáo trên bộ dữ liệu nghiệp vụ được ký xác nhận |
| Hiệu năng | Chốt cách đo ngưỡng <2 giây theo PDF; kiểm thử 100 người đồng thời với 5.000 KH và 50.000 task/năm, ghi cấu hình hạ tầng và kết quả |
| Giao diện | Thử từ 375px, tablet/desktop và các trình duyệt mục tiêu; không mất thao tác chính hoặc trường dữ liệu |
| Dữ liệu và khôi phục | Backup hằng ngày, giữ 30 ngày; phục hồi thử cả DB/file và khả năng giải mã bằng khóa được bảo quản; chứng minh RPO ≤24 giờ/RTO ≤4 giờ |
| Vận hành | HTTPS, quản lý secret, log/giám sát/cảnh báo; đo uptime mục tiêu 99,5% sau triển khai, không coi một lần test là chứng minh uptime |
| Chuyển đổi | Import thử dữ liệu cũ, xử lý lỗi/trùng, đối soát và ký xác nhận; kế hoạch chốt dữ liệu và quay lui |
| Bàn giao | UAT được ký; tài liệu người dùng/quản trị, đào tạo, tài khoản vận hành; người tiếp nhận sự cố và thời hạn bảo hành được xác nhận |

## 9. Cách theo dõi tiến độ và rủi ro

- Sau mỗi gói: cập nhật yêu cầu đã nghiệm thu, phần đang làm, phần chờ quyết định và kết quả kiểm tra.
- Tại các mốc 01, 04, 06, 09, 11: demo tích hợp, cập nhật ước lượng còn lại và quyết định có mở giai đoạn kế tiếp.
- Báo cáo tiến độ bằng tiêu chí đã nghiệm thu/tổng tiêu chí đã chốt; khi đổi phạm vi phải cập nhật mẫu số.
- Không công bố hệ thống hoàn thành vì unit test xanh trong khi lint, e2e, dữ liệu hoặc UAT chưa đạt.
- Rủi ro chính: câu hỏi nghiệp vụ chưa chốt; migration từ DB demo chưa có lịch sử; phạm vi sửa xuyên module;
  dữ liệu nhập không đồng nhất; thiếu SMTP/storage/hạ tầng; các tích hợp bên ngoài phát sinh sau.
- Với mỗi rủi ro, ghi người xử lý, quyết định cần và giai đoạn bị chặn; không âm thầm thay yêu cầu bằng bản rút gọn.

## 10. Trạng thái khi lập kế hoạch

Đã có báo cáo đối chiếu và bản kế hoạch này. Gói 00-A đã được triển khai trong
[đặc tả nền tảng](../../features/00-foundation.md), nhưng giai đoạn 00 chưa nghiệm thu.
Mốc sau 00-A và phạm vi sửa lint được xác nhận: 71 unit test backend và 7 frontend đạt;
lint backend **0 lỗi/9 cảnh báo**, frontend **0 lỗi/1 cảnh báo** (đều exit 0);
kiểm tra giới hạn dòng đạt. Gói 00-B đã tạo baseline migration và workflow CI;
e2e toàn API trên DB test riêng đạt **11 suites/82 tests**. CI trên GitHub chưa chạy
vì workspace chưa có `.git`. Gói 00-C đã build và chạy thử API/web/Prisma migration
trên Compose riêng; web và Swagger qua cổng 8082 trả HTTP 200. Unit test và lint
vẫn đạt. Stack thử nghiệm đã được dọn. Coverage, tải, bảo mật và UAT
chưa được xác nhận hoàn tất. Gói 00-D đã sao lưu và khôi phục database/file sang
project Compose mới trong phép thử cục bộ; hàng và file mẫu khớp, từ chối đích có
dữ liệu và backup sai checksum. Vận hành backup định kỳ/RPO/RTO trên hạ tầng thật
vẫn cần thiết kế và nghiệm thu.

Việc tiếp theo trong **chức năng 00**:

1. **Đóng chức năng 00:** xác định repository chính và chạy workflow CI đã viết trên đó;
   rà cảnh báo build production, lint/test/e2e và giới hạn dòng; demo, nghiệm thu theo mục 9.
2. **Sau nghiệm thu 00 mới bắt đầu chức năng 01:** chốt D01–D03/D14 và ma trận quyền,
   cập nhật `docs/features/01-users.md`, rồi triển khai từng luồng đăng nhập, người dùng,
   phân quyền và audit theo đặc tả được duyệt.

Cảnh báo độ dài hàm test được xử lý khi đến đúng phạm vi module; không thay đổi test chỉ để
loại cảnh báo nếu việc đó làm yếu khả năng phát hiện lỗi.
