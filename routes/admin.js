const express = require("express");
const router = express.Router();
const { isAdmin } = require("../middleware/auth");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const User = require("../models/User");
const upload = require("../middleware/upload");

// Dashboard
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const productCount = await Product.countDocuments();
    const categoryCount = await Category.countDocuments();
    const orderCount = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: "pending" });

    res.render("admin/dashboard", {
      user: req.session,
      productCount,
      categoryCount,
      orderCount,
      pendingOrders,
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/users", isAdmin, async (req, res) => {
  try {
    const search = req.query.search || "";
    const status = req.query.status || ""; // active / banned / locked

    let query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
      ];
    }

    if (status === "banned") {
      query.isBanned = true;
    } else if (status === "inactive") {
      query.isActive = false;
    } else if (status === "locked") {
      query.$or = [
        { lockUntil: { $gt: new Date() } },
        { loginAttempts: { $gte: 5 } }, // tùy theo logic bạn đặt
      ];
    }

    const users = await User.find(query)
      .select("-password -refreshTokens") // không lộ password
      .sort({ createdAt: -1 });

    res.render("admin/users", {
      user: req.session,
      users,
      search,
      status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// Chi tiết người dùng
router.get("/users/:id", isAdmin, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id).select(
      "-password -refreshTokens"
    );

    if (!targetUser) {
      return res.status(404).send("Không tìm thấy người dùng");
    }

    res.render("admin/user-detail", {
      user: req.session,
      targetUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// Form khóa / mở khóa / ban tài khoản
router.get("/users/:id/manage", isAdmin, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id).select(
      "username email fullName role isActive isBanned banReason loginAttempts lockUntil"
    );

    if (!targetUser) {
      return res.status(404).send("Không tìm thấy người dùng");
    }

    res.render("admin/user-manage", {
      user: req.session,
      targetUser,
      error: null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
});

// Thực hiện thay đổi trạng thái tài khoản
router.post("/users/:id/manage", isAdmin, async (req, res) => {
  try {
    const { action, banReason, role } = req.body;
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).send("Không tìm thấy người dùng");
    }

    // Bảo vệ: không cho admin tự ban chính mình
    if (targetUser._id.toString() === req.session.user._id.toString()) {
      return res.render("admin/user-manage", {
        user: req.session,
        targetUser,
        error: "Không thể thay đổi trạng thái tài khoản của chính bạn",
      });
    }

    switch (action) {
      case "ban":
        targetUser.isBanned = true;
        targetUser.isActive = false;
        targetUser.banReason = banReason || "Vi phạm quy định";
        targetUser.bannedAt = new Date();
        targetUser.bannedBy = req.session.user._id;
        break;

      case "unban":
        targetUser.isBanned = false;
        targetUser.isActive = true;
        targetUser.banReason = null;
        targetUser.bannedAt = null;
        targetUser.bannedBy = null;
        break;

      case "suspend":
        targetUser.isActive = false;
        break;

      case "activate":
        targetUser.isActive = true;
        break;

      case "reset-login-attempts":
        targetUser.loginAttempts = 0;
        targetUser.lockUntil = null;
        break;

      case "change-role":
        if (["user", "admin", "moderator"].includes(role)) {
          targetUser.role = role;
        }
        break;

      default:
        return res.render("admin/user-manage", {
          user: req.session,
          targetUser,
          error: "Hành động không hợp lệ",
        });
    }

    await targetUser.save();

    res.redirect(`/admin/users/${req.params.id}`);
  } catch (error) {
    console.error(error);
    const targetUser = await User.findById(req.params.id).select(
      "username email fullName role isActive isBanned banReason loginAttempts lockUntil"
    );
    res.render("admin/user-manage", {
      user: req.session,
      targetUser,
      error: "Có lỗi xảy ra khi cập nhật",
    });
  }
});
// Products Management
router.get("/products", isAdmin, async (req, res) => {
  try {
    const search = req.query.search || "";
    const query = search ? { name: { $regex: search, $options: "i" } } : {};

    const products = await Product.find(query)
      .populate("category")
      .sort({ createdAt: -1 });
    res.render("admin/products", { user: req.session, products, search });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/products/add", isAdmin, async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.render("admin/product-form", {
      user: req.session,
      product: null,
      categories,
      error: null,
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post(
  "/products/add",
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, price, category, stock } = req.body;
      const image = req.file
        ? `/uploads/${req.file.filename}`
        : "/images/default-product.jpg";

      const product = new Product({
        name,
        description,
        price,
        category,
        stock,
        image,
      });

      await product.save();
      res.redirect("/admin/products");
    } catch (error) {
      const categories = await Category.find().sort({ name: 1 });
      res.render("admin/product-form", {
        user: req.session,
        product: null,
        categories,
        error: "Error adding product",
      });
    }
  }
);

router.get("/products/edit/:id", isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    const categories = await Category.find().sort({ name: 1 });
    res.render("admin/product-form", {
      user: req.session,
      product,
      categories,
      error: null,
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post(
  "/products/edit/:id",
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, price, category, stock } = req.body;
      const updateData = { name, description, price, category, stock };

      if (req.file) {
        updateData.image = `/uploads/${req.file.filename}`;
      }

      await Product.findByIdAndUpdate(req.params.id, updateData);
      res.redirect("/admin/products");
    } catch (error) {
      res.status(500).send("Server error");
    }
  }
);

router.post("/products/delete/:id", isAdmin, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/admin/products");
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// Categories Management
router.get("/categories", isAdmin, async (req, res) => {
  try {
    const search = req.query.search || "";
    const query = search ? { name: { $regex: search, $options: "i" } } : {};

    const categories = await Category.find(query).sort({ name: 1 });
    res.render("admin/categories", { user: req.session, categories, search });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/categories/add", isAdmin, (req, res) => {
  res.render("admin/category-form", {
    user: req.session,
    category: null,
    error: null,
  });
});

router.post("/categories/add", isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    const category = new Category({ name, description });
    await category.save();
    res.redirect("/admin/categories");
  } catch (error) {
    res.render("admin/category-form", {
      user: req.session,
      category: null,
      error: "Error adding category",
    });
  }
});

router.get("/categories/edit/:id", isAdmin, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    res.render("admin/category-form", {
      user: req.session,
      category,
      error: null,
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post("/categories/edit/:id", isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    await Category.findByIdAndUpdate(req.params.id, { name, description });
    res.redirect("/admin/categories");
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post("/categories/delete/:id", isAdmin, async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.redirect("/admin/categories");
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// Orders Management
router.get("/orders", isAdmin, async (req, res) => {
  try {
    const search = req.query.search || "";
    let query = {};

    if (search) {
      const users = await require("../models/User").find({
        fullName: { $regex: search, $options: "i" },
      });
      const userIds = users.map((u) => u._id);
      query = { user: { $in: userIds } };
    }

    const orders = await Order.find(query)
      .populate("user")
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.render("admin/orders", { user: req.session, orders, search });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/orders/:id", isAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user")
      .populate("items.product");
    res.render("admin/order-detail", { user: req.session, order });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post("/orders/:id/status", isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    await Order.findByIdAndUpdate(req.params.id, {
      status,
      updatedAt: Date.now(),
    });
    res.redirect(`/admin/orders/${req.params.id}`);
  } catch (error) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
