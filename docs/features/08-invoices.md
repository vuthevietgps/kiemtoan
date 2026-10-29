# 08 — Hoá đơn (sổ hoá đơn nội bộ)

Ngày 29/10/2026. **Đã được người dùng duyệt trong chat ngày 29/10/2026 (“Duyệt, làm 08-B”) — đặc tả, K1–K11 theo phương án đề xuất và phạm vi sửa ngoài module đã liệt kê.** Người dùng chọn trong chat ngày 29/10/2026: làm **sổ nội bộ trước**, tích hợp EasyInvoice để sau; 07-D4 và 07-E hoãn ([sổ quyết định](../requirements/decision-register.md)).

Căn cứ: YC18 trong [phạm vi](../requirements/scope-and-traceability.md) (PDF tích hợp mục 4.5: đề nghị xuất, sổ hoá đơn, phát hành/điều chỉnh/thay thế/huỷ, PDF/XML, đối chiếu đã thu chưa xuất / đã xuất chưa thu); câu hỏi đã trả lời **14** ("Hoá đơn công ty xuất cho khách hàng, dùng để quản lý công nợ nội bộ") và **15** (tích hợp API hoá đơn — easyinvoice.com.vn); **QD09** (EasyInvoice chờ sandbox/quyền API); 04-F (cột Hoá đơn trên bảng theo dõi kiểm toán, câu chuyện "lọc HĐ đã phát hành BCKT chưa có hoá đơn"); 07 (số đã thu đã duyệt).

## Phạm vi nghiệp vụ

- **Là:** hoá đơn GTGT **công ty dịch vụ xuất cho khách hàng** (phí dịch vụ kế toán/kiểm toán theo hợp đồng).
- **Không phải:** hoá đơn đầu vào/đầu ra của khách hàng. Việc làm hoá đơn, kê khai cho khách theo dõi bằng **công việc (05)** và **lịch báo cáo (06)**; tài khoản cổng hoá đơn của khách ở **kho tài khoản (09)**; hệ thống không thay phần mềm kế toán/hoá đơn của khách (câu 16).
- **Sổ nội bộ:** kế toán xuất hoá đơn trên cổng EasyInvoice như hiện nay, rồi **ghi nhận** vào sổ (số, ký hiệu, ngày, file PDF/XML). Phát hành trực tiếp qua API EasyInvoice là **08-E**, chỉ làm khi có sandbox/quyền API.

## Hiện trạng cần thay (mức demo, đang gộp trong 04)

- Bảng `invoices` 3 trạng thái (Đề nghị / Đã phát hành / Huỷ); "phát hành" chỉ nhập số, ký hiệu, ngày; huỷ được cả hoá đơn đã phát hành, không lý do, không lịch sử, không kiểm soát đồng thời.
- Đề nghị chỉ theo **giá trị HĐ**, không gắn **đợt thanh toán**; không có thông tin người mua, không file PDF/XML, không chặn trùng số hoá đơn.
- Không có điều chỉnh / thay thế; không có **đối chiếu thu – xuất**; không xuất Excel.
- Dữ liệu demo: 5 hoá đơn (3 đã phát hành 599.500.000 đ, 2 đề nghị 341.000.000 đ).

## Câu chuyện người dùng

1. **KTT / người phụ trách HĐ / Kế toán thu tiền** lập **đề nghị xuất hoá đơn** cho một hoặc nhiều đợt thanh toán của HĐ (hoặc một phần giá trị HĐ), kèm thông tin người mua lấy sẵn từ khách hàng.
2. **Kế toán thu tiền** xem hàng chờ, xuất hoá đơn trên cổng EasyInvoice, rồi **ghi nhận phát hành**: số, ký hiệu, ngày, tải file PDF (và XML nếu có).
3. Hoá đơn sai → kế toán ghi nhận **hoá đơn điều chỉnh** (tăng/giảm) hoặc **hoá đơn thay thế**, liên kết hoá đơn gốc; sổ luôn đúng số đang hiệu lực.
4. **Giám đốc / KTT / Kế toán thu tiền** xem **đối chiếu thu – xuất** theo KH và HĐ: đã thu chưa xuất hoá đơn, đã xuất chưa thu tiền.
5. **Giám đốc** lọc HĐ đã phát hành BCKT mà chưa có hoá đơn (04-F) — đọc từ sổ mới.

