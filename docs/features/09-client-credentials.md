# 09 — Kho tài khoản khách hàng và chữ ký số (token)

Ngày 30/10/2026. **Đã được người dùng duyệt trong chat ngày 30/10/2026 (“Duyệt, làm 09-B”) — đặc tả, L1–L12 theo phương án đề xuất và phạm vi sửa ngoài module đã liệt kê.**

Căn cứ: YC19 trong [phạm vi](../requirements/scope-and-traceability.md) (PDF tích hợp mục 5.2: loại tài khoản, chữ ký số với nhà cung cấp / serial / hạn / người đang giữ / cảnh báo trước hạn, mật khẩu mã hoá, chỉ hiện khi bấm "Xem" và có quyền, **mỗi lần xem hoặc sao chép đều ghi ai, lúc nào**, 3 trạng thái, lịch sử thay đổi mật khẩu và người cập nhật); câu hỏi đã trả lời **18** ("Chỉ để lưu trữ … Không cần kết nối"), **19** (quản lý token: ai giữ, mượn/trả, ngày hết hạn — "Cần"), **20** (không bắt buộc 2FA/IP); **QD02** (xem bí mật cần quyền riêng + xác nhận lại mật khẩu 5 phút, vẫn mã hoá và audit — dùng lại, không hỏi lại); 06 (cơ chế nhắc, chống gửi trùng).

## Phạm vi nghiệp vụ

- **Là:** kho lưu **an toàn** thông tin đăng nhập các cổng mà nhân viên dùng thay mặt khách hàng (thuế điện tử, BHXH, hoá đơn điện tử, email doanh nghiệp, khác) và **sổ theo dõi chữ ký số (token USB)** của khách: ai đang giữ, mượn/trả, hạn chứng thư.
- **Không phải:** tự đăng nhập cổng nhà nước, kiểm tra tài khoản còn đăng nhập được hay không, lấy tờ khai/hoá đơn tự động (câu 18). Trạng thái "Lỗi đăng nhập" do người dùng ghi nhận tay.
- Không thay tài khoản đăng nhập phần mềm của nhân viên (01) và tài khoản EasyInvoice của công ty (08-E, QD09).

## Hiện trạng (mức demo, gộp trong 02)

- Bảng `client_credentials`: loại, nhãn, URL, tên đăng nhập, mật khẩu mã hoá AES-256-GCM (`CREDENTIAL_KEY`), ngày hết hạn, 3 trạng thái, ghi chú, xoá mềm; API không trả `passwordEnc`.
- Xem mật khẩu: `POST /client-credentials/:id/reveal` cần `client-credentials:view_secret` + xác nhận lại mật khẩu 5 phút (QD02), ghi `VIEW_SECRET` vào nhật ký chung.
- **Thiếu:** nút **Sao chép** chép mật khẩu đã hiện ở trình duyệt, **không ghi log**; không có lịch sử đổi mật khẩu / thay đổi; token chỉ là một "loại tài khoản" (serial nhét vào tên đăng nhập, PIN vào mật khẩu) — **không có nhà cung cấp, người giữ, mượn/trả, nhắc hạn**; không kiểm soát đồng thời; mật khẩu đã hiện không tự ẩn; nhân viên thấy lỗi đăng nhập không có cách báo.
- Dữ liệu demo: 5 tài khoản, trong đó 1 token.

## Câu chuyện người dùng

1. **KTT / Giám đốc** thêm tài khoản cổng của khách (loại, URL, tên đăng nhập, mật khẩu); đổi mật khẩu khi khách đổi — hệ thống ghi **ai đổi, lúc nào** (không lưu mật khẩu cũ).
2. **Nhân viên được phân công KH và được cấp quyền xem bí mật** bấm **Xem** (hiện 30 giây rồi tự ẩn) hoặc **Sao chép** (không hiện lên màn hình) — mỗi lần đều ghi nhật ký.
3. Nhân viên đăng nhập cổng thất bại → **báo lỗi** (chuyển "Lỗi đăng nhập" / "Cần đổi mật khẩu", kèm ghi chú) để KTT xử lý.
4. **Token chữ ký số:** KTT ghi nhận token nhận từ khách (nhà cung cấp, serial, hạn, nơi cất). Nhân viên **mượn** token để nộp tờ khai (hạn trả dự kiến), **trả** lại; KTT **trả token cho khách** hoặc nhận lại. Lúc nào cũng biết token đang ở đâu, ai giữ.
5. Hệ thống **nhắc trước khi token hết hạn** và **nhắc trả token quá hạn** qua cơ chế nhắc 06 (trong ứng dụng + email khi có SMTP).
6. **Giám đốc / KTT** xem **lịch sử** từng tài khoản (tạo, sửa, đổi mật khẩu, đổi trạng thái, mượn/trả) và **nhật ký xem/sao chép**.

