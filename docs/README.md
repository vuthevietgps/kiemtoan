# Tài liệu dự án

Cập nhật: **22/10/2026**. Đây là điểm bắt đầu khi đọc yêu cầu, tiếp tục code hoặc nghiệm thu. Mốc tiếp tục: 05 đã nghiệm thu ngày 23/10; đặc tả 06 đã duyệt, 06-B, 06-C đã code và kiểm chứng kỹ thuật, tiếp 06-D; kế hoạch 04–11 đã được cập nhật sau review.

## Đọc theo nhu cầu

| Cần xem | Tài liệu |
| --- | --- |
| Toàn bộ mô tả chức năng, câu trả lời và Phụ lục 1 | [Đặc tả tích hợp PDF](requirements/functional-description-integrated-2026-10-15.pdf) |
| Phạm vi dùng để lập kế hoạch, truy vết về nguồn | [Phạm vi và yêu cầu](requirements/scope-and-traceability.md) |
| Điểm chưa rõ hoặc mâu thuẫn cần duyệt | [Sổ quyết định](requirements/decision-register.md) |
| Thứ tự hoàn thiện, sản phẩm bàn giao, điều kiện chuyển bước | [Kế hoạch hoàn thiện](planning/completion-plan.md) |
| Đã kiểm chứng đến đâu, công việc tiếp theo | [Hiện trạng](planning/current-status.md) |
| Review mới nhất: app, file Claude, lỗi và bộ kiểm tra thực tế | [Review 22/10](planning/review-2026-10-22.md) |
| Review code/đặc tả 15/10 và kế hoạch chi tiết 03–11 (đề xuất, chờ duyệt) | [Review 15/10](planning/review-2026-10-15.md) |
| Quy tắc bắt buộc khi sửa code/test | [Quy tắc code](quy-tac-code.md) |
| Khách hàng, Excel và kho hồ sơ vừa hoàn thiện | [Đặc tả 02](features/02-customers-documents.md), [biên bản](features/02-customers-acceptance.md) |
| Đặc tả chi tiết từng chức năng | [Danh mục đặc tả](features/README.md) |
| Cài đặt, chạy, Docker, backup/restore | [Hướng dẫn vận hành](operations/README.md) |
| Nguồn ban đầu và bản trả lời đầy đủ | [Nguồn PDF](requirements/sources/functional-description-original.pdf), [câu trả lời DOCX](requirements/sources/clarifications-answered-2026-10-15.docx) |
| Báo cáo cũ, đề xuất thương mại và tài liệu ngoài phạm vi | [Lịch sử tài liệu](archive/README.md) |

## Cách xác định tài liệu có hiệu lực

1. Yêu cầu và quyết định được chủ đầu tư duyệt là căn cứ nghiệp vụ. Chị Hà là đầu mối duyệt; người tham gia UAT: chị Hà, Nhật Linh, Hoàng Đỗ (câu 30).
2. PDF gốc và DOCX đã trả lời là nguồn đầu vào. PDF tích hợp giữ nội dung nguồn để đọc thuận tiện; không tự giải quyết các mâu thuẫn hoặc thay thế phê duyệt.
3. Phạm vi, sổ quyết định và kế hoạch là bản tổng hợp làm việc. Chỗ chưa chốt phải giữ trạng thái chờ, ghi rõ phương án đề xuất. Không coi việc người dùng yêu cầu sắp xếp tài liệu là duyệt mọi phương án nghiệp vụ.
4. Đặc tả trong `features/` phải được cập nhật và duyệt trước khi code chức năng tương ứng. Đặc tả demo cũ không được dùng để thu hẹp yêu cầu gốc/bổ sung.
5. Quy tắc code giữ nguyên hiệu lực. Tài liệu lưu trữ và hướng dẫn demo cũ chỉ để tra cứu lịch sử.

DOCX đã trả lời chưa điền người trả lời/ngày ký ở cuối biểu mẫu. Phân biệt **có câu trả lời**, **đặc tả được duyệt**, **code đã kiểm tra** và **đã nghiệm thu**.

Riêng chức năng 01: người dùng đã trực tiếp ủy quyền chốt ma trận và nghiệm thu kỹ thuật ngày 15/10/2026. Xem [ma trận/đặc tả hiện hành](features/01-users-access-control.md) và [biên bản kiểm chứng](features/01-users-acceptance.md). Ủy quyền này không thay thế UAT của người dùng thật hoặc xác nhận triển khai production.

## Cấu trúc và quản lý thay đổi

```text
docs/
  README.md                         Mục lục này
  quy-tac-code.md                    Quy tắc bắt buộc, giữ đường dẫn ổn định
  agent-brief.md                     Hướng dẫn tiếp tục công việc
  requirements/                     Nguồn, đặc tả tích hợp, phạm vi, quyết định
    sources/                        Bản gốc và câu trả lời, không sửa đè
  planning/                         Kế hoạch và trạng thái hiện tại
  features/                         Đặc tả triển khai theo thứ tự 00–11
  operations/                       Hướng dẫn vận hành và migration
  archive/                          Kế hoạch/báo cáo cũ, đề xuất thương mại
  references/marketing/             Báo cáo quảng cáo, không phải yêu cầu phần mềm
```

- Một nội dung hiện hành chỉ có một nơi chỉnh sửa. Các file điều hướng ở đường dẫn cũ dẫn về nơi mới.
- Khi có quyết định: cập nhật mã QD trong sổ quyết định, yêu cầu YC liên quan, đặc tả chức năng, kế hoạch và test tương ứng. Ghi người duyệt, ngày và bằng chứng duyệt.
- Giữ nguyên bản nguồn; thêm phiên bản mới khi có bản trả lời mới. [Bảng nguồn và SHA-256](requirements/document-provenance.json) ghi đường dẫn trước/sau khi tổ chức tài liệu.
- Báo cáo kiểm tra phải ghi ngày, phạm vi và kết quả thực tế; không gộp kết quả cũ thành kiểm tra mới.