## Phạm vi

- **Trong phạm vi (module `invoices`):** đề nghị xuất, hàng chờ, ghi nhận phát hành, điều chỉnh, thay thế, huỷ đề nghị; file PDF/XML; lịch sử; chặn trùng số; đối chiếu thu – xuất; Excel; màn hình `/invoices`; schema/migration/seed; test.
- **Phạm vi ngoài module xin duyệt cùng đặc tả:**
  - `contracts` (04): tab "Thanh toán & Hoá đơn" của HĐ dùng sổ mới (đề nghị theo đợt, trạng thái, mở chi tiết); "phần giá trị chưa xuất" đọc quy tắc chung của 08; bảng theo dõi kiểm toán 04-F đọc trạng thái hoá đơn mới. Hồi quy e2e 04.
  - `documents` (02): nhóm hồ sơ mới **"Hoá đơn"** cho file PDF/XML (giữ quy tắc kho hồ sơ 02).
  - `payments` (07): chỉ **đọc** số đã thu đã duyệt cho đối chiếu (không đổi quy tắc 07).
  - `access-control` (01): giữ hành động `invoices:view/create/update/export`; xem bảng Quyền.
  - `reports` (10): chưa đổi ở 08 (báo cáo hoá đơn tổng hợp làm ở 10, đọc sổ 08).
- **Ngoài phạm vi 08 (sổ nội bộ):** gọi API EasyInvoice (08-E, QD09); ký số, gửi hoá đơn cho khách qua email từ hệ thống; hoá đơn đầu vào; hoá đơn của khách hàng; đẩy sang MISA/Fast (câu 16).

## Quyết định cần duyệt

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| K1 | Trạng thái hoá đơn | **Chờ xuất** (đề nghị) → **Đã xuất** (đã ghi nhận phát hành) → có thể **Bị thay thế** / **Đã điều chỉnh**; đề nghị chưa xuất có thể **Huỷ đề nghị** (có lý do). Không xoá cứng | Giữ 3 trạng thái demo |
| K2 | Đề nghị xuất từ đâu, bao nhiêu? | Từ HĐ đã duyệt (Chưa thực hiện / Đang thực hiện / Hoàn thành / Thanh lý): chọn **một hoặc nhiều đợt** (số tiền = tổng đợt) hoặc nhập **giá trị trước VAT** tuỳ ý; tổng hoá đơn hiệu lực + đề nghị đang chờ **không vượt** giá trị HĐ trước VAT | Chỉ theo giá trị HĐ như demo |
| K3 | VAT | Theo **thuế suất của HĐ**, làm tròn đồng; không sửa tay. HĐ nhiều thuế suất chưa hỗ trợ (HĐ hiện chỉ có một thuế suất) | Cho sửa tiền VAT tay |
| K4 | Ai làm gì | Đề nghị: `invoices:create` (GĐ, KTT, Kế toán thu tiền). Ghi nhận xuất / điều chỉnh / thay thế / huỷ đề nghị: `invoices:update` (GĐ, Kế toán thu tiền). Người đề nghị không bắt buộc khác người ghi nhận (ghi nhận là việc ghi sổ sau khi đã xuất trên EasyInvoice, không phải duyệt) | Thêm bước GĐ duyệt đề nghị |
| K5 | Thông tin ghi nhận xuất | **Ký hiệu mẫu số** (vd. 1), **ký hiệu** (vd. C25TAA), **số hoá đơn**, **ngày lập** (không sau hôm nay giờ VN), mã tra cứu / mã CQT (tuỳ chọn), **file PDF bắt buộc**, XML tuỳ chọn — lưu kho hồ sơ 02 nhóm "Hoá đơn". **Chặn trùng** (mẫu số + ký hiệu + số) toàn công ty | Không bắt buộc file |
| K6 | Hoá đơn đã xuất bị sai | Không sửa, không huỷ trong sổ. Ghi nhận **hoá đơn thay thế** (gốc → Bị thay thế, số tiền mới thay số cũ) hoặc **hoá đơn điều chỉnh** tăng/giảm (giá trị âm khi giảm; gốc → Đã điều chỉnh, giá trị hiệu lực = gốc + điều chỉnh). Bắt buộc lý do và file. KTT xác nhận cách làm khớp quy trình hoá đơn điện tử công ty đang dùng | Cho huỷ hoá đơn đã xuất kèm biên bản |
| K7 | Người mua trên hoá đơn | Lấy từ KH lúc đề nghị (tên, MST, địa chỉ, email nhận hoá đơn), **lưu bản chụp** trên đề nghị, sửa được trước khi xuất; đổi thông tin KH sau đó không đổi hoá đơn cũ | Luôn đọc trực tiếp từ KH |
| K8 | Đối chiếu thu – xuất | Theo HĐ: **đã xuất** = tổng hoá đơn hiệu lực **gồm VAT**; **đã thu** = phiếu thu Đã duyệt (07); **đã thu chưa xuất** = max(thu − xuất, 0); **đã xuất chưa thu** = max(xuất − thu, 0); tổng theo KH; lọc KH/kỳ; xuất Excel | Đối chiếu theo từng đợt |
| K9 | Kiểm soát đồng thời, lịch sử | Mọi thao tác ghi kiểm `revision` (409 khi bản cũ) và ghi **sự kiện** (ai, lúc, trạng thái, lý do) + audit | — |
| K10 | Dữ liệu demo cũ | Migration: Đề nghị → Chờ xuất; Đã phát hành → Đã xuất, đánh dấu **dữ liệu chuyển đổi** (không có file, không bịa lịch sử, mẫu số để trống); Huỷ → Huỷ đề nghị. Báo cáo số lượng/tổng tiền trước–sau trên bản sao demo | Bắt nhập lại |
| K11 | EasyInvoice | **08-E sau** (QD09): khi có sandbox/quyền API mới phát hành từ phần mềm; sổ nội bộ đã có đủ trường (mẫu số, ký hiệu, mã tra cứu) để nối sau. **Không báo hoàn tất YC18 phần tích hợp** với sổ nội bộ | Bỏ tích hợp |

