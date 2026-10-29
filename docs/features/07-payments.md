# 07 — Thu tiền, công nợ phải thu

Ngày 28/10/2026. **Đã được người dùng duyệt trong chat ngày 28/10/2026 (“Duyệt, làm 07-B”) — đặc tả, J1–J15 theo phương án đề xuất và phạm vi sửa ngoài module đã liệt kê.** 06 đã được nghiệm thu tạm thời ngày 28/10/2026 (tiêu chí 2 và 8 chờ QD07/QD09).

Căn cứ: YC16 (đợt thu, phiếu thu được duyệt, công nợ/tuổi nợ thống nhất, chứng từ, đề nghị thanh toán), YC17 (đối soát ngân hàng Techcombank) trong [phạm vi](../requirements/scope-and-traceability.md); PDF tích hợp mục 3.3 (đợt thanh toán sinh lịch thu, trạng thái thanh toán tự tính từ phiếu thu), 4.4 (lịch thu, phiếu thu tiền mặt/chuyển khoản kèm ảnh chứng từ, thu một phần và tạm ứng, **duyệt bởi KTT hoặc GĐ trước khi tính vào doanh thu đã thu**, công nợ theo KH/HĐ, tuổi nợ 0–30/31–60/61–90/>90, đề nghị thanh toán PDF có VietQR, email nhắc nợ, đối soát sao kê giai đoạn sau), 5.1 (báo cáo công nợ phải thu), phụ lục kiến trúc (ghi phiếu thu và cập nhật công nợ cùng thành công hoặc cùng huỷ); câu hỏi 16 (không đẩy sang MISA/Fast), 17 (Techcombank), 21 (chỉ quản lý và người được phân quyền xem doanh thu, công nợ), 23 (không có cổng khách hàng); **QD03** (người/số cấp duyệt, phân bổ, thừa tiền, huỷ/điều chỉnh, ngày ghi nhận), **QD06** (hoa hồng), **QD09** (Techcombank) trong [sổ quyết định](../requirements/decision-register.md); lỗi **R1** trong [review 22/10](../planning/review-2026-10-22.md).

## Hiện trạng cần thay (mức demo)

- Phiếu thu ghi xong là **tính ngay đã thu**: không có trạng thái Chờ duyệt/Đã duyệt/Đã huỷ, không có người duyệt; xoá phiếu là xoá mềm, không lý do, không giữ dấu vết nghiệp vụ.
- **Bốn cách tính tiền khác nhau**: `payments` (phân bổ theo đợt chỉ định), `contracts` (tổng đã thu, trạng thái thanh toán), `dashboard`, `reports` (quá hạn = tổng đợt quá hạn − toàn bộ tiền thu). **R1**: đợt A quá hạn 1 triệu chưa thu, đợt B chưa đến hạn đã thu chỉ định 1 triệu → màn hình thu tiền báo quá hạn 1 triệu, báo cáo báo **0 đ**.
- Phân bổ tính lại mỗi lần đọc, không lưu; "hôm nay" dùng ngày UTC thay vì giờ VN; không có tuổi nợ theo KH, không đối soát KH–HĐ–đợt–phiếu.
- Không đính kèm chứng từ, không đề nghị thanh toán có QR, không nhắc nợ, không đối soát ngân hàng.
- Mẫu Word "Đề nghị thanh toán" (04-C) đã có nhưng chưa gắn đợt thu và mã QR.

## Câu chuyện người dùng

1. **Kế toán thu tiền** lập phiếu thu cho một đợt của HĐ (tiền mặt/chuyển khoản, ngày tiền về, số tiền, chứng từ) và gửi duyệt.
2. **Giám đốc (hoặc KTT được cấp quyền)** xem hàng chờ duyệt, đối chiếu chứng từ, duyệt hoặc trả lại có lý do; chỉ phiếu đã duyệt mới tính đã thu.
3. **Giám đốc/KTT/Kế toán thu tiền** xem công nợ theo KH và HĐ, tuổi nợ, khoản sắp đến hạn và quá hạn — **cùng một con số** ở màn hình thu tiền, chi tiết HĐ, KH, dashboard, báo cáo và file xuất.
4. **Kế toán thu tiền** xuất đề nghị thanh toán có mã VietQR cho đợt đến hạn và gửi email nhắc nợ cho khách theo mẫu.
5. **Người phụ trách thu** được nhắc trong ứng dụng khi đợt sắp đến hạn/quá hạn (dùng cơ chế nhắc 06).
6. **Giám đốc** huỷ một phiếu đã duyệt nhập sai (có lý do), công nợ tự khôi phục, lịch sử còn nguyên.

## Phạm vi

- **Trong phạm vi (module `payments`):** vòng đời phiếu thu và duyệt; phân bổ lưu theo đợt; một quy tắc công nợ/quá hạn/tuổi nợ dùng chung; chứng từ; đề nghị thanh toán + VietQR; email nhắc nợ; nhắc nội bộ đợt đến hạn; màn hình thu tiền, hàng chờ duyệt, công nợ; schema/migration/seed; test.
- **Phạm vi ngoài module xin duyệt cùng đặc tả:**
  - `contracts` (04): trạng thái thanh toán, tab/khối thanh toán trên chi tiết HĐ, kiểm tra phụ lục giảm giá trị và tái ký đọc **số đã thu đã duyệt** từ quy tắc chung; đợt "đến hạn theo mốc phát hành BCKT" nếu J10 được chọn. Hồi quy e2e 04.
  - `customers` (02): khối công nợ trên chi tiết KH đọc quy tắc chung.
  - `dashboard`, `reports` (10): **sửa R1** — doanh thu đã thu, công nợ, quá hạn, tuổi nợ và export dùng quy tắc chung; không đổi công thức doanh thu HĐ/VAT. Hồi quy e2e 10.
  - `notifications` (06): loại nhắc "Đợt thu đến hạn/quá hạn" cho người phụ trách thu (J11); dùng lại nhật ký gửi, chống trùng, email.
  - `documents` (02): nhóm hồ sơ mới **"Chứng từ thu tiền"** cho file chứng từ (giữ quy tắc kho hồ sơ 02).
  - `access-control` (01): `payments:approve` cho GĐ (đã có trong bảng hành động); bỏ `payments:delete` của thu tiền (thay bằng huỷ có duyệt — J5). E2e phân quyền 5 vai trò + vai trò tuỳ chỉnh.
  - Thư viện mới (nếu J9 chọn PDF): sinh PDF đề nghị thanh toán và ảnh QR (`qrcode`; PDF qua thư viện được chọn ở J9). Chạy `npm audit --omit=dev`.
