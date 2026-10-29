# Giải trình thay đổi test trong chức năng 02

Ngày 15/10/2026, người dùng duyệt đặc tả 02 và helper scope trong chat; sau đó cho phép tích hợp core/storage, preview và audit.

- Test tài liệu cũ upload `.txt`, và unit dùng bytes `abc` gắn đuôi PDF. Đặc tả mới chỉ nhận PDF/PNG/JPEG/Office không macro có nội dung khớp định dạng. Chuyển fixture hợp lệ sang bytes PDF; vẫn kiểm tra đúng tên, nội dung tải về, người upload, scope và xoá mềm. Bổ sung test từ chối file giả/loại cấm và dọn file khi DB lỗi. Không giữ fixture sai định dạng rồi nới validator để test pass.
- Danh sách tài liệu chuyển từ array không phân trang sang `{items,total,page,pageSize}` theo quy tắc chung và đặc tả 02. Các expectation cũ kiểm tra số tài liệu chuyển sang `items`, giữ nguyên số lượng/kịch bản và thêm kiểm tra phân trang.
- Test đường dẫn storage được chạy trước sửa: đường dẫn thư mục anh em trùng tiền tố không bị chặn, test fail. Sửa kiểm tra bằng relative/isAbsolute; không đổi expectation để che lỗi.
- Test mới về owner ngoài nhóm được viết trước thay đổi; lần chạy đầu bị Docker dừng nên không có bằng chứng red trên ứng dụng. Không ghi giả rằng đã tái hiện bằng test; source cũ `assertOwner` chỉ kiểm tra tồn tại/chưa xoá. E2e mới chứng minh từ chối ngoài nhóm và tiếp tục giữ các test giao nhân viên trong nhóm.

Không bỏ qua/xoá/nới điều kiện test để pass. Kết quả kiểm tra ghi riêng theo lần chạy trong hiện trạng/biên bản.

- Rà đầu vào null: 4 test DTO mới fail trước sửa rồi đạt sau sửa, giữ nguyên assertion; enum trạng thái/kỳ thuế và cờ đầu mối chính phải từ chối null trước Prisma. Các nhóm test dài được đưa về hook/test cấp file để giảm cảnh báo, không bỏ hay thay assertion.
- PDF preview: kiểm tra UI phát hiện khung plugin trắng dù API đúng bytes. Đổi sang PDF.js/canvas, thêm test hiển thị một trang có giới hạn và thông báo lỗi, rồi thử lại bằng PDF thật trên dữ liệu giả.