## Quyền

| Thao tác | Quyền | GĐ | KTT | Nhân viên | Thu tiền | Quản trị |
| --- | --- | --- | --- | --- | --- | --- |
| Xem sổ, hàng chờ, đối chiếu (theo phạm vi HĐ) | `invoices:view` | Toàn công ty | Phạm vi nhóm | — | Toàn công ty | — |
| Lập / sửa đề nghị (chưa xuất) | `invoices:create` | ✓ | ✓ | — | ✓ | — |
| Ghi nhận xuất, điều chỉnh, thay thế, huỷ đề nghị | `invoices:update` | ✓ | — | — | ✓ | — |
| Xuất Excel sổ / đối chiếu | `invoices:export` | ✓ | — | — | ✓ | — |

Nhân viên vẫn không thấy tiền (`financial-fields` 01). Ngoài phạm vi → 404, thiếu quyền → 403.

## Dữ liệu (dự kiến)

| Bảng | Nội dung chính |
| --- | --- |
| `invoices` (sửa) | trạng thái mới (K1), loại **Gốc / Điều chỉnh / Thay thế** + hoá đơn liên quan, mẫu số, ký hiệu, số, ngày lập, mã tra cứu, mã CQT, người mua (bản chụp), trước VAT / VAT / tổng (âm với điều chỉnh giảm), lý do, người/lúc ghi nhận, `revision`, cờ dữ liệu chuyển đổi; khoá duy nhất (mẫu số, ký hiệu, số) khi đã xuất |
| `invoice_installments` | đề nghị ↔ đợt thanh toán (K2) |
| `invoice_documents` | hoá đơn ↔ file PDF/XML trong kho 02 |
| `invoice_events` | lịch sử: đề nghị, sửa, xuất, điều chỉnh, thay thế, huỷ — người, lúc, lý do |

## Màn hình

