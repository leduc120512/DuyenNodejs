const express = require("express");
const router = express.Router();
const { isAdmin } = require("../middleware/auth");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const User = require("../models/User");
const Banner = require("../models/Banner");
const upload = require("../middleware/upload");
const {
  syncProductSearchData,
} = require("../services/productSearchSync.service");

function buildUserQuery(search, status) {
  const conditions = [];

  if (search) {
    conditions.push({
      $or: [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
      ],
    });
  }

  if (status === "active") {
    conditions.push({
      isActive: true,
      isBanned: false,
      $or: [{ lockUntil: null }, { lockUntil: { $lte: new Date() } }],
    });
  } else if (status === "inactive") {
    conditions.push({ isActive: false, isBanned: false });
  } else if (status === "banned") {
    conditions.push({ isBanned: true });
  } else if (status === "locked") {
    conditions.push({
      $or: [{ lockUntil: { $gt: new Date() } }, { loginAttempts: { $gte: 5 } }],
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return { $and: conditions };
}

function parseHomeOrder(value) {
  if (value === "" || value === undefined || value === null) {
    return 9999;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 9999 : parsed;
}

function parseListField(value) {
  if (!value || typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSortOrder(value, defaultValue = -1) {
  if (value === "asc") {
    return 1;
  }

  if (value === "desc") {
    return -1;
  }

  return defaultValue;
}

// Dashboard
router.get("/dashboard", isAdmin, async (req, res) => {
  try {
    const periodDays = req.query.period === "30" ? 30 : 7;
    const now = new Date();
    const dayKeys = [];
    const dayLabels = [];

    const formatDayKey = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const formatDayLabel = (date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      return `${day}/${month}`;
    };

    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      dayKeys.push(formatDayKey(d));
      dayLabels.push(formatDayLabel(d));
    }

    const fromDate = new Date(now);
    fromDate.setHours(0, 0, 0, 0);
    fromDate.setDate(fromDate.getDate() - (periodDays - 1));

    const [
      productCount,
      categoryCount,
      orderCount,
      pendingOrders,
      totalRevenueAgg,
      dailyOrderAgg,
      topViewedProducts,
      totalViewsAgg,
    ] = await Promise.all([
      Product.countDocuments(),
      Category.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: "pending" }),
      Order.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } },
      ]),
          $group: {
          const productsUnsorted = await Product.find(query)
            .populate("category");

          // Sort: in stock first, sold out at the end
          const products = productsUnsorted.sort((a, b) => {
            const aInStock = a.stock > 0 ? 1 : 0;
            const bInStock = b.stock > 0 ? 1 : 0;
      
            if (aInStock !== bInStock) {
              return bInStock - aInStock; // In stock products first
            }
      
            // For products with same stock status, sort by selected field
            if (sortBy === "viewCount" || sortBy === "sold") {
              return sortOrder === 1 
                ? (a[sortBy] || 0) - (b[sortBy] || 0)
                : (b[sortBy] || 0) - (a[sortBy] || 0);
            }
      
            // For homeOrder
            return sortOrder === 1
              ? (a.homeOrder || 9999) - (b.homeOrder || 9999)
              : (b.homeOrder || 9999) - (a.homeOrder || 9999);
          });
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$totalAmount" },
            orders: { $sum: 1 },
          },
        },
      ]),
      Product.find()
        .sort({ viewCount: -1, sold: -1 })
        .limit(10)
        .select("name viewCount sold")
        .lean(),
      Product.aggregate([
        { $group: { _id: null, totalViews: { $sum: "$viewCount" } } },
      ]),
    ]);

    const totalRevenue = totalRevenueAgg[0]?.totalRevenue || 0;
    const totalViews = totalViewsAgg[0]?.totalViews || 0;
    const averageOrderValue = orderCount ? totalRevenue / orderCount : 0;

    const dailyMap = new Map(
      dailyOrderAgg.map((item) => [
        item._id,
        {
          revenue: item.revenue || 0,
          orders: item.orders || 0,
        },
      ]),
    );

    const dailyRevenueSeries = dayKeys.map((label) =>
      Number(dailyMap.get(label)?.revenue || 0),
    );
    const dailyOrderSeries = dayKeys.map((label) =>
      Number(dailyMap.get(label)?.orders || 0),
    );

    const topProductLabels = topViewedProducts.map((p) => p.name);
    const topProductViewSeries = topViewedProducts.map((p) => p.viewCount || 0);
    const topProductSoldSeries = topViewedProducts.map((p) => p.sold || 0);

    res.render("admin/dashboard", {
      user: req.session,
      productCount,
      categoryCount,
      orderCount,
      pendingOrders,
      totalRevenue,
      averageOrderValue,
      totalViews,
      periodDays,
      dayKeys,
      dayLabels,
      dailyRevenueSeries,
      dailyOrderSeries,
      topProductLabels,
      topProductViewSeries,
      topProductSoldSeries,
      errorMessage: null,
    });
  } catch (error) {
    console.error("[ADMIN DASHBOARD ERROR]", error);

    res.render("admin/dashboard", {
      user: req.session,
      productCount: 0,
      categoryCount: 0,
      orderCount: 0,
      pendingOrders: 0,
      totalRevenue: 0,
      averageOrderValue: 0,
      totalViews: 0,
      periodDays: 7,
      dayKeys: [],
      dayLabels: [],
      dailyRevenueSeries: [],
      dailyOrderSeries: [],
      topProductLabels: [],
      topProductViewSeries: [],
      topProductSoldSeries: [],
      errorMessage: "Không thể tải đầy đủ dữ liệu thống kê. Vui lòng thử lại.",
    });
  }
});

