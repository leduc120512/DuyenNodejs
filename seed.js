const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import models
const User = require("./models/User");
const Category = require("./models/Category");
const Product = require("./models/Product");
const Order = require("./models/Order");

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/fanshop", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected for seeding"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Dữ liệu mẫu
const seedData = async () => {
  try {
    // 1. Xóa dữ liệu cũ (tùy chọn - cẩn thận khi dùng production)
    await User.deleteMany({});
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});

    console.log("Cleared old data");

    // 2. Tạo Admin & Users
    const salt = await bcrypt.genSalt(10);

    const users = await User.insertMany([
      {
        username: "admin",
        email: "admin@fanshop.vn",
        password: await bcrypt.hash("Admin123!", salt),
        fullName: "Quản Trị Viên",
        phone: "0987654321",
        address: "Hà Nội, Việt Nam",
        role: "admin",
        isActive: true,
        isEmailVerified: true,
      },
      {
        username: "ducnguyen",
        email: "duc@fanshop.vn",
        password: await bcrypt.hash("Duc123456", salt),
        fullName: "Nguyễn Văn Đức",
        phone: "0912345678",
        address: "Cầu Giấy, Hà Nội",
        role: "user",
        isActive: true,
        isEmailVerified: true,
      },
      {
        username: "testuser",
        email: "test@fanshop.vn",
        password: await bcrypt.hash("Test123456", salt),
        fullName: "Test User",
        role: "user",
        isActive: true,
      },
      {
        username: "banneduser",
        email: "banned@fanshop.vn",
        password: await bcrypt.hash("Banned123", salt),
        fullName: "Người Dùng Bị Khóa",
        role: "user",
        isActive: false,
        isBanned: true,
        banReason: "Vi phạm điều khoản sử dụng - spam",
        bannedAt: new Date(),
      },
    ]);

    console.log(`Created ${users.length} users`);

    // Lấy ID của admin và user thường
    const admin = users.find((u) => u.username === "admin");
    const duc = users.find((u) => u.username === "ducnguyen");

    // 3. Tạo Categories
    const categories = await Category.insertMany([
      {
        name: "Áo đấu CLB",
        description: "Áo đấu chính thức các câu lạc bộ bóng đá nổi tiếng",
      },
      { name: "Áo đấu ĐTQG", description: "Áo đấu đội tuyển quốc gia" },
      { name: "Phụ kiện", description: "Khăn quàng, mũ, cờ, băng rôn..." },
      { name: "Giày bóng đá", description: "Giày thi đấu và tập luyện" },
      { name: "Quà lưu niệm", description: "Mô hình, cúp, ảnh cầu thủ..." },
    ]);

    console.log(`Created ${categories.length} categories`);

    // Map tên category -> ID cho tiện
    const catMap = {};
    categories.forEach((cat) => {
      catMap[cat.name] = cat._id;
    });

    // 4. Tạo Products
    const products = await Product.insertMany([
      {
        name: "Áo đấu Manchester United 2024/25 Home",
        description:
          "Áo đấu chính thức Man Utd mùa giải 2024/25, nhà tài trợ Adidas",
        price: 950000,
        category: catMap["Áo đấu CLB"],
        stock: 45,
        image: "/images/products/manutd-home.jpg",
      },
      {
        name: "Áo đấu Việt Nam 2026 Away",
        description: "Áo đấu sân khách đội tuyển Việt Nam - thiết kế mới nhất",
        price: 720000,
        category: catMap["Áo đấu ĐTQG"],
        stock: 120,
        image: "/images/products/vietnam-away.jpg",
      },
      {
        name: "Khăn quàng cổ Liverpool",
        description: "Khăn quàng cổ chính hãng LFC, size tiêu chuẩn",
        price: 280000,
        category: catMap["Phụ kiện"],
        stock: 200,
        image: "/images/products/liverpool-scarf.jpg",
      },
      {
        name: "Giày Nike Mercurial Vapor 16 Elite",
        description: "Giày tốc độ cao cấp nhất từ Nike - phiên bản 2025",
        price: 3850000,
        category: catMap["Giày bóng đá"],
        stock: 18,
        image: "/images/products/mercurial-vapor.jpg",
      },
      {
        name: "Mô hình 1:18 Lionel Messi PSG",
        description:
          "Mô hình cầu thủ Lionel Messi thời kỳ PSG - chất lượng cao",
        price: 1800000,
        category: catMap["Quà lưu niệm"],
        stock: 35,
        image: "/images/products/messi-model.jpg",
      },
    ]);

    console.log(`Created ${products.length} products`);

    // 5. Tạo một vài đơn hàng mẫu
    const orders = await Order.insertMany([
      {
        user: duc._id,
        items: [
          { product: products[0]._id, quantity: 1, price: products[0].price },
          { product: products[2]._id, quantity: 2, price: products[2].price },
        ],
        totalAmount: products[0].price + products[2].price * 2,
        status: "pending",
        shippingAddress: duc.address,
        phone: duc.phone,
      },
      {
        user: duc._id,
        items: [
          { product: products[1]._id, quantity: 1, price: products[1].price },
        ],
        totalAmount: products[1].price,
        status: "delivered",
        shippingAddress: duc.address,
        phone: duc.phone,
      },
      {
        user: users[2]._id, // testuser
        items: [
          { product: products[3]._id, quantity: 1, price: products[3].price },
        ],
        totalAmount: products[3].price,
        status: "processing",
        shippingAddress: "Test Address, TP.HCM",
        phone: "0909998888",
      },
    ]);

    console.log(`Created ${orders.length} orders`);

    console.log("Seed data completed successfully!");
    console.log("Admin login:");
    console.log("Email: admin@fanshop.vn");
    console.log("Password: Admin123!");
    console.log("User login example:");
    console.log("Email: duc@fanshop.vn");
    console.log("Password: Duc123456");
  } catch (error) {
    console.error("Error seeding data:", error);
  } finally {
    mongoose.connection.close();
  }
};

// Chạy seed
seedData();