## Phạm vi

- **Trong phạm vi (module `client-credentials`):** schema/migration/seed, API, sự kiện/lịch sử, nhật ký xem/sao chép, báo lỗi, token (nơi giữ, mượn/trả), kiểm soát đồng thời, màn hình `/client-credentials` (2 tab), ngăn chi tiết, test; script kiểm tra/xoay khoá và hướng dẫn vận hành khoá.
- **Phạm vi ngoài module xin duyệt cùng đặc tả:**
  - `notifications` (06): thêm nguồn nhắc **CREDENTIAL** vào bộ lập nhắc (file mới `credential-reminders.ts` + một dòng gọi trong `ReminderService.plan`), dùng nguyên khoá chống gửi trùng, ngưỡng/kênh/tuỳ chọn người nhận của 06. Hồi quy e2e 06.
  - `customers` (02): tab "Tài khoản" trong hồ sơ KH360 dùng cùng bảng/ngăn chi tiết mới (chỉ giao diện, không đổi API 02).
  - `access-control` (01): **không thêm hành động mới** — dùng `view / create / update / delete / view_secret` hiện có (xem bảng Quyền). Không đổi ma trận vai trò.
  - `audit` (core): chỉ thêm giá trị hành động `COPY_SECRET` khi ghi nhật ký chung (không đổi interceptor).
- **Ngoài phạm vi 09:** tự đăng nhập/kiểm tra cổng (câu 18); 2FA/IP (câu 20, QD02); kho mật khẩu của công ty (tài khoản EasyInvoice, ngân hàng — thuộc 11/cấu hình); xuất Excel danh sách tài khoản (L11); danh mục loại tài khoản tuỳ biến (11 — "Danh mục: loại tài khoản"); ô cảnh báo token trên trang tổng quan (10 đọc dữ liệu 09).