router.get("/users", isAdmin, async (req, res) => {
  try {
    const search = req.query.search || "";
    const status = req.query.status || ""; // active / banned / locked

    const query = buildUserQuery(search, status);

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
      "-password -refreshTokens",
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
      "username email fullName role isActive isBanned banReason loginAttempts lockUntil",
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
    if (String(targetUser._id) === String(req.session.userId)) {
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
        targetUser.bannedBy = req.session.userId;
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
      "username email fullName role isActive isBanned banReason loginAttempts lockUntil",
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
    const sortBy = ["viewCount", "sold", "homeOrder"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "homeOrder";
    const defaultSortOrder = sortBy === "homeOrder" ? 1 : -1;
    const sortOrder = parseSortOrder(req.query.sortOrder, defaultSortOrder);
    const query = search ? { name: { $regex: search, $options: "i" } } : {};
    const sortQuery = {
      [sortBy]: sortOrder,
      createdAt: -1,
    };

    const products = await Product.find(query)
      .populate("category")
      .sort(sortQuery);
    res.render("admin/products", {
      user: req.session,
      products,
      search,
      sortBy,
      sortOrder: sortOrder === 1 ? "asc" : "desc",
    });
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
  upload.array("images", 8),
  async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        category,
        stock,
        homeOrder,
        color,
        size,
        tags,
        searchText,
      } = req.body;
      
        // Validate required fields
        if (!name || !description || !price || !category) {
          const categories = await Category.find().sort({ name: 1 });
          return res.render("admin/product-form", {
            user: req.session,
            product: null,
            categories,
            error: "Vui lòng điền đầy đủ các trường bắt buộc (Tên, Mô tả, Giá, Danh mục)",
          });
        }

      const uploadedImages = Array.isArray(req.files)
        ? req.files.map((file) => `/uploads/${file.filename}`)
        : [];

      const images = uploadedImages.length
        ? uploadedImages
        : ["/images/default-product.jpg"];

      const product = new Product({
        name,
        description,
        price,
        category,
        stock,
        homeOrder: parseHomeOrder(homeOrder),
        color: parseListField(color),
        size: parseListField(size),
        tags: parseListField(tags),
        searchText: (searchText || "").trim(),
        updatedAt: new Date(),
        image: images[0],
        images,
      });

      await product.save();
      await syncProductSearchData(product._id);
      res.redirect("/admin/products");
    } catch (error) {
        console.error("Add product error:", error);
      const categories = await Category.find().sort({ name: 1 });
      res.render("admin/product-form", {
        user: req.session,
        product: null,
        categories,
          error: "Lỗi khi thêm sản phẩm: " + error.message,
      });
    }
  },
);

router.get("/products/detail/:id", isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .lean();

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const embeddingLength = Array.isArray(product.embedding)
      ? product.embedding.length
      : 0;

    res.render("admin/product-detail", {
      user: req.session,
      product,
      embeddingLength,
      rawProductJson: JSON.stringify(product, null, 2),
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/products/edit/:id", isAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "category",
      "name",
    );

    if (!product) {
      return res.status(404).send("Product not found");
    }

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
  upload.array("images", 8),
  async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        category,
        stock,
        homeOrder,
        color,
        size,
        tags,
        searchText,
      } = req.body;
      const updateData = {
        name,
        description,
        price,
        category,
        stock,
        homeOrder: parseHomeOrder(homeOrder),
        color: parseListField(color),
        size: parseListField(size),
        tags: parseListField(tags),
        searchText: (searchText || "").trim(),
        updatedAt: new Date(),
      };

      const existingImagesRaw = req.body.existingImages;
      const existingImages = Array.isArray(existingImagesRaw)
        ? existingImagesRaw
        : existingImagesRaw
          ? [existingImagesRaw]
          : [];

      const newImages = Array.isArray(req.files)
        ? req.files.map((file) => `/uploads/${file.filename}`)
        : [];

      const mergedImages = [...existingImages, ...newImages].filter(Boolean);
      const finalImages = mergedImages.length
        ? mergedImages
        : ["/images/default-product.jpg"];

      updateData.images = finalImages;
      updateData.image = finalImages[0];

      const product = await Product.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
        },
      );

      if (product) {
        await syncProductSearchData(product._id);
      }

      res.redirect("/admin/products");
    } catch (error) {
      console.error("Edit product error:", error);
      const product = await Product.findById(req.params.id).populate(
        "category",
        "name",
      );
      const categories = await Category.find().sort({ name: 1 });
      res.render("admin/product-form", {
        user: req.session,
        product,
        categories,
        error: "Lỗi khi cập nhật sản phẩm: " + error.message,
      });
    }
  },
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