- **Ngoài phạm vi 07 lõi:** tích hợp API Techcombank (07-E, chờ QD09 — J13); hoa hồng (chờ QD06 — J14); hoá đơn và đối chiếu thu/xuất (08); phiếu chi hoàn tiền; đẩy sang MISA/Fast (câu 16: không); cổng khách hàng (câu 23: không); khoá sổ kỳ kế toán.

## Quyết định cần duyệt

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| J1 | Ai duyệt phiếu thu, mấy cấp? (QD03) | **Một cấp.** Kế toán thu tiền lập phiếu → **Chờ duyệt**; người có `payments:approve` duyệt (mặc định **Giám đốc**; KTT được cấp qua vai trò tuỳ chỉnh nếu công ty muốn). **Người lập không tự duyệt** phiếu của mình (như R3 ở 05). Trả lại có lý do → người lập sửa và gửi lại | Hai cấp (KTT rồi GĐ); hoặc KTT duyệt mặc định |
| J2 | Phiếu chưa duyệt có tính đã thu? | **Không.** Chỉ phiếu Đã duyệt tính vào đã thu, công nợ, doanh thu đã thu, trạng thái thanh toán HĐ. Phiếu Chờ duyệt hiện riêng ("đang chờ duyệt: X đ") ở HĐ và màn hình công nợ để tránh thu trùng | Tính cả phiếu chờ duyệt |
| J3 | Ngày ghi nhận | **Ngày thu = ngày tiền về** (ngày trên chứng từ/sao kê, không sau hôm nay giờ VN) — dùng cho doanh thu đã thu theo kỳ và tuổi nợ; **ngày duyệt** lưu riêng để tra cứu. Phiếu duyệt muộn vẫn tính vào kỳ của ngày thu | Ngày duyệt là ngày ghi nhận |
| J4 | Phân bổ tiền vào đợt (R1) | Phiếu **chỉ định đợt** → vào đợt đó trước, phần dư sang đợt **hạn sớm nhất** còn thiếu; phiếu **không chỉ định** → lần lượt từ đợt hạn sớm nhất. Phân bổ được **lưu** (`payment_allocations`) lúc duyệt, mọi màn hình/báo cáo/export **đọc cùng bảng này** qua một service chung. Tình huống R1 phải ra quá hạn **1 triệu** ở mọi nơi | Tính lại khi đọc bằng một hàm chung (không lưu) |
| J5 | Huỷ / điều chỉnh | Phiếu **Chờ duyệt**: người lập sửa hoặc rút. Phiếu **Đã duyệt**: không sửa; người có `payments:approve` **huỷ có lý do** → trạng thái Đã huỷ, gỡ phân bổ, công nợ khôi phục, giữ bản ghi và chứng từ; cần đúng thì lập phiếu mới. Không xoá cứng | Cho sửa số tiền phiếu đã duyệt kèm lịch sử |
| J6 | Thu vượt / thừa tiền | **Chặn** tổng phiếu (chờ duyệt + đã duyệt) vượt số còn phải thu của HĐ. Khách trả gộp nhiều HĐ trong một lần chuyển khoản → lập **nhiều phiếu**, dùng chung một file chứng từ | Ghi "tiền trả trước" treo, phân bổ sau |
| J7 | Thu cho HĐ ở trạng thái nào? | HĐ **đã duyệt** (Chưa thực hiện, Đang thực hiện, Đã hoàn thành, Thanh lý còn nợ). Không thu HĐ Nháp/Chờ duyệt/Huỷ. Tạm ứng là một **đợt** trong HĐ (04) | Cho lập phiếu tạm ứng khi HĐ Chờ duyệt, chỉ duyệt được sau khi HĐ duyệt |
| J8 | Chứng từ bắt buộc? | **Chuyển khoản**: bắt buộc ít nhất 1 file (ảnh/PDF sao kê, uỷ nhiệm chi) khi gửi duyệt. **Tiền mặt**: bắt buộc số phiếu thu giấy/biên nhận; file khuyến nghị. File lưu kho hồ sơ 02 nhóm "Chứng từ thu tiền", quyền xem theo `payments:view` + phạm vi KH | Không bắt buộc chứng từ |
| J9 | Đề nghị thanh toán | Sinh từ **mẫu Word "Đề nghị thanh toán" (04-C)** cho một hoặc nhiều đợt, chèn **ảnh VietQR** (STK, ngân hàng từ cấu hình công ty; số tiền; nội dung chuyển khoản chứa **mã HĐ** — phục vụ đối soát J13). Xuất **DOCX ngay**; **PDF** dùng chung bộ chuyển đổi khi làm E4 (đã duyệt hoãn sang đợt B) | Sinh PDF trực tiếp bằng thư viện PDF riêng (thêm thư viện, mẫu không sửa được bằng Word) |
| J10 | Hạn đợt cuối của HĐ kiểm toán thường theo **phát hành báo cáo** | Thêm tuỳ chọn đợt **"đến hạn sau phát hành BCKT N ngày"** (dùng mốc phát hành 04-F): trước khi phát hành đợt ở trạng thái "Chờ mốc", **không tính quá hạn**; khi phát hành, hạn = ngày phát hành + N. Đợt thường vẫn theo ngày cố định | Chỉ hạn theo ngày; người dùng tự sửa hạn qua phụ lục |
| J11 | Nhắc nợ | **Nội bộ (tự động, qua 06):** nhắc **các tài khoản Kế toán thu tiền** (có `payments:create`, phạm vi toàn công ty) và **người phụ trách HĐ** khi đợt còn 7 ngày, đến hạn, quá hạn 1 ngày; leo thang GĐ khi quá hạn 30 ngày (một lần). **Khách hàng (thủ công):** kế toán thu tiền xem trước và bấm gửi email theo mẫu, kèm đề nghị thanh toán; ghi nhật ký gửi; không tự động gửi email cho khách | Tự động email khách theo lịch |
| J12 | Công nợ và tuổi nợ | Đơn vị là **đợt**; công nợ = đợt đến hạn − phân bổ đã duyệt; tuổi tính theo **ngày VN** từ hạn đợt: *Chưa đến hạn*, 1–30, 31–60, 61–90, >90 ngày. Xem theo KH và HĐ, tổng theo nhóm tuổi; đợt HĐ **Huỷ** chưa thu không còn là công nợ | Tuổi nợ tính từ ngày phát hành hoá đơn (phụ thuộc 08) |
| J13 | Đối soát ngân hàng (YC17) | **07-E (sau 07 lõi):** nhập **sao kê Excel Techcombank**, tự gợi ý khớp theo **mã HĐ trong nội dung chuyển khoản** + số tiền, tạo phiếu **Chờ duyệt** kèm dòng sao kê làm chứng từ; chống nhập trùng dòng sao kê. Tích hợp API khi có QD09. **Không báo hoàn tất YC17** chỉ với nhập Excel | Bỏ 07-E, chờ API |
| J14 | Hoa hồng (QD06) | **Không làm trong 07**; 07 lưu đủ dữ liệu (phiếu đã duyệt, ngày thu, HĐ, người giới thiệu từ 04) để tính khi có công thức | Tính tạm theo % cố định |
| J15 | Dữ liệu phiếu thu cũ (demo) | Migration chuyển thành **Đã duyệt — "dữ liệu chuyển đổi"** (không có người duyệt, không bịa lịch sử), phân bổ tính một lần theo J4 rồi lưu; báo cáo số phiếu/số tiền trước–sau trên bản sao demo | Để Chờ duyệt, bắt duyệt lại toàn bộ |