## Quyết định cần duyệt

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| L1 | Loại tài khoản | Giữ 6 loại: Cổng thuế điện tử, BHXH, Hoá đơn điện tử, Email doanh nghiệp, **Chữ ký số (token)**, Khác. Loại **Khác bắt buộc nhập tên** (tự khai báo). Danh mục tuỳ biến làm ở 11 | Cho tự thêm loại ngay ở 09 |
| L2 | Token lưu thế nào | Cùng bảng tài khoản (dùng chung quyền, phạm vi KH, mã hoá, nhật ký) nhưng **trường riêng**: **nhà cung cấp** (VNPT-CA, Viettel-CA, FPT-CA, BKAV-CA, MISA-CA, EasyCA, Khác), **số serial**, **hạn chứng thư** (bắt buộc), **mã PIN** (bí mật, tuỳ chọn), **nơi giữ**. Token không cần tên đăng nhập. Chặn trùng serial (cùng nhà cung cấp) đang hiệu lực | Bảng token tách riêng |
| L3 | Nơi giữ token | Một trong 3: **Tại văn phòng** (kèm vị trí cất, vd. "Tủ A2"), **Khách hàng giữ**, **Nhân viên đang mượn** (người mượn, lúc mượn, hạn trả, mục đích). Token cũ chuyển đổi chưa rõ nơi giữ → **"Chưa xác định"**, danh sách cảnh báo cần cập nhật | Chỉ ghi tên người giữ dạng chữ |
| L4 | Ai mượn/trả | **Mượn cho chính mình:** người có `view` trong phạm vi KH (nhân viên được phân công) khi token **Tại văn phòng**; hạn trả bắt buộc, mặc định hết ngày làm việc kế tiếp, tối đa 30 ngày. **Trả:** người đang mượn hoặc người có `update`. **Giao cho nhân viên khác / thu hồi / trả khách / nhận từ khách / đổi nơi cất:** `update` (GĐ, KTT trong nhóm). Mỗi thao tác ghi sự kiện; hai người mượn cùng lúc → một thành công, một 409 | Mọi mượn/trả đều do KTT ghi nhận |
| L5 | Lịch sử đổi mật khẩu | Ghi sự kiện **Đổi mật khẩu/PIN** (ai, lúc nào) và **ngày đổi gần nhất** trên tài khoản; **không lưu mật khẩu cũ** (kể cả dạng mã hoá) | Lưu bản mã hoá mật khẩu cũ để xem lại |
| L6 | Xem / sao chép | **Xem:** hiện 30 giây rồi tự ẩn, ghi `VIEW`. **Sao chép:** gọi API riêng, chép thẳng vào clipboard **không hiện**, ghi `COPY`. Cả hai cần `view_secret` + xác nhận mật khẩu 5 phút (QD02). Ghi vào nhật ký riêng của tài khoản **và** nhật ký chung (`VIEW_SECRET` / `COPY_SECRET`); log chỉ có người, lúc, loại thao tác — **không chứa mật khẩu**. Giới hạn: người đã thấy mật khẩu vẫn có thể tự ghi lại — hệ thống chỉ bảo đảm mọi lần lấy ra đều có log | Sao chép cần xem trước |
| L7 | Báo lỗi đăng nhập | Người có `view` trong phạm vi KH được **báo lỗi**: chuyển "Lỗi đăng nhập" hoặc "Cần đổi mật khẩu" kèm ghi chú bắt buộc; không đổi được các trường khác. Chuyển về "Đang dùng được" cần `update` | Chỉ KTT đổi trạng thái |
| L8 | Ai xem lịch sử / nhật ký | **Lịch sử thay đổi + mượn/trả:** mọi người xem được tài khoản. **Nhật ký xem/sao chép:** người có `update` (GĐ toàn công ty, KTT trong nhóm) | Chỉ GĐ xem nhật ký |
| L9 | Nhắc hạn (qua 06) | **Token hết hạn chứng thư:** mốc **30, 7, 1 ngày** trước và **đúng ngày hết hạn**; người nhận: **người phụ trách KH** và **người đang mượn** (nếu có). **Mượn quá hạn trả:** nhắc người mượn vào ngày đến hạn; quá 1 ngày làm việc → nhắc thêm người phụ trách KH. Tài khoản loại khác có ngày hết hạn dùng cùng mốc. Kênh, giờ gửi, chống trùng, tuỳ chọn email theo 06 | Mốc 30/15/7/3/1 |
| L10 | Xoá | Xoá mềm cần `delete` và **lý do**; token đang được mượn không xoá được; ghi sự kiện. Không xoá cứng | Cho xoá không lý do như demo |
| L11 | Xuất Excel | **Không** xuất Excel danh sách tài khoản/token ở 09 (giảm đường rò dữ liệu nhạy cảm); báo cáo token, nếu cần, làm ở 10 không có bí mật | GĐ xuất danh sách không có mật khẩu |
| L12 | Khoá mã hoá, sao lưu | Giữ AES-256-GCM, khoá `CREDENTIAL_KEY` ngoài DB. Thêm script `credential-key` hai lệnh: **check** (giải mã thử mọi bản ghi, báo số lỗi, không in bí mật) và **rotate** (mã hoá lại toàn bộ bằng khoá mới trong một transaction, chạy check sau đó). Hướng dẫn: giữ khoá **tách khỏi bản sao lưu DB**; restore cần đúng khoá; chạy check sau restore. Kiểm thật: dump → restore bản sao → check đạt với khoá đúng, báo lỗi rõ với khoá sai | Chỉ ghi hướng dẫn, không script |

Kiểm soát đồng thời (mặc định, không cần chọn): mọi thao tác ghi trên tài khoản kiểm `revision` — bản cũ → 409.

