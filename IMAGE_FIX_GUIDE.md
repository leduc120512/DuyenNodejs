# ❌ Ảnh Không Hiển Thị - Hướng Dẫn Fix

## 🔍 Vấn Đề Tìm Ra

Database chứa đường dẫn ảnh cũ (`/uploads/product-174...jpg`) nhưng **các file ảnh thực tế không tồn tại** trong folder `/public/uploads/`.

Nguyên nhân: Các ảnh này từ migration cũ hoặc seed data, file thực tế bị mất.

## 🛠️ Giải Pháp

### **Cách 1: Upload Ảnh Mới (Khuyên Dùng)**

1. **Vào Admin Dashboard**: `/admin`
2. **Chọn tab "Quản lý sản phẩm"**
3. **Click "Sửa" (Edit) từng sản phẩm**
4. **Phần "Product Images", chọn ảnh mới từ máy**
5. **Nếu không muốn giữ ảnh cũ**, click "Clear All Existing Images"
6. **Click "Update Product"**

**Lợi ích**:

- ✅ Ảnh sẽ hiển thị đúng
- ✅ Preview ảnh trước khi upload
- ✅ Có thể upload tối đa 8 ảnh

### **Cách 2: Reset Database Về Default (Xóa Tất Cả Ảnh Cũ)**

Nếu không muốn fix từng sản phẩm, chạy lệnh này để reset tất cả:

```bash
node scripts/reset-product-images.js
```

**Kết quả**:

- Tất cả sản phẩm sẽ hiển thị ảnh mặc định
- Bạn có thể upload ảnh mới từ admin panel

## 📋 Checklist Sau Khi Fix

- [ ] Đã upload ảnh mới cho sản phẩm
- [ ] Refresh trang shop thấy ảnh mới
- [ ] Admin panel có thấy preview ảnh không?
- [ ] Sản phẩm hết hàng xuống cuối danh sách?

## ✨ Tính Năng Mới Được Thêm

1. **Preview ảnh trước upload** - Thấy ảnh sẽ như thế nào trước khi submit
2. **Clear all images button** - Dễ dàng xóa tất cả ảnh cũ
3. **File size validation** - Tự động check >5MB
4. **Form validation** - Kiểm tra tất cả fields bắt buộc
5. **Sold-out sorting** - Sản phẩm hết hàng tự động xuống cuối
6. **Better error messages** - Thông báo lỗi chi tiết hơn

## 🎯 Quy Trình Upload Ảnh Đúng

1. **Thêm sản phẩm mới**
   - Điền đủ: Tên, Mô tả, Giá, Danh mục, Tồn kho
   - Chọn ảnh (1-8 file)
   - Thấy preview xanh "New" = OK
   - Click "Add Product"

2. **Sửa sản phẩm cũ**
   - Thêm ảnh mới
   - Hoặc uncheck "Keep this image" để xóa ảnh cũ
   - Click "Update Product"

## 📸 Yêu Cầu Ảnh

- **Format**: JPG, JPEG, PNG, GIF
- **Size Max**: 5MB/file
- **Số lượng**: 1-8 ảnh
- **Kích thước khuyên**: 600x600px (tối thiểu 400x400px)

---

Nếu còn vấn đề, hãy:

1. Kiểm tra console browser (F12) xem có lỗi gì
2. Xem admin panel có lỗi gì khi upload
3. Chắc chắn `/public/uploads/` folder tồn tại