## Quyền

| Thao tác | Quyền | GĐ | KTT/Trưởng nhóm | Nhân viên | Thu tiền | Quản trị |
| --- | --- | --- | --- | --- | --- | --- |
| Xem phiếu thu, công nợ, tuổi nợ (theo phạm vi KH) | `payments:view` | Toàn công ty | Phạm vi nhóm | — | Toàn công ty | — |
| Lập, sửa, rút phiếu Chờ duyệt; tải chứng từ; đề nghị thanh toán; gửi email nhắc nợ | `payments:create` | ✓ | — | — | ✓ | — |
| Duyệt, trả lại, huỷ phiếu đã duyệt | `payments:approve` | ✓ | (cấp qua vai trò tuỳ chỉnh) | — | — | — |
| Xuất Excel công nợ/phiếu thu | `payments:export` | ✓ | — | — | ✓ | — |

- Kiểm tra theo **quyền hiệu lực** (vai trò tuỳ chỉnh), không tự duyệt phiếu của mình; ngoài phạm vi → 404, thiếu quyền → 403. Nhân viên vẫn **không thấy tiền** (giữ `financial-fields` 01).
- Bỏ `payments:delete` của vai trò Thu tiền (thay bằng rút phiếu chờ duyệt / huỷ có duyệt).

## Dữ liệu (dự kiến)

| Bảng | Nội dung chính |
| --- | --- |
| `payments` (sửa) | thêm trạng thái **Chờ duyệt / Đã duyệt / Trả lại / Đã huỷ**, số chứng từ (phiếu giấy/mã giao dịch), người duyệt/lúc duyệt, lý do trả lại/huỷ, người huỷ/lúc huỷ, `revision`; ngày thu (J3) giữ `paid_date` |
| `payment_allocations` | phiếu × đợt × số tiền; chỉ có khi phiếu Đã duyệt; tổng theo đợt ≤ số tiền đợt (kiểm ở service, khoá dòng) |
| `payment_events` | lịch sử: tạo, gửi duyệt, trả lại, duyệt, huỷ — người, lúc, lý do |
| `payment_documents` | phiếu ↔ tài liệu kho 02 (một file dùng cho nhiều phiếu — J6) |
| `payment_installments` (sửa, 04) | `due_rule` (theo ngày / sau phát hành BCKT + N ngày — J10), `due_offset_days` |
| `collection_reminders` | nhật ký email nhắc nợ gửi khách: đợt, người gửi, địa chỉ, nội dung, trạng thái gửi |

Chỉ thêm cột/bảng; khoá duy nhất số phiếu như hiện tại (`PT-YYYY-NNN`).

## Quy tắc tính