router.post(
  "/categories/add",
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description } = req.body;
      const image = req.file
        ? `/uploads/${req.file.filename}`
        : "/images/default-product.jpg";
      const category = new Category({ name, description, image });
      await category.save();
      res.redirect("/admin/categories");
    } catch (error) {
      res.render("admin/category-form", {
        user: req.session,
        category: null,
        error: "Error adding category",
      });
    }
  },
);

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

router.post(
  "/categories/edit/:id",
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description } = req.body;
      const updateData = { name, description };
      if (req.file) {
        updateData.image = `/uploads/${req.file.filename}`;
      }

      await Category.findByIdAndUpdate(req.params.id, updateData);
      res.redirect("/admin/categories");
    } catch (error) {
      res.status(500).send("Server error");
    }
  },
);

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

// Banner Management
router.get("/banners", isAdmin, async (req, res) => {
  try {
    const banners = await Banner.find().sort({ sortOrder: 1, createdAt: -1 });
    res.render("admin/banners", { user: req.session, banners });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.get("/banners/add", isAdmin, (req, res) => {
  res.render("admin/banner-form", {
    user: req.session,
    banner: null,
    error: null,
  });
});

router.post(
  "/banners/add",
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, description, link, sortOrder, isActive } = req.body;

      const image = req.file ? `/uploads/${req.file.filename}` : "";

      if (!image) {
        return res.render("admin/banner-form", {
          user: req.session,
          banner: null,
          error: "Banner image is required",
        });
      }

      await Banner.create({
        title,
        description,
        link: link || "/products",
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        isActive: isActive !== "false",
        image,
      });

      res.redirect("/admin/banners");
    } catch (error) {
      res.render("admin/banner-form", {
        user: req.session,
        banner: null,
        error: "Error adding banner",
      });
    }
  },
);

router.get("/banners/edit/:id", isAdmin, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).send("Banner not found");
    }

    res.render("admin/banner-form", {
      user: req.session,
      banner,
      error: null,
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post(
  "/banners/edit/:id",
  isAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      const { title, description, link, sortOrder, isActive } = req.body;
      const updateData = {
        title,
        description,
        link: link || "/products",
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        isActive: isActive !== "false",
      };

      if (req.file) {
        updateData.image = `/uploads/${req.file.filename}`;
      }

      await Banner.findByIdAndUpdate(req.params.id, updateData);
      res.redirect("/admin/banners");
    } catch (error) {
      res.status(500).send("Server error");
    }
  },
);

router.post("/banners/toggle/:id", isAdmin, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).send("Banner not found");
    }

    banner.isActive = !banner.isActive;
    await banner.save();
    res.redirect("/admin/banners");
  } catch (error) {
    res.status(500).send("Server error");
  }
});

router.post("/banners/delete/:id", isAdmin, async (req, res) => {
  try {
    await Banner.findByIdAndDelete(req.params.id);
    res.redirect("/admin/banners");
  } catch (error) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