- **Hoá đơn** (`/invoices`): tab **Chờ xuất** (hàng chờ của kế toán: người mua, MST, số tiền, đợt, HĐ; nút Ghi nhận xuất), **Sổ hoá đơn** (lọc trạng thái/KH/HĐ/kỳ, số/ký hiệu; xuất Excel), **Đối chiếu thu – xuất** (ô đếm: đã thu chưa xuất, đã xuất chưa thu; theo KH → HĐ).
- **Ngăn chi tiết hoá đơn**: người mua, số tiền, đợt, file PDF/XML, hoá đơn liên quan (gốc / điều chỉnh / thay thế), lịch sử, nút theo trạng thái và quyền.
- **Chi tiết HĐ (04)**, tab Thanh toán & Hoá đơn: đề nghị xuất theo đợt; danh sách hoá đơn với trạng thái; phần chưa xuất.

## API (dự kiến)

| Phương thức | Đường dẫn | Quyền |
| --- | --- | --- |
| GET | `/invoices` (lọc, phân trang), `/invoices/:id` | `invoices:view` |
| POST / PATCH | `/invoices` (đề nghị), `/invoices/:id` (sửa đề nghị chưa xuất) | `invoices:create` |
| POST | `/invoices/:id/issue` (multipart: thông tin + PDF/XML), `/invoices/:id/cancel` (huỷ đề nghị, lý do) | `invoices:update` |
| POST | `/invoices/:id/adjust`, `/invoices/:id/replace` (multipart, lý do) | `invoices:update` |
| GET | `/invoices/reconciliation` (theo HĐ/KH, tổng) | `invoices:view` |
| GET | `/invoices/export`, `/invoices/reconciliation/export` (Excel) | `invoices:export` |

## Luồng lỗi chính

- HĐ chưa duyệt / huỷ, đợt không thuộc HĐ, số tiền ≤ 0 hoặc vượt phần chưa xuất → 400.
- Ghi nhận xuất thiếu số/ký hiệu/ngày/file PDF, ngày sau hôm nay, trùng (mẫu số + ký hiệu + số) → 400/409.
- Sửa / huỷ hoá đơn đã xuất → 400 (dùng điều chỉnh / thay thế); thao tác trên bản cũ → 409; thiếu lý do → 400.

## Tiêu chí nghiệm thu

1. Đề nghị theo đợt và theo giá trị; không vượt giá trị HĐ chưa xuất (tính cả đề nghị đang chờ); VAT đúng thuế suất HĐ.
2. Ghi nhận xuất bắt buộc đủ thông tin và PDF; trùng số bị chặn; file vào kho hồ sơ 02 nhóm "Hoá đơn".
3. Điều chỉnh / thay thế: giá trị hiệu lực của HĐ đúng sau mỗi lần; hoá đơn gốc giữ nguyên, có liên kết hai chiều; lịch sử đầy đủ.
4. Hai người ghi nhận cùng lúc → một thành công, một 409; không xoá cứng.
5. Đối chiếu thu – xuất khớp từng HĐ với bộ số liệu mẫu (đã thu 07 đã duyệt, đã xuất gồm VAT); tổng theo KH bằng tổng các HĐ; Excel cùng số.
6. Bảng theo dõi kiểm toán (04-F) và tab HĐ đọc đúng trạng thái mới; hồi quy e2e 04/07.
7. Migration K10 trên DB trống và bản sao demo: số hoá đơn, tổng tiền theo trạng thái không đổi; Prisma diff sạch.
8. Phân quyền theo bảng; nhân viên không thấy tiền; lint/unit/e2e (chạy theo lô)/build/max-lines đạt; giao diện desktop và 375px.

## Test hồi quy và thay đổi test cũ

- Test cũ của `invoices`, `contracts` (tab hoá đơn), `permissions-financial`, `audit-board` dùng 3 trạng thái demo: đổi theo K1/K10 phải ghi lý do từng file ở `08-test-policy-changes.md` **trước khi đổi**, giữ kỳ vọng số tiền.

## Đầu vào cần từ người dùng

- **Xác nhận K6** (điều chỉnh / thay thế) với cách công ty đang xử lý hoá đơn sai trên EasyInvoice — KTT/Kế toán thu tiền.
- Một vài hoá đơn mẫu đã xuất (PDF, đã che thông tin) để đối chiếu trường ghi nhận — không bắt buộc để code.
- **QD09:** tài liệu API / sandbox EasyInvoice khi làm 08-E.