- **Đã thu** của HĐ = tổng phiếu **Đã duyệt**; **đang chờ duyệt** = tổng phiếu Chờ duyệt; **còn phải thu** = tổng HĐ − đã thu.
- **Phân bổ** theo J4, lưu khi duyệt, gỡ khi huỷ; tiền dùng `Prisma.Decimal`; ghi phiếu, phân bổ, lịch sử trong **một transaction** có khoá HĐ (hai phiếu duyệt đồng thời không vượt số còn phải thu).
- **Quá hạn** của đợt = số tiền đợt − phân bổ, khi hạn < hôm nay (giờ VN, như 06); đợt "Chờ mốc" (J10) không quá hạn. **Tuổi nợ** theo J12. **Trạng thái thanh toán HĐ**: Chưa thanh toán / Đã thu một phần / Đã thanh toán đủ / Còn nợ quá hạn.
- Một service `receivables` duy nhất trả các số trên; `contracts`, `customers`, `dashboard`, `reports` và export gọi service này (sửa R1).

## Màn hình

- **Thu tiền** (`/payments`): tab **Phiếu thu** (lọc trạng thái/KH/HĐ/kỳ/hình thức, xem chứng từ), **Chờ duyệt** (người duyệt: duyệt/trả lại), **Công nợ** (theo KH → HĐ → đợt; cột tuổi nợ; ô đếm: phải thu, quá hạn, sắp đến hạn 7 ngày, đang chờ duyệt), **Sắp đến hạn / Quá hạn** (danh sách đợt, tạo phiếu, đề nghị thanh toán, gửi nhắc nợ).
- **Form phiếu thu**: chọn HĐ → đợt (gợi ý số còn thiếu của đợt), hình thức, ngày thu, số chứng từ, file chứng từ, ghi chú; cảnh báo nếu có phiếu chờ duyệt cùng đợt.
- **Chi tiết phiếu**: trạng thái, phân bổ theo đợt, chứng từ, lịch sử, nút theo quyền.
- **Chi tiết HĐ (04)**: khối Thanh toán đọc quy tắc chung (đợt, đã thu, chờ duyệt, quá hạn); **chi tiết KH (02)**: khối công nợ.
- **Đề nghị thanh toán**: chọn đợt → xem trước số tiền, QR → tạo DOCX (lưu kho hồ sơ HĐ) → tải / đính kèm email nhắc nợ.

## API (dự kiến)

| Phương thức | Đường dẫn | Ai |
| --- | --- | --- |
| GET | `/payments` (lọc, phân trang), `/payments/:id` | `payments:view` |
| POST/PATCH | `/payments`, `/payments/:id` (chỉ Chờ duyệt/Trả lại), `/payments/:id/documents` (multipart) | `payments:create` |
| POST | `/payments/:id/submit`, `/withdraw` | `payments:create` (người lập) |
| POST | `/payments/:id/approve`, `/return`, `/cancel` | `payments:approve` (không phải người lập) |
| GET | `/receivables` (theo KH/HĐ, tuổi nợ), `/receivables/summary`, `/receivables/installments?due=upcoming|overdue` | `payments:view` |
| POST | `/installments/:id/payment-request` (DOCX + QR), `/installments/:id/reminder-email` (xem trước + gửi) | `payments:create` |
| GET | `/payments/export`, `/receivables/export` (XLSX) | `payments:export` |

Mọi lệnh ghi kiểm tra `revision`/trạng thái (đồng thời → 409) và ghi audit.

## Luồng lỗi chính

- Số tiền ≤ 0, vượt số còn phải thu (tính cả phiếu chờ duyệt), ngày thu sau hôm nay, đợt không thuộc HĐ, HĐ chưa duyệt/đã huỷ → 400.
- Chuyển khoản thiếu chứng từ / tiền mặt thiếu số phiếu khi gửi duyệt → 400.
- Người lập tự duyệt → 403; duyệt/huỷ phiếu đã đổi trạng thái (đồng thời) → 409.
- Huỷ phiếu không lý do → 400. Phụ lục (04) giảm giá trị đợt xuống dưới số đã phân bổ → 400 như 04-D, nay đọc phân bổ đã duyệt.

## Tiêu chí nghiệm thu

1. Phiếu Chờ duyệt không tính đã thu ở bất kỳ đâu; duyệt xong số liệu cập nhật ngay ở thu tiền, HĐ, KH, dashboard, báo cáo, export.
2. **R1**: đợt A quá hạn 1 triệu chưa thu, đợt B chưa đến hạn thu chỉ định 1 triệu → quá hạn **1 triệu** ở mọi API/màn hình/export (test hồi quy viết trước khi sửa).
3. Phân bổ theo J4 đúng với: chỉ định, không chỉ định, dư sang đợt khác, nhiều phiếu một đợt, huỷ phiếu giữa chừng; tổng phân bổ một đợt không vượt số tiền đợt.
4. Hai người duyệt/huỷ đồng thời, hai phiếu cùng lúc chạm giới hạn còn phải thu → chỉ một thành công (409/400), không thu vượt.
5. Người lập không tự duyệt; trả lại/huỷ bắt buộc lý do; lịch sử bất biến; không xoá cứng.
6. Chứng từ theo J8; file vào kho hồ sơ 02 đúng nhóm, quyền xem theo phạm vi.
7. Công nợ và tuổi nợ theo J12 khớp từng đợt với **bộ số liệu mẫu do Kế toán thu tiền xác nhận** (QD03); tổng theo KH = tổng các HĐ.
8. Đề nghị thanh toán DOCX có đúng số tiền, nội dung chuyển khoản chứa mã HĐ, mã VietQR quét được bằng app ngân hàng (kiểm bằng app thật trên môi trường thử).
9. Nhắc nội bộ đợt đến hạn/quá hạn không trùng (cơ chế 06); email nhắc nợ khách chỉ gửi khi người dùng bấm, có nhật ký.
10. J10 (nếu chọn): đợt "sau phát hành BCKT" không quá hạn trước khi phát hành; phát hành → hạn đúng N ngày sau.
11. Migration J15 trên DB trống và bản sao demo: số phiếu, tổng tiền đã thu từng HĐ không đổi; Prisma diff sạch.
12. Phân quyền theo bảng cho 5 vai trò + vai trò tuỳ chỉnh (cấp/thu); nhân viên không thấy tiền; hồi quy e2e 02/04/10; coverage service tiền ≥ 70%; lint/unit/e2e/build/max-lines đạt; giao diện desktop và 375px.