## Quyền

Kế thừa ma trận 01; phạm vi theo KH (`customerScope`): GĐ toàn công ty, KTT trong nhóm, nhân viên KH được phân công.

| Thao tác | Quyền | GĐ | KTT | Nhân viên | Thu tiền | Quản trị |
| --- | --- | --- | --- | --- | --- | --- |
| Xem danh sách, chi tiết (không bí mật), lịch sử, mượn/trả | `view` | ✓ | ✓ | ✓ (KH được giao) | — | — |
| Báo lỗi đăng nhập (L7); mượn token cho mình, trả token mình đang mượn (L4) | `view` | ✓ | ✓ | ✓ (KH được giao) | — | — |
| Thêm / sửa / đổi mật khẩu / giao – thu hồi – trả khách token | `create` / `update` | ✓ | ✓ | — | — | — |
| Xoá mềm (có lý do) | `delete` | ✓ | ✓ | — | — | — |
| Xem / sao chép mật khẩu, PIN | `view_secret` + xác nhận 5 phút | ✓ | ✓ | Khi được cấp riêng | — | — |
| Nhật ký xem/sao chép (L8) | `update` | ✓ | ✓ | — | — | — |

## Dữ liệu

- `client_credentials` thêm: `provider` (enum nhà cung cấp, token), `serial_number`, `custody` (OFFICE / CUSTOMER / LOANED / UNKNOWN; null với loại không phải token), `storage_location`, `holder_id`, `loaned_at`, `loan_due_at`, `loan_purpose`, `secret_changed_at`, `secret_changed_by_id`, `status_note`, `revision`. `username` cho phép rỗng với token; `password_enc` cho phép rỗng với token chưa có PIN. Ràng buộc duy nhất (`provider`, `serial_number`) với bản chưa xoá.
- Bảng mới `credential_events`: `credential_id`, `type` (CREATED, UPDATED [danh sách tên trường đổi, không giá trị bí mật], SECRET_CHANGED, STATUS_REPORTED, STATUS_CHANGED, SECRET_VIEWED, SECRET_COPIED, BORROWED, RETURNED, HANDED_OVER, RECEIVED_FROM_CUSTOMER, RETURNED_TO_CUSTOMER, LOCATION_CHANGED, DELETED), `actor_id`, `at`, `note`, `detail` (JSON không bí mật).
- **Migration:** token cũ: `serial_number` ← `username`, `username` ← null, `provider` ← "Khác" (hoặc suy từ nhãn chứa VNPT/Viettel/FPT/BKAV/MISA), `custody` ← UNKNOWN; mọi bản ghi sinh 1 sự kiện CREATED **đánh dấu chuyển đổi** (không bịa lịch sử); `password_enc` giữ nguyên (không giải mã lại). Báo cáo số bản ghi trước–sau trên bản sao demo và chạy `credential-key check`.

## API (đề xuất)

