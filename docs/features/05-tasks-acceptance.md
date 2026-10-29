# Kiểm chứng chức năng 05 — Công việc: 8 trạng thái, soát xét, hồ sơ, hạn

Ngày **23/10/2026**. Kết luận: **đã hoàn thiện và kiểm chứng kỹ thuật 05-B → 05-E theo [đặc tả 05](05-tasks-workflow.md) (H1–H12, người dùng duyệt 22/10/2026)**. **Người dùng nghiệm thu ngày 23/10/2026** (“Tôi nghiệm thu 05 và duyệt đặc tả 06 với phương án đề xuất I1–I14 cùng phạm vi sửa ngoài module đã liệt kê. Bắt đầu code 06-B.”). Chưa merge (thư mục chưa có repo Git), chưa UAT với người dùng thật, chưa có quy trình/hồ sơ yêu cầu thật của công ty (QD07). Thay đổi test cũ: [giải trình](05-test-policy-changes.md). Bản trên vsademo.smarterp.vn hiện có đến 05-C và 04-F4; 05-D, 05-E chưa đẩy lên.

## Phạm vi đã thực hiện

| Gói | Kết quả |
| --- | --- |
| 05-B Quyền và dữ liệu | Sửa R2 (quyền hiệu lực, gồm vai trò tùy chỉnh) và R3 (không tự duyệt, một người không giữ hai cấp); 8 trạng thái PL1; soát xét 0/1/2 cấp; Đã phê duyệt ≠ Hoàn thành (H1); lịch sử trạng thái và lượt soát xét; mốc nộp đầu/chấp nhận (G4); chuyển đổi dữ liệu cũ H9; cờ hạn pháp lý/giao nộp 03 → 04 → việc; nhóm dòng dịch vụ kế toán (H8) |
| 05-C Nhiều kỳ, phụ thuộc | Sinh mọi kỳ trong thời hạn HĐ (H12); khoá (bước, kỳ); bước sau chỉ bắt đầu khi bước trước cùng kỳ Đã phê duyệt/Hoàn thành (H6); tiến độ kỳ/dòng/HĐ |
| 05-D Hồ sơ, chờ khách, hạn | Hồ sơ yêu cầu 6 trạng thái, tải thay khách (QD00); chờ khách tự động theo hồ sơ bắt buộc và chờ tay; xác nhận khoảng chờ, ngày chờ không đếm trùng (G5); tạm dừng/tiếp tục (H5), mở lại; đề nghị/duyệt gia hạn, hạn pháp lý chỉ theo văn bản của GĐ (H7); thông báo |
| 05-E Giao diện | Việc của tôi 4 tab, hàng đợi soát xét có thời gian chờ và SLA 2 ngày làm việc (G7), kanban 8 cột kéo thả hợp lệ, lọc ưu tiên/người kiểm tra/hạn pháp lý, giao lại hàng loạt, bình luận, màn hình hồ sơ khách hàng |
| Bổ sung 04-F4 (cùng đợt, theo yêu cầu bám bảng LTGroup) | Mức độ và nhật ký báo cáo tình hình của hồ sơ kiểm toán — xem [đặc tả 04-F](04-audit-engagement-tracking.md) |

## Đối chiếu tiêu chí nghiệm thu

| # | Tiêu chí | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | 8 trạng thái chuyển đúng bảng; lịch sử người–thời điểm–nội dung; không ai tự đặt Đã phê duyệt/Hoàn thành cho việc cần soát xét | Đạt | `task-status.rules.spec`, `tasks.e2e`, `tasks-follow-up.e2e`; API cũ `/status`, `/approve` trả 410 |
| 2 | R2: cấp và thu quyền trên vai trò tùy chỉnh có hiệu lực ngay ở mọi thao tác | Đạt | `tasks-permissions.e2e` (đỏ trước khi sửa), `tasks-access-05.e2e` (thu `tasks:update` → mọi lệnh ghi 403) |
| 3 | R3: người làm không kiểm tra/phê duyệt việc của mình; một người không giữ hai cấp; chặn ở API | Đạt | `tasks-permissions.e2e`, `task-status.rules.spec` |
| 4 | Soát xét 0/1/2 cấp; trả lại nhiều lần đếm đúng; mốc nộp đầu và chấp nhận tách biệt; H1 | Đạt | `task-status.rules.spec`, `tasks.e2e` (trả lại → gửi lại giữ mốc nộp đầu; Đã phê duyệt → giao nộp) |
| 5 | Hồ sơ yêu cầu theo kỳ/một lần; 6 trạng thái; tải file không tự hoàn tất; chỉ Đã chấp nhận mới mở bước; Cần bổ sung đưa việc về Chờ khách | Đạt | `document-request.rules.spec`, `tasks-follow-up.e2e` |
| 6 | Chờ khách tự động/tay; khoảng chờ không đếm trùng; chỉ khoảng đã xác nhận được trừ; không trừ hạn pháp lý | Đạt (số ngày chờ đã xác nhận trả ở chi tiết việc; báo cáo 10 dùng) | `document-request.rules.spec` (`confirmedWaitDays`), `tasks-follow-up.e2e` |
| 7 | Gia hạn qua đề nghị/duyệt, giữ hạn gốc, lịch sử bất biến; hạn pháp lý không gia hạn | Đạt; sửa hạn trực tiếp bị chặn | `tasks-follow-up.e2e` |
| 8 | Sinh nhiều kỳ không trùng khi gọi lại/đồng thời; kế hoạch mới không đổi việc đã sinh; tiến độ kỳ/dòng/HĐ khớp | Đạt | `task-periods.spec`, `task-generator.spec`, `tasks-periods.e2e`; kế hoạch đã sinh việc không mở lại được (04-B) |
| 9 | Chuyển đổi dữ liệu cũ H9 trên bản sao demo: không mất việc, không bịa lịch sử duyệt, nhãn "dữ liệu chuyển đổi"; Prisma diff sạch | Đạt | Bản sao `ketoan_demo_04` (30 việc), `ketoan_demo_03` (141), bản giả lập việc đã duyệt; DB vsademo (22 việc) |
| 10 | Dashboard/báo cáo hiện tại vẫn đúng; đủ dữ liệu cho báo cáo năng lực 10 | Đạt | `dashboard.e2e`, `reports*.e2e`, `report-grouping.util.spec`; dữ liệu mốc, cấp soát xét, trả lại, gia hạn, chờ khách đã lưu |
| 11 | Giao diện desktop/375px: việc của tôi, hàng đợi, luồng làm → gửi → trả lại → sửa → gửi → duyệt → hoàn thành; chờ khách, hồ sơ, gia hạn, tạm dừng, giao lại hàng loạt | Đạt chức năng (kiểm tay trên bản demo cục bộ); kéo thả kanban chỉ có test logic, chưa có test trình duyệt tự động | Mục Kiểm tra giao diện |
| 12 | Lint/unit/e2e/build/max-lines đạt; e2e phân quyền 5 vai trò + vai trò tùy chỉnh cho API mới; unit máy trạng thái, khoảng chờ chồng nhau, biên ngày giờ VN | Đạt | Mục Kiểm thử tự động; `tasks-access-05.e2e` (thu ngân, quản trị 403; vai trò tùy chỉnh bị thu quyền) |