## Test hồi quy và thay đổi test cũ

- Viết test R1 (unit `receivables` + e2e báo cáo/dashboard) **trước khi sửa**; không đổi fixture để che sai số.
- Test cũ của `payments`, `reports`, `dashboard`, `contracts` dùng phiếu thu "tạo là tính": khi chuyển sang có duyệt, fixture tạo phiếu sẽ thêm bước duyệt — ghi lý do từng file ở `07-test-policy-changes.md` **trước khi đổi**, giữ kỳ vọng số tiền.
- `permissions.spec`: bỏ `payments:delete` của thu tiền là thay đổi quyền được duyệt ở J5 — ghi giải trình.

## Đầu vào cần từ người dùng

- **QD03:** xác nhận J1–J8, J12 (người duyệt, chứng từ, phân bổ, ngày ghi nhận); **bộ số liệu mẫu** vài HĐ (đợt, phiếu, ngày) với công nợ/tuổi nợ đúng do Kế toán thu tiền xác nhận (tiêu chí 7).
- **Mẫu Word "Đề nghị thanh toán"** và **mẫu email nhắc nợ** của công ty (nếu khác mẫu ví dụ 04-C); thông tin tài khoản nhận tiền chính thức (STK, ngân hàng, tên chủ TK) cho VietQR.
- **QD09 / J13:** file sao kê Excel Techcombank mẫu (đã che thông tin nhạy cảm) nếu làm 07-E; tài liệu API khi có.
- **QD06:** công thức hoa hồng (khi có, làm ở phần mở rộng 07/10).

## Phân kỳ triển khai

1. **07-A:** người dùng duyệt đặc tả, J1–J15 và phạm vi ngoài module.
2. **07-B Quy tắc chung, R1:** test R1 trước; bảng phân bổ; service `receivables` dùng chung; chuyển `contracts`/`customers`/`dashboard`/`reports`/export sang service; giờ VN.
3. **07-C Vòng đời phiếu:** trạng thái, duyệt/trả lại/huỷ, không tự duyệt, khoá đồng thời, chứng từ, lịch sử, migration J15, quyền.
4. **07-D Công nợ, đề nghị thanh toán, nhắc nợ:** tuổi nợ, màn hình công nợ/sắp đến hạn/quá hạn, đề nghị thanh toán DOCX + VietQR, email nhắc nợ, nhắc nội bộ qua 06, J10; kiểm chứng và biên bản `07-payments-acceptance.md`.
5. **07-E (mở rộng):** nhập sao kê Techcombank + gợi ý khớp (J13); API khi có QD09. Hoa hồng khi có QD06.

## Tiến độ triển khai

### 07-B Quy tắc công nợ chung, sửa R1 — đã code và kiểm chứng kỹ thuật (28/10/2026)

- **Schema** (migration `20261028090000_payment_allocations`): bảng `payment_allocations` (phiếu × đợt × số tiền, duy nhất phiếu × đợt, xoá theo phiếu/đợt). Migration **tính phân bổ cho phiếu hiện có** (PL/pgSQL, cùng thứ tự với code); trên bản sao demo `ketoan_mig_07b`: 7 phiếu / 787.000.000 đ, phân bổ do migration tạo **trùng khớp** phân bổ do code tính lại; Prisma diff sạch.
- **Quy tắc chung** `common/receivables.ts` (hàm thuần): `allocateContract` (J4 — lần lượt từng phiếu theo thứ tự ghi nhận; chỉ định đợt trước, phần dư và phiếu không chỉ định vào đợt hạn sớm nhất còn trống theo hạn → thứ tự đợt), `summarizeReceivable` (đã thu, còn phải thu, quá hạn theo phân bổ, ngày quá hạn, tuổi nợ), `agingBucket`.
- **`payments/payment-allocation.ts`**: `COUNTED_PAYMENT` (điều kiện phiếu được tính — 07-C thêm "Đã duyệt" tại đây), `INSTALLMENT_BALANCE_SELECT`, `contractReceivable`, `reallocateContract` (khoá dòng HĐ, xoá và ghi lại phân bổ toàn HĐ).
- **Ghi:** tạo/xoá phiếu thu chạy trong transaction có khoá HĐ (hai phiếu đồng thời không vượt số còn phải thu) rồi phân bổ lại; **sửa HĐ** (tạo lại đợt) và **áp phụ lục** (đổi lịch đợt) phân bổ lại trong cùng transaction; seed phiếu mẫu phân bổ sau khi ghi.
- **Đọc (sửa R1):** công nợ màn hình thu tiền, báo cáo công nợ, chi tiết HĐ (tiền đã thu từng đợt), kiểm tra phụ lục (đợt đã thu), danh sách HĐ, dashboard, bảng theo dõi kiểm toán (04-F) đều đọc phân bổ đã lưu / `COUNTED_PAYMENT`. "Hôm nay" của công nợ thu tiền theo giờ VN (trước đây ngày UTC).
- **Làm rõ khi code (không đổi quyết định đã duyệt):** phân bổ "lưu" (J4) được ghi lại **toàn HĐ** mỗi khi phiếu hoặc lịch đợt đổi (xác định theo thứ tự phiếu), vì sửa HĐ/phụ lục (04) xoá và tạo lại đợt; khi có duyệt (07-C) thứ tự là thứ tự ghi nhận phiếu. Tiền thu vượt tổng các đợt (HĐ không có đợt) vẫn tính đã thu của HĐ, không gắn đợt.
- Test: e2e `receivables-consistency` (2 — R1 đỏ trước khi sửa: báo cáo trả 0 đ; phiếu không chỉ định và xoá phiếu khôi phục ở mọi nơi); unit `common/receivables.spec` (9, gồm các test chuyển từ 3 file cũ). Thay đổi test cũ: [giải trình](07-test-policy-changes.md).