| Phương thức | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/client-credentials` | Lọc KH, loại, trạng thái, nơi giữ, người giữ, sắp hết hạn (≤ 30 ngày), mượn quá hạn, tìm kiếm. Không bí mật |
| GET | `/client-credentials/:id` | Chi tiết + lịch sử (L8) |
| GET | `/client-credentials/:id/access-log` | Nhật ký xem/sao chép (`update`) |
| POST / PATCH / DELETE | `/client-credentials`, `/:id` | Kèm `revision`; DELETE có `reason` |
| POST | `/:id/secret` `{ purpose: VIEW \| COPY }` | Thay `/reveal` (giữ `/reveal` làm bí danh VIEW đến hết 09 để không vỡ UI cũ); `view_secret` + xác nhận 5 phút |
| POST | `/:id/report-issue` | L7 |
| POST | `/:id/borrow`, `/:id/return`, `/:id/hand-over`, `/:id/custody` | L3–L4; kèm `revision` |

## Màn hình

- `/client-credentials`: tab **Tài khoản cổng** và tab **Chữ ký số (token)** (cột nhà cung cấp, serial, hạn còn N ngày, nơi giữ / người mượn, hạn trả; lọc "Sắp hết hạn", "Đang mượn", "Mượn quá hạn", "Chưa xác định nơi giữ").
- Ngăn chi tiết: thông tin, nút Xem / Sao chép (L6), Báo lỗi, Mượn / Trả / Giao / Trả khách theo quyền, tab Lịch sử và tab Nhật ký truy cập (L8).
- Hồ sơ KH360 tab "Tài khoản" dùng cùng thành phần. Desktop và 375px không tràn ngang.

## Gói thực hiện

1. **09-B — dữ liệu và API:** migration + seed; sự kiện/lịch sử; `secret` VIEW/COPY có log; báo lỗi; token nơi giữ, mượn/trả/giao/trả khách; revision; unit + e2e (quyền, phạm vi, 409, không lộ bí mật).
2. **09-C — nhắc hạn qua 06:** token sắp hết hạn, mượn quá hạn trả; e2e chạy lại không gửi trùng, đổi hạn/trả token thì không nhắc tiếp; hồi quy 06.
3. **09-D — giao diện:** 2 tab, ngăn chi tiết, hộp thoại mượn/trả/giao, Xem tự ẩn, Sao chép không hiện; KH360; web test; kiểm tra desktop/375px.
4. **09-E — bảo mật và nghiệm thu:** quét API/log/nhật ký/thông báo không chứa bí mật; mượn đồng thời; script `credential-key` check/rotate; thử dump/restore với khoá đúng/sai; hướng dẫn vận hành khoá; biên bản `09-client-credentials-acceptance.md`.

## Tiêu chí nghiệm thu

1. Thêm/sửa/xoá đúng quyền và phạm vi; loại Khác bắt buộc tên; token bắt buộc nhà cung cấp, serial, hạn; trùng serial → 409.
2. Mật khẩu/PIN không xuất hiện trong bất kỳ phản hồi API nào ngoài `secret`, trong nhật ký chung, lịch sử, thông báo, email, log máy chủ.
3. Mỗi lần Xem / Sao chép tạo đúng một dòng nhật ký (ai, lúc, loại); thiếu quyền hoặc quá 5 phút chưa xác nhận → 403; nhân viên ngoài phân công → 404.
4. Đổi mật khẩu ghi ai/lúc; không còn cách đọc mật khẩu cũ.
5. Token: mượn/trả/giao/trả khách đúng quyền; hai người mượn cùng lúc → một thành công, một 409; luôn có đúng một nơi giữ hiện tại; lịch sử đầy đủ.
6. Nhắc hạn token và mượn quá hạn đến đúng người, đúng mốc, không trùng khi chạy lại; trả token / gia hạn chứng thư thì dừng nhắc mốc cũ.
7. Migration giữ nguyên số bản ghi, token cũ chuyển đúng trường, `credential-key check` đạt trên bản sao demo; dump → restore → check đạt với khoá đúng, báo lỗi rõ với khoá sai; rotate xong check đạt.
8. Lint/unit/e2e (chia lô)/access/web test/build/max-lines đạt; giao diện desktop và 375px.

## Còn mở sau 09

- Danh mục loại tài khoản tuỳ biến (11); ô cảnh báo token trên tổng quan / báo cáo token (10).
- Nhắc qua Zalo theo QD09 (06).

## Tiến độ triển khai

- **09-B — dữ liệu và API: đã code và kiểm chứng kỹ thuật 30/10/2026** (xem mục Kiểm chứng 09-B ở [hiện trạng](../planning/current-status.md)).
  - Schema tách sang `prisma/schema/client-credentials.prisma`; migration `20261030090000_client_credentials_vault`: trường token (nhà cung cấp, serial, nơi giữ, người mượn, hạn trả), người/lúc đổi mật khẩu, ghi chú lỗi, `revision`, bảng `credential_events`, chỉ mục duy nhất serial (token chưa xoá). Token cũ: serial ← tên đăng nhập, nhà cung cấp suy từ nhãn, nơi giữ "Chưa xác định"; mỗi bản ghi một sự kiện "Tạo" đánh dấu chuyển đổi.
  - API mới: `GET /:id` (chi tiết + lịch sử), `GET /:id/access-log`, `POST /:id/secret` (VIEW/COPY), `report-issue`, `borrow`, `return`, `hand-over`, `custody`; `PATCH` cần `revision`, `DELETE` cần `revision` + `reason`; `/reveal` giữ làm bí danh VIEW.
  - Giao diện cũ chỉ được sửa tối thiểu (gửi `revision` khi sửa). **Tạo token theo trường mới, xoá có lý do, mượn/trả, nhật ký: chờ 09-D** — trước đó nút Xoá và form token cũ trên giao diện sẽ báo lỗi 400.
- **09-C — nhắc hạn qua 06: đã code và kiểm chứng kỹ thuật 30/10/2026.** File `notifications/credential-reminders.ts` (nguồn nhắc `CREDENTIAL`, gọi trong `ReminderService.plan`; huỷ email chờ trong `reminder-cancel.ts`):
  - Hạn token / tài khoản: mốc `EXP:D-30`, `EXP:D-7`, `EXP:D-1`, `EXP:D0` (không có mốc quá hạn); người nhận người phụ trách KH + người đang mượn; email ở D-1 và D0 (theo I10 của 06), tiêu đề ghi số ngày còn lại thực tế.
  - Token mượn: `LOAN:D0` ngày đến hạn trả → người mượn; `LOAN:ESC` từ ngày làm việc đầu tiên sau hạn trả → người mượn + người phụ trách KH; đều có email.
  - Gửi bù tối đa 7 ngày như 06; khoá chống trùng của 06; email chờ bị huỷ khi tài khoản xoá, đổi ngày hết hạn, token đã trả hoặc đổi hạn trả. Liên kết `/client-credentials?id=` (giao diện mở thẳng ở 09-D).
- **09-D — giao diện: đã code và kiểm chứng kỹ thuật 30/10/2026.** `/client-credentials` (thành phần `credential-vault` dùng chung với tab "Tài khoản đăng nhập" của hồ sơ KH):
  - Tab **Tài khoản cổng** (lọc KH, loại, trạng thái, sắp hết hạn) và **Chữ ký số (token)** (lọc nơi giữ, sắp hết hạn, mượn quá hạn); cảnh báo đầu trang số tài khoản / token hết hạn trong 30 ngày và token "Chưa xác định" nơi giữ.
  - Ngăn chi tiết: **Xem** hiện 30 giây có đếm ngược rồi tự ẩn, **Sao chép** chép thẳng không hiện; cả hai hỏi xác nhận mật khẩu khi quá 5 phút (QD02). Nút theo nơi giữ và quyền: Mượn / Trả / Giao / Cất tại văn phòng – Đổi nơi cất – Nhận từ khách / Trả khách / Báo lỗi / Xoá (ẩn khi đang mượn). Tab Lịch sử và Nhật ký xem / sao chép (chỉ người có quyền sửa).
  - Biểu mẫu thêm / sửa theo loại (token: nhà cung cấp, serial, hạn, PIN tuỳ chọn, nơi cất; "Khác" bắt buộc tên); hộp thoại thao tác (hạn trả mặc định ngày làm việc kế tiếp, tối đa 30 ngày; báo lỗi / xoá bắt buộc ghi chú / lý do).
  - `?id=` mở thẳng (liên kết trong thông báo nhắc hạn 09-C). Bỏ thành phần `credential-table` cũ.
- **09-E — bảo mật, khoá, nghiệm thu: đã code và kiểm chứng kỹ thuật 30/10/2026.** e2e quét không lộ bí mật (phản hồi API kể cả lỗi 400 / 409, log máy chủ, nhật ký, thông báo, bảng DB); khoá sai → 500 báo rõ, không ghi đã xem; lệnh `credential-key check | rotate` (`src/core/crypto/credential-key.cli.ts`, `npm run credential-key`); thử dump → restore → check khoá đúng / sai → rotate trên bản sao demo; [hướng dẫn vận hành khoá](../operations/credential-key.md); [biên bản kiểm chứng 09](09-client-credentials-acceptance.md) — **chờ người dùng nghiệm thu**.