## Phân kỳ triển khai

1. **08-A:** duyệt đặc tả, K1–K11 và phạm vi ngoài module.
2. **08-B Dữ liệu và API:** schema, migration K10, đề nghị theo đợt, ghi nhận xuất kèm file, điều chỉnh / thay thế / huỷ đề nghị, lịch sử, chặn trùng, đồng thời; e2e.
3. **08-C Giao diện:** `/invoices` (Chờ xuất, Sổ hoá đơn, ngăn chi tiết), tab HĐ, 04-F đọc trạng thái mới.
4. **08-D Đối chiếu và nghiệm thu:** đối chiếu thu – xuất, Excel, kiểm chứng đầy đủ, biên bản `08-invoices-acceptance.md`.
5. **08-E (sau, QD09):** phát hành qua API EasyInvoice.

## Tiến độ triển khai

### 08-B Dữ liệu và API — đã code và kiểm chứng kỹ thuật (29/10/2026)

- **Schema** (migration `20261029160000_invoice_ledger`): trạng thái thêm Đã điều chỉnh / Bị thay thế, loại hoá đơn (gốc / điều chỉnh / thay thế) + liên kết gốc, mẫu số, mã tra cứu, mã CQT, người mua (bản chụp), lý do, người/lúc ghi nhận, `revision`, cờ chuyển đổi; khoá duy nhất (mẫu số, ký hiệu, số); bảng `invoice_installments`, `invoice_documents`, `invoice_events`; nhóm hồ sơ 02 **Hoá đơn** (`INVOICE`). **K10:** trên bản sao demo `ketoan_mig_07c` 2 đề nghị / 341.000.000 đ và 3 đã xuất / 599.500.000 đ giữ nguyên, đánh dấu chuyển đổi, người mua lấy từ KH; Prisma diff rỗng.
- **API** (`/invoices`): đề nghị theo đợt (tổng = tổng đợt gồm VAT, trước VAT = tổng / (1 + thuế suất) làm tròn đồng) hoặc theo giá trị; không vượt phần chưa xuất (tính đề nghị đang chờ, khoá dòng HĐ); đợt đã có đề nghị/hoá đơn → 400; sửa đề nghị (người mua, ghi chú); huỷ đề nghị có lý do; ghi nhận xuất multipart (`pdf` bắt buộc, `xml` tuỳ chọn) vào kho hồ sơ KH nhóm Hoá đơn, chặn trùng → 409; điều chỉnh tăng/giảm (gốc → Đã điều chỉnh; không giảm quá giá trị còn lại; không vượt giá trị HĐ); thay thế (gốc → Bị thay thế, đợt chuyển sang hoá đơn mới, người mua sửa được); chi tiết có đợt, file, gốc/điều chỉnh/thay thế, lịch sử. Mọi lệnh kiểm `revision` (409), ghi lịch sử + nhật ký. Bỏ `PATCH /invoices/:id/issue|cancel` cũ.
- **Nơi đọc:** chi tiết HĐ `invoicedSubtotal` = phần đã đề nghị + đã xuất hiệu lực; bảng theo dõi kiểm toán 04-F cột Hoá đơn tính "đã có hoá đơn" theo hoá đơn hiệu lực, bỏ huỷ / bị thay thế.
- **Kho hồ sơ 02:** nhóm Hoá đơn nhận thêm file **XML** (chỉ lưu/tải, chặn DOCTYPE/ENTITY, tối đa 5 MB); các nhóm khác giữ nguyên quy tắc.
- **Làm rõ khi code (không đổi quyết định đã duyệt):** sửa đề nghị chỉ đổi người mua và ghi chú (đổi số tiền / đợt: huỷ rồi đề nghị lại); chỉ thay thế hoá đơn đã xuất **chưa** điều chỉnh (đã điều chỉnh thì tiếp tục điều chỉnh); điều chỉnh lập trên hoá đơn gốc / thay thế, không trên hoá đơn điều chỉnh; số hoá đơn giữ nguyên như nhập (kể cả số 0 ở đầu), ký hiệu viết hoa khi so trùng.
- **Chưa làm (08-C):** giao diện `/invoices` và tab HĐ vẫn là bản demo, gọi API cũ (phát hành/huỷ) — **chưa dùng được cho tới 08-C**.
- Test: unit `invoice.rules.spec` (4); e2e `invoices` (6); `contracts.e2e` đổi cách ghi nhận phát hành theo K5 ([giải trình](08-test-policy-changes.md)).