### 07-C Vòng đời phiếu thu — đã code và kiểm chứng kỹ thuật (29/10/2026)

- **Schema** (migration `20261028150000_payment_lifecycle`): trạng thái phiếu `DRAFT/PENDING/RETURNED/APPROVED/CANCELLED`, số chứng từ, người/lúc gửi, duyệt, huỷ, lý do trả lại/huỷ, `revision` (khoá lạc quan), cờ `migrated`; bảng `payment_events` (lịch sử) và `payment_documents` (chứng từ ↔ kho tài liệu 02, nhóm mới **Chứng từ thu tiền**). **J15:** phiếu còn hiệu lực → Đã duyệt, phiếu đã xoá mềm → Đã huỷ (đánh dấu `migrated`). Trên bản sao demo `ketoan_mig_07c` (từ `ketoan_mig_07b`): 7 phiếu / 787.000.000 đ → 7 Đã duyệt / 787.000.000 đ, phân bổ giữ nguyên 7 dòng / 787.000.000 đ; Prisma diff rỗng.
- **API** (`payments`): lập (Nháp), sửa (người lập, Nháp/Trả lại), đính kèm/gỡ chứng từ (tải file mới hoặc dùng lại "Chứng từ thu tiền" của cùng KH), gửi duyệt (J8), rút, duyệt (không phải người lập — J1; kiểm lại tổng đã duyệt không vượt), trả lại (lý do 5–500), huỷ phiếu đã duyệt (lý do — J5); `DELETE` trả 410. Mọi chuyển trạng thái trong transaction có khoá HĐ + `revision` (duyệt đồng thời: một 200, một 409), ghi sự kiện và nhật ký; vào/ra Đã duyệt thì phân bổ lại HĐ. `COUNTED_PAYMENT` = Đã duyệt; giới hạn thu vượt (J6) tính phiếu Nháp/Chờ duyệt/Trả lại/Đã duyệt; chỉ thu HĐ đã duyệt (J7); ngày thu không sau hôm nay giờ VN (J3). Chi tiết HĐ và công nợ thêm `pendingAmount` (J2, ẩn với người không có quyền tài chính).
- **Quyền (01):** bỏ `payments:delete` của Kế toán thu tiền; GĐ cấp được `payments:approve` cho vai trò tuỳ chỉnh **nền Quản lý** (KTT — J1), vai trò nền khác bị từ chối.
- **Giao diện:** màn hình Thu tiền — tab Phiếu thu (lọc trạng thái, kỳ, tìm theo số chứng từ), **Chờ duyệt** (đếm trên nhãn), Công nợ (thêm cột Chờ duyệt); ngăn chi tiết phiếu (phân bổ, chứng từ, lịch sử, thao tác theo trạng thái/quyền, người duyệt là người lập thì không có nút duyệt); form lập/sửa (số chứng từ, file, "Lưu nháp" / "Lưu và gửi duyệt" — gửi bị từ chối vẫn giữ nháp và báo lý do). Chi tiết HĐ: bỏ nút xoá phiếu, cột trạng thái, "Đã thu (đã duyệt)" và "Chờ duyệt", bấm phiếu mở chi tiết.
- **Làm rõ khi code (không đổi quyết định đã duyệt):** thêm trạng thái **Nháp** trước Chờ duyệt để đính kèm chứng từ trước khi gửi (Nháp không tính đã thu, có tính giới hạn J6); **rút phiếu** (người lập, phiếu chưa duyệt) chuyển Đã huỷ, giữ lịch sử; vai trò tuỳ chỉnh có `payments:approve` cần cả `finance:view` mới thao tác được trên số tiền (quy tắc ẩn tiền của 01); phân bổ theo thứ tự **lúc duyệt**; chi tiết HĐ không liệt kê phiếu Đã huỷ (màn hình Thu tiền vẫn xem được).
- Test: e2e `payments-lifecycle` (5: Nháp không tính, giới hạn, rút; J8 và dùng lại chứng từ; J1 không tự duyệt, trả lại → sửa → gửi lại, lịch sử; duyệt đồng thời, huỷ khôi phục công nợ, 410; quyền 5 vai trò + vai trò tuỳ chỉnh cấp/thu); `users-access` (cấp `payments:approve` chỉ cho nền Quản lý); unit `payment.rules.spec` (5); web `payments.store.spec` (6), `payment-drawer.component.spec` (4). Thay đổi test cũ: [giải trình](07-test-policy-changes.md#07-c-29102026--vòng-đời-phiếu-thu).
- **Chưa làm (07-D):** tuổi nợ và màn hình Sắp đến hạn / Quá hạn, ô đếm công nợ, đề nghị thanh toán DOCX + VietQR, email nhắc nợ, nhắc nội bộ qua 06; tab Công nợ hiện vẫn là bản cũ (gọi API trực tiếp), làm lại ở 07-D.

### 07-D Công nợ, đề nghị thanh toán, nhắc nợ — đang làm (chia 4 bước, mỗi bước kiểm chứng riêng)

1. **07-D1 Công nợ và tuổi nợ (J12):** API công nợ thêm đợt còn nợ của từng HĐ, tuổi nợ theo **số tiền từng đợt** (Chưa đến hạn / 1–30 / 31–60 / 61–90 / >90), số sắp đến hạn 7 ngày; API danh sách đợt **sắp đến hạn / quá hạn**; xuất Excel công nợ và phiếu thu (`payments:export`); màn hình Thu tiền: tab Công nợ làm lại (ô đếm phải thu / quá hạn / sắp đến hạn / chờ duyệt, nhóm KH → HĐ → đợt, tổng theo tuổi nợ), tab Sắp đến hạn / Quá hạn (lập phiếu từ đợt); khối công nợ ở chi tiết KH (02).
2. **07-D2 Hạn theo phát hành BCKT (J10) và trạng thái "Còn nợ quá hạn" của HĐ.**
3. **07-D3 Đề nghị thanh toán DOCX + VietQR (J9).**
4. **07-D4 Nhắc nợ (J11):** email nhắc nợ khách (xem trước, bấm gửi, nhật ký `collection_reminders`), nhắc nội bộ đợt đến hạn/quá hạn qua 06; biên bản `07-payments-acceptance.md`.

#### 07-D1 Công nợ và tuổi nợ — đã code và kiểm chứng kỹ thuật (29/10/2026)

- **Quy tắc chung** (`common/receivables.ts`): `installmentStates` (còn thiếu, số ngày đến hạn / quá hạn, nhóm tuổi của **từng đợt**), `agingOf` (tuổi nợ một HĐ: phần quá hạn chia theo tuổi từng đợt, "Chưa đến hạn" = còn phải thu − quá hạn, gồm phần chưa gắn đợt → tổng các nhóm = còn phải thu), `upcomingAmount` (đến hạn trong 7 ngày, kể cả hôm nay). `summarizeReceivable` dùng lại `installmentStates`, kết quả cũ không đổi.
- **API:** `GET /payments/receivables` thêm người phụ trách HĐ, đợt còn nợ (hạn, còn thiếu, số ngày quá hạn, nhóm tuổi), `aging`, `upcomingAmount` và tổng tương ứng (chỉ thêm trường, không đổi trường cũ); `GET /payments/receivables/installments?due=upcoming|overdue&days=` (đợt sắp đến hạn trong N ngày, mặc định 7, hoặc quá hạn); `GET /payments/receivables/export` và `GET /payments/export` (Excel, `payments:export`, tiền là ô số). Phần công nợ tách sang `ReceivablesQueryService`. Bộ tạo Excel dùng chung (`common/types/xlsx-workbook.ts`) thêm ô số và tên sheet — nhật ký hoạt động giữ nguyên.
- **Giao diện:** tab Công nợ làm lại — ô đếm (phải thu, quá hạn, đến hạn 7 ngày tới, đang chờ duyệt), thanh tuổi nợ, bảng KH → HĐ → đợt (mở dòng KH), xuất Excel; tab **Sắp đến hạn / Quá hạn** (chọn số ngày, tổng còn thiếu, dấu "có phiếu chờ duyệt", **Lập phiếu** từ đợt — form chọn sẵn đợt và số còn thiếu); tab Phiếu thu thêm Xuất Excel; chi tiết KH (02) thêm tab **Công nợ** (người có `payments:view`).
- **Sửa lỗi 07-C phát hiện khi chạy hồi quy:** hai người duyệt cùng lúc, nếu lượt sau đọc phiếu khi lượt trước đã ghi xong thì nhận 400 ("không thể thao tác với phiếu Đã duyệt") thay vì 409. Nay mọi thao tác vòng đời so `revision` trước trạng thái → bản cũ luôn 409; thêm kiểm tra tất định trong `payments-lifecycle`.
- Test: e2e `receivables-aging` (4: tuổi nợ theo đợt, chờ duyệt, sắp đến hạn; danh sách quá hạn / sắp đến hạn 7 và 30 ngày, bộ lọc sai 400; Excel: Kế toán thu tiền/GĐ 200, KTT/nhân viên 403; nhân viên 403); unit `common/receivables.spec` +5; web `receivables.store.spec` (3), `due-installment-table.component.spec` (2). Không đổi test cũ.

#### 07-D2 Hạn theo phát hành BCKT (J10), trạng thái "Còn nợ quá hạn" — đã code và kiểm chứng kỹ thuật (29/10/2026)

- **Đợt thu** (`payment_installments`, 04) thêm `due_rule` (`FIXED_DATE` mặc định / `AFTER_REPORT_ISSUE`), `due_offset_days` (N, 1–365), `milestone_date` (ngày phát hành dùng tính hạn). Hạn ngày (`due_date`) vẫn bắt buộc: với đợt theo mốc là **ngày dự kiến** khi chưa phát hành (chỉ để sắp thứ tự, hiển thị "dự kiến").
- **Mốc của HĐ** = mọi dòng dịch vụ phát hành BCKT (cờ 03) của HĐ **đã phát hành**; ngày mốc = ngày phát hành muộn nhất. Chưa đủ → đợt "**Chờ phát hành BCKT**": không quá hạn, không vào "sắp đến hạn", không vào nhóm tuổi quá hạn (tính "Chưa đến hạn"). Khi đủ: hạn = ngày mốc + N (lưu vào `due_date`), phân bổ lại (J4). **Mở lại** BCKT → đợt quay về Chờ phát hành. Chỉ chọn được quy tắc này khi HĐ có dòng dịch vụ phát hành BCKT.
- Đồng bộ chạy trong cùng transaction khi phát hành / mở lại BCKT (04-F), lưu HĐ (tạo lại đợt) và áp phụ lục (đợt cũ giữ quy tắc; đợt mới từ phụ lục theo ngày cố định).
- **Trạng thái thanh toán HĐ** thêm **Còn nợ quá hạn** (`OVERDUE`): chưa thu đủ và có đợt quá hạn theo quy tắc chung — ở danh sách và chi tiết HĐ.
- **Đã làm:** migration `20261029100000_installment_due_rule`; quy tắc chung `reportMilestone`, đợt chờ mốc có `dueInDays = null`; `syncMilestoneDues` gọi khi phát hành / mở lại BCKT, sửa HĐ, áp phụ lục; form HĐ có cột "Hạn theo" (chỉ hiện khi HĐ có dịch vụ phát hành BCKT) và số ngày; chi tiết HĐ hiện "Chờ phát hành BCKT (+N ngày, dự kiến …)", "N ngày sau phát hành …", "Quá hạn N ngày", tổng quá hạn; tab Công nợ hiện "Chờ phát hành BCKT"; thẻ thanh toán danh sách HĐ "Còn nợ quá hạn X".
- **Làm rõ khi code:** HĐ Nháp / Chờ duyệt / Huỷ không bao giờ "Còn nợ quá hạn" (chưa phát sinh công nợ — J7, J12), phát hiện khi thử giao diện; danh sách trạng thái không phát sinh công nợ dùng chung `RECEIVABLE_EXCLUDED`.
- Test: e2e `installment-milestone` (4: chặn quy tắc khi không có dịch vụ BCKT / thiếu số ngày; chờ mốc không quá hạn, HĐ Nháp không quá hạn; phát hành → hạn = ngày phát hành + 15, mở lại → chờ; thu đủ đợt quá hạn → hết "Còn nợ quá hạn"); unit +3; web `contract-form` +1, `payment-tag` 2. Đổi 1 kỳ vọng cũ (`contracts.e2e` PARTIAL → OVERDUE): [giải trình](07-test-policy-changes.md#07-d2-29102026--hạn-theo-phát-hành-bckt-còn-nợ-quá-hạn).

#### 07-D3 Đề nghị thanh toán DOCX + VietQR (J9) — đã code và kiểm chứng kỹ thuật (29/10/2026)

- **Chọn đợt:** một hoặc nhiều đợt còn nợ của **một HĐ đã duyệt**; số tiền = tổng còn thiếu của các đợt (sau phân bổ đã duyệt). Lập từ tab Sắp đến hạn / Quá hạn (một đợt) hoặc từ khối thanh toán ở chi tiết HĐ (chọn nhiều đợt). Quyền `payments:create` (Kế toán thu tiền, GĐ) — không cần quyền sửa HĐ.
- **Mẫu:** mẫu Word "Đề nghị thanh toán" (04-C) **đang dùng mới nhất** (hoặc mẫu chọn); chưa có mẫu thì dùng **mẫu ví dụ** của hệ thống (ghi rõ là mẫu ví dụ). Trường trộn mới nhóm `payment.*`: các đợt, số tiền, bằng chữ, hạn sớm nhất, nội dung chuyển khoản, và ảnh **`{{IMAGE payment.qr}}`** (chỉ lệnh IMAGE cho trường này). Mẫu ví dụ "Đề nghị thanh toán" có sẵn khối này.
- **VietQR:** chuỗi theo chuẩn EMVCo/NAPAS (mã BIN ngân hàng + số tài khoản, dịch vụ chuyển tới tài khoản, số tiền, nội dung, CRC16). Cấu hình mới **`COMPANY_BANK_BIN`** (Techcombank 970407) cùng `COMPANY_BANK_ACCOUNT` (chuyển sang Cài đặt ở 11). Thiếu cấu hình → 400 rõ ràng. Nội dung chuyển khoản không dấu, dạng `TT <mã HĐ>` (phục vụ đối soát J13).
- **Lưu:** file `Đề nghị thanh toán <mã HĐ>.docx` vào kho hồ sơ KH (02), gắn HĐ, loại hồ sơ PAYMENT_REQUEST nguồn GENERATED (hiện ở tab Hồ sơ của HĐ), ghi audit; có API **xem trước** (số tiền, nội dung, ảnh QR) trước khi tạo.
- **Thư viện mới:** `qrcode` (sinh ảnh PNG). PDF vẫn hoãn theo E4.
- **Chưa kiểm được trên máy:** quét mã bằng app ngân hàng thật (tiêu chí 8) — cần người dùng thử với tài khoản thật.
- **Đã làm:** `common/utils/vietqr.ts` (chuỗi EMVCo/NAPAS, CRC16 khớp giá trị kiểm chuẩn), `payment-request.builder.ts` (chọn đợt còn nợ, xem trước, ảnh QR PNG), trường trộn `payment.*` + `{{IMAGE payment.qr}}`, mẫu ví dụ "Đề nghị thanh toán" có khối số tiền và QR; API `POST /payments/payment-requests/preview` và `POST /payments/payment-requests` (`payments:create`); hồ sơ PAYMENT_REQUEST lưu kho 02 gắn HĐ, audit `GENERATE_PAYMENT_REQUEST`. Giao diện: nút "Đề nghị thanh toán" ở khối thu tiền chi tiết HĐ (chọn nhiều đợt, mặc định đợt quá hạn) và "Đề nghị TT" ở tab Sắp đến hạn / Quá hạn; hộp thoại xem trước số tiền, bằng chữ, nội dung CK, tài khoản nhận, ảnh QR; tạo file và tải về. `compose.app.yml` nay truyền `COMPANY_*` (trước đây thiếu nên hồ sơ trên máy chủ không có thông tin công ty).
- **Làm rõ khi code:** mẫu hồ sơ khác (04-C) cũng dùng được nhóm `payment` (mọi đợt còn nợ); chỉ tạo QR khi mẫu có `payment.qr` nên cấu hình ngân hàng sai không chặn hồ sơ khác.
- **Còn mở:** quét mã bằng app ngân hàng thật (tiêu chí 8); `npm audit --omit=dev` báo 5 lỗ hổng ở thư viện có sẵn (multer, body-parser, nodemailer, qs, @nestjs/platform-express — đều có bản sửa), không thuộc `qrcode`, chưa xử lý.