## Kiểm thử tự động (lần chạy cuối 23/10/2026, máy cục bộ, không phải CI)

| Hạng mục | Kết quả |
| --- | --- |
| API unit | 267/267 |
| API e2e | 236/236 (35 bộ; chạy riêng trên DB test tạo mới) |
| API phân quyền (access) | 57/57, 95,75% dòng |
| Web unit | 88/88 |
| Lint | API 0 lỗi (55 cảnh báo, chủ yếu độ dài hàm test), web 0 lỗi (1 cảnh báo cũ) |
| Typecheck API | còn 4 lỗi cũ ở `customer-relationships.service.spec.ts` (02, ngoài phạm vi) |
| Build web, max-lines | Đạt |

## Migration

`20261022150000_task_workflow` (8 trạng thái + chuyển đổi H9), `20261023090000_task_period_key` (khoá bước + kỳ), `20261023150000_task_follow_up` (hồ sơ, khoảng chờ, gia hạn), `20261023180000_task_comments`. Kiểm trên bản sao DB demo: không mất việc, Prisma diff sạch.

## Kiểm tra giao diện (bản demo cục bộ `ketoan_mig_05b`)

- Nhân viên: bắt đầu → gửi kiểm tra bị chặn thiếu bằng chứng → bị chặn chưa có người kiểm tra; KTT chọn người kiểm tra, trả lại có nội dung; nhân viên gửi lại; KTT phê duyệt → Hoàn thành; lịch sử trạng thái và soát xét đầy đủ.
- KTT mở lại việc đã hoàn thành có lý do; khối hồ sơ, theo dõi, bình luận hiển thị trong chi tiết việc.
- Việc của tôi 4 tab có số đếm, tab Quá hạn đúng danh sách; kanban 8 cột cuộn trong khối; 375px trang không tràn ngang.

## Kịch bản demo nghiệm thu (gợi ý)

1. Lập HĐ dịch vụ theo tháng 3 kỳ, quy trình có hồ sơ yêu cầu và bước phụ thuộc; xác nhận kế hoạch → thấy việc 3 kỳ, bước có hồ sơ ở "Chờ khách".
2. Hồ sơ khách hàng: đánh dấu đã yêu cầu → tải thay khách → kiểm tra → cần bổ sung → tải lại → chấp nhận → việc tự mở, người làm nhận thông báo.
3. Nhân viên: Việc của tôi → bắt đầu, gửi kiểm tra; KTT: hàng đợi soát xét → trả lại → nhân viên gửi lại → KTT duyệt (bước cần giao nộp → Đã phê duyệt → giao nộp).
4. Đề nghị gia hạn (nhân viên) → KTT duyệt; thử gia hạn việc hạn pháp lý (bị chặn) → GĐ ghi nhận theo văn bản.
5. Tạm dừng/tiếp tục, mở lại; giao lại hàng loạt trên bảng; bình luận; tab Kế hoạch của HĐ hiện tiến độ theo kỳ.

## Giới hạn và việc chuyển sang bước sau

- Nhắc hạn theo lịch, lịch nghỉ lễ cho SLA (06); báo cáo năng lực và xuất (10); cấu hình ngưỡng SLA/sắp đến hạn (11).
- Phụ lục gia hạn ngày kết thúc HĐ chưa tự sinh thêm kỳ.
- Việc không có nhóm dòng dịch vụ: đề nghị gia hạn không gửi thông báo (xem trong chi tiết việc).
- Gantt và @nhắc tên để sau (H11). Mức gấp tự động theo dịch vụ/thời gian còn lại (người dùng nêu 23/10): đề xuất ở I11 của [đặc tả 06](06-deadlines-notifications.md), chờ duyệt.