### 08-C Giao diện — đã code và kiểm chứng kỹ thuật (29/10/2026)

- **Trang Hoá đơn** (`/invoices`): tab **Chờ xuất** (đếm trên nhãn) và **Sổ hoá đơn** (lọc trạng thái, loại, kỳ ngày lập, tìm số/ký hiệu/HĐ/KH/người mua); bảng có mẫu số · ký hiệu · số, ngày lập, HĐ, người mua + MST, đợt, tổng (âm tô đỏ), loại, trạng thái; `?id=` mở thẳng.
- **Ngăn chi tiết**: người mua, trước VAT / VAT / tổng, đợt, mã tra cứu / mã CQT, người ghi nhận, file PDF/XML (tải về), hoá đơn gốc / điều chỉnh / thay thế (bấm để mở), lịch sử; nút theo trạng thái và quyền — Ghi nhận đã xuất, Sửa người mua, Huỷ đề nghị (ô lý do), Điều chỉnh, Thay thế. Dữ liệu chuyển đổi hiện ghi chú, không có lịch sử bịa.
- **Biểu mẫu ghi nhận** (dùng chung cho ghi nhận xuất / điều chỉnh / thay thế): mẫu số, ký hiệu, số, ngày lập (không chọn ngày sau hôm nay), mã tra cứu, mã CQT, PDF bắt buộc, XML tuỳ chọn; điều chỉnh có Tăng/Giảm + số tiền + lý do; thay thế có giá trị mới, người mua, lý do; mẫu số và ký hiệu lấy sẵn từ hoá đơn gốc.
- **Chi tiết HĐ (04)**, tab Hoá đơn: đề nghị **theo đợt** (chỉ hiện đợt chưa có đề nghị / hoá đơn hiệu lực) hoặc **theo giá trị**, người mua điền sẵn từ KH; bảng hoá đơn có mẫu số · ký hiệu · số, loại, trạng thái, bấm dòng mở `/invoices?id=`. API chi tiết HĐ trả thêm đợt đã gắn của từng hoá đơn.
- **Giới hạn đã biết:** hoá đơn demo chuyển đổi (K10) không gắn đợt nên đợt tương ứng vẫn hiện là còn trống; giới hạn theo giá trị HĐ chưa xuất vẫn chặn xuất vượt.
- Test web: `invoices.store.spec` (3), `invoice-drawer.component.spec` (4).

### 08-D Đối chiếu thu – xuất và nghiệm thu — đã code và kiểm chứng kỹ thuật (29/10/2026)

- **API:** `GET /invoices/reconciliation` (theo HĐ đã duyệt: đã thu = phiếu Đã duyệt, đã xuất = hoá đơn hiệu lực gồm VAT kể cả điều chỉnh âm, chờ xuất riêng; đã thu chưa xuất / đã xuất chưa thu; lọc KH, tìm, **đến ngày** — phiếu theo ngày thu, hoá đơn theo ngày lập; chỉ HĐ chênh lệch; tổng cộng); `GET /invoices/export` (sổ hoá đơn theo bộ lọc) và `GET /invoices/reconciliation/export` — Excel, tiền là ô số, quyền `invoices:export`.
- **Giao diện:** tab **Đối chiếu thu – xuất** (ô đếm, bảng theo HĐ, dòng tổng, đến ngày, chỉ HĐ chênh lệch, xuất Excel); tab Sổ hoá đơn có nút Xuất Excel.
- Test: e2e `invoice-reconciliation` (3); web `reconciliation.store.spec` (1).
- **Biên bản:** [08-invoices-acceptance.md](08-invoices-acceptance.md) — sổ nội bộ hoàn thiện kỹ thuật, chờ người dùng nghiệm thu; 08-E chờ QD09.
