# Quản Lý Hàng Hoá Nhập Đổi Lỗi & Xác Nhận Kho - Thợ Điện Máy Xanh

Hệ thống web chuyên dụng cho siêu thị Điện Máy Xanh giúp nhân viên tiếp nhận hàng hóa đổi lỗi từ khách hàng và thủ kho/admin theo dõi, xác nhận hàng lỗi đã về kho hay chưa. Toàn bộ dữ liệu được đồng bộ trực tiếp lên Firebase Cloud Firestore thời gian thực và lưu trữ offline an toàn.

---

## 🌟 Tính Năng Nổi Bật

### 1. Phân Quyền & Đăng Nhập
- **Tài khoản Nhân viên (Không cần mật khẩu)**:
  - Tích hợp sẵn 10 nhân viên:
    1. `38834 - NGÔ THỊ BÉ THẮM`
    2. `38847 - NGUYỄN HÙNG MẠNH`
    3. `12803 - NGUYỄN THỊ NHẠN`
    4. `58638 - PHẠM NGỌC ANH`
    5. `266798 - GIANG NHƯ Ý`
    6. `59442 - LÊ KIM MỸ`
    7. `46944 - NGUYỄN DIỄM MY`
    8. `97734 - HUỲNH HOÀNG PHÚC`
    9. `21964 - LÂM THỊ NHƯ Ý`
    10. `157597 - NGUYỄN TUẤN MI`
  - Đăng nhập thông minh: Chỉ cần gõ mã NV hoặc tên là có gợi ý autocomplete, bấm vào là đăng nhập ngay lập tức.
  - Có danh sách 10 chip chọn nhanh 1 chạm.
- **Tài khoản Quản trị viên (Admin)**:
  - Mật khẩu: `43751`.
  - Quyền hạn: Toàn quyền xác nhận kho, duyệt đơn, nạp danh mục sản phẩm từ Excel, xóa đơn.

### 2. Tiếp Nhận Đổi Lỗi Khách Hàng
- Tự động sinh mã phiếu chuẩn: `DL-YYMMDD-XXXX`.
- **Tự động lấy ngày giờ hệ thống** thời gian thực lúc tạo đơn.
- **Tự động gán nhân viên phụ trách** đang đăng nhập.
- Quản lý theo Số điện thoại và Họ tên khách hàng (tự động nhận diện khách quen).
- Tìm kiếm sản phẩm lỗi với autocomplete thông minh (từ danh mục Excel hoặc gõ tự do).
- Ghi nhận số Serial/IMEI, triệu chứng lỗi (chip chọn nhanh lỗi phổ biến), phụ kiện kèm theo, hình thức đổi trả.
- Tự động gán trạng thái ban đầu: `⚠️ Chưa về kho (Tại quầy)`.

### 3. Xác Nhận Hàng Lỗi Về Kho (Warehouse Confirmation)
- Thẻ trạng thái trực quan:
  - 🟡 **Chưa về kho**: Cảnh báo hàng đọng tại quầy siêu thị.
  - 🟢 **Đã về kho**: Xác nhận thủ kho đã kiểm đếm và cất vào kho an toàn.
- Nút bấm 1 chạm: **"🏢 Nhận kho"** để cập nhật thời gian về kho (`auto timestamp`), người nhận kho, vị trí kệ lưu trữ.
- Bộ lọc nhanh: Tất cả đơn / Chưa về kho / Đã về kho / Theo nhân viên / Theo ngày.

### 4. Quản Lý Danh Mục Sản Phẩm Từ Excel
- Tích hợp thư viện SheetJS đọc file `.xlsx`, `.xls`, `.csv` kéo thả trực tiếp trên trình duyệt.
- Xem trước dữ liệu trước khi xác nhận nạp vào hệ thống.
- Nút tải file Excel mẫu chuẩn.
- Dữ liệu sản phẩm mẫu phong phú (Camera Imou/Ezviz, Máy lọc nước Kangaroo/Karofi/Mutosi, Tivi, Điện thoại...).

### 5. In Biên Nhận & Xuất Báo Cáo
- In phiếu tiếp nhận đổi lỗi chuyên nghiệp cho khách hàng (có mã vạch `JsBarcode`, thông tin lỗi, phụ kiện và phần ký tên).
- Xuất toàn bộ danh sách đơn ra file Excel `.xlsx` với 1 cú click.

### 6. Đồng Bộ Dữ Liệu Thời Gian Thực
- Kết nối Firebase Cloud Firestore (`crm-43751-71e4b`).
- Dữ liệu đồng bộ tức thì giữa điện thoại của nhân viên và máy tính của thủ kho/admin.
- Cơ chế Offline-First: Hoạt động trơn tru ngay cả khi mạng chập chờn.
