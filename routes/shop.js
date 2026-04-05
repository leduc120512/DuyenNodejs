const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");

const router = express.Router();

const Product = require("../models/Product");
const Category = require("../models/Category");
const Banner = require("../models/Banner");
const Comment = require("../models/Comment");
const UserHistory = require("../models/UserHistory");
const Order = require("../models/Order");

const { isAuthenticated, isUser } = require("../middleware/auth");

// Home page
router.get("/", async (req, res) => {
  try {
    console.log("===== ROUTE / (HOME) STARTED =====");

    const userId = req.session?.userId?.toString() || req.query.userId || null;
    console.log("User ID:", userId || "(anonymous)");

    const [topProducts, latestProducts, categories, banners] =
      await Promise.all([
        Product.find()
          .populate("category", "name")
          .sort({ sold: -1 })
          .limit(8)
          .lean(),

        Product.find()
          .populate("category", "name")
          .sort({ homeOrder: 1, createdAt: -1 })
          .limit(12)
          .lean(),

        Category.find().select("name image").lean(),

        Banner.find({ isActive: true })
          .sort({ sortOrder: 1, createdAt: -1 })
          .lean(),
      ]);

    const fallbackBanners = topProducts.slice(0, 5).map((product) => ({
      image:
        product.images && product.images.length
          ? product.images[0]
          : product.image || "/images/banner.png",
      title: product.name,
      description: product.description
        ? product.description.slice(0, 90)
        : "San pham chinh hang - mua sam thong minh",
      link: `/products/${product._id}`,
    }));

    const heroBanners = banners.length
      ? banners.map((banner) => ({
          image: banner.image || "/images/banner.png",
          title: banner.title,
          description: banner.description,
          link: banner.link || "/products",
        }))
      : fallbackBanners;

    let recommendedProducts = [];

    if (userId) {
      try {
        console.log(`Calling recommendation service for user ${userId}...`);
        const { data, status } = await axios.get(
          `http://127.0.0.1:5000/recommend/${userId}`,
          { timeout: 5000 },
        );

        console.log(`AI response status: ${status}`);

        if (Array.isArray(data) && data.length > 0) {
          recommendedProducts = data;
        } else {
          console.warn("AI returned invalid format:", data);
        }
      } catch (aiError) {
        console.error("Recommendation service error:", {
          message: aiError.message,
          response: aiError.response?.data,
          status: aiError.response?.status,
        });
      }
    }

    console.log(`Recommended products count: ${recommendedProducts.length}`);

    res.render("shop/home", {
      user: req.session || null,
      topProducts,
      products: latestProducts,
      categories,
      heroBanners,
      recommendedProducts,
      hasRecommendations: recommendedProducts.length > 0,
      pageTitle: "Trang chủ - Cửa hàng",
    });
  } catch (error) {
    console.error("HOME ROUTE CRITICAL ERROR:", error);
    res.status(500).render("error", {
      message: "Có lỗi xảy ra. Vui lòng thử lại sau.",
      error: process.env.NODE_ENV === "development" ? error : null,
    });
  }
});

// All products (with search & filter)
router.get("/products", async (req, res) => {
  try {
    const search = req.query.search || "";
    const categoryId = req.query.category || "";

    const query = {};
    if (search) query.name = { $regex: search, $options: "i" };
    if (categoryId) query.category = categoryId;

    const products = await Product.find(query)
      .populate("category")
      .sort({ createdAt: -1 })
      .lean();

    const categories = await Category.find().sort({ name: 1 }).lean();

    let recommendedProducts = [];
    if (req.session?.userId) {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/recommend/${req.session.userId}`,
          { timeout: 5000 },
        );
        if (Array.isArray(response.data)) {
          recommendedProducts = response.data;
        }
      } catch (err) {
        console.error("AI recommend error on /products:", err.message);
      }
    }

    res.render("shop/products", {
      user: req.session || null,
      products,
      categories,
      search,
      selectedCategory: categoryId,
      recommendedProducts,
    });
  } catch (error) {
    console.error("PRODUCTS PAGE ERROR:", error);
    res.status(500).render("error", { message: "Lỗi tải danh sách sản phẩm" });
  }
});
router.get("/api/ai-suggest", async (req, res) => {
  try {
    if (!req.session?.userId) return res.json([]);

    // gá»i AI service
    const response = await axios.get(
      `http://127.0.0.1:5000/recommend/${req.session.userId}`,
      { timeout: 5000 },
    );

    const recommendedIds = response.data;

    if (!Array.isArray(recommendedIds) || !recommendedIds.length) {
      return res.json([]);
    }

    // láº¥y product tá»« MongoDB
    const products = await Product.find({
      _id: { $in: recommendedIds },
    })
      .select("_id name price image")
      .lean();

    res.json(products);
  } catch (err) {
    console.error("AI suggest error:", err.message);
    res.json([]);
  }
});
// Product detail
router.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Kiá»ƒm tra ID há»£p lá»‡
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).render("error", {
        message: "ID sản phẩm không hợp lệ",
      });
    }

    // 2. TÃ¬m sáº£n pháº©m + populate category (láº¥y tÃªn category)
    const product = await Product.findById(id)
      .populate("category", "name") // populate tÃªn category Ä‘á»ƒ hiá»ƒn thá»‹
      .lean(); // dÃ¹ng lean Ä‘á»ƒ nhanh hÆ¡n khi chá»‰ hiá»ƒn thá»‹

    if (!product) {
      return res.status(404).render("error", {
        message: "Không tìm thấy sản phẩm",
      });
    }

    await Product.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });
    product.viewCount = (product.viewCount || 0) + 1;

    // 3. LÆ¯U Lá»ŠCH Sá»¬ XEM VÃ€O USERHISTORY (chá»‰ khi Ä‘Ã£ Ä‘Äƒng nháº­p)
    // Má»—i láº§n xem táº¡o 1 record riÃªng (nhÆ° anh yÃªu cáº§u)
    if (req.session?.userId) {
      try {
        await UserHistory.create({
          user: req.session.userId,
          product: product._id,
          action: "view",
          // createdAt sáº½ tá»± Ä‘á»™ng set theo default trong schema
        });

        // Log Ä‘á»ƒ debug (cÃ³ thá»ƒ comment khi production)
        console.log(
          `[HISTORY] ÄÃ£ lÆ°u view: user ${req.session.userId} â†’ product ${product._id}`,
        );
      } catch (historyErr) {
        console.error(
          "[HISTORY ERROR] LÆ°u view tháº¥t báº¡i:",
          historyErr.message,
        );
        // KhÃ´ng throw â†’ váº«n render trang bÃ¬nh thÆ°á»ng
      }
    } else {
      console.log("[HISTORY] Không lưu view: người dùng chưa đăng nhập");
    }

    // 4. Láº¥y comments + replies
    const allComments = await Comment.find({ product: id })
      .populate("user", "fullName avatar") // populate tÃªn + avatar ngÆ°á»i comment
      .sort({ createdAt: 1 })
      .lean();

    const comments = allComments.filter((c) => !c.parentComment);
    const replies = allComments.filter((c) => c.parentComment);

    // Gáº¯n replies vÃ o comment cha
    comments.forEach((c) => {
      c.replies = replies.filter(
        (r) => String(r.parentComment) === String(c._id),
      );
    });

    // 5. Gá»i AI recommend (náº¿u ngÆ°á»i dÃ¹ng Ä‘Ã£ Ä‘Äƒng nháº­p)
    let recommendedProducts = [];

    if (req.session?.userId) {
      try {
        const response = await axios.get(
          `http://127.0.0.1:5000/recommend/${req.session.userId}`,
          { timeout: 5000 }, // trÃ¡nh treo náº¿u Flask cháº­m
        );

        if (Array.isArray(response.data) && response.data.length > 0) {
          recommendedProducts = response.data;
          console.log(
            `[RECOMMEND] Nháº­n Ä‘Æ°á»£c ${recommendedProducts.length} sáº£n pháº©m gá»£i Ã½`,
          );
        } else {
          console.log(
            "[RECOMMEND] AI trả về dữ liệu không hợp lệ hoặc rỗng:",
            response.data,
          );
        }
      } catch (aiErr) {
        console.error("[RECOMMEND ERROR] Lỗi gọi API recommend:", {
          message: aiErr.message,
          status: aiErr.response?.status,
        });
        // KhÃ´ng throw â†’ váº«n render trang
      }
    }

    // 6. Render trang chi tiáº¿t sáº£n pháº©m
    res.render("shop/product-detail", {
      user: req.session || null,
      product,
      comments,
      recommendedProducts,
      // CÃ¡c biáº¿n há»— trá»£ giao diá»‡n (tÃ¹y chá»n)
      pageTitle: `${product.name} - Shop thương mại điện tử`,
      hasComments: comments.length > 0,
      hasRecommendations: recommendedProducts.length > 0,
    });
  } catch (error) {
    console.error("[PRODUCT DETAIL] Lỗi nghiêm trọng:", error);
    res.status(500).render("error", {
      message: "Có lỗi xảy ra khi tải chi tiết sản phẩm. Vui lòng thử lại sau.",
    });
  }
});
// Post comment
router.post("/products/:id/comment", isAuthenticated, async (req, res) => {
  try {
    const { content, parentId } = req.body;
    if (!content?.trim()) return res.redirect(`/products/${req.params.id}`);

    await Comment.create({
      product: req.params.id,
      user: req.session.userId,
      content,
      parentComment: parentId || null,
    });

    res.redirect(`/products/${req.params.id}`);
  } catch (error) {
    console.error("COMMENT ERROR:", error);
    res.status(500).send("Lỗi gửi bình luận");
  }
});

// Cart routes (add, view, update, remove)
router.post("/cart/add", isAuthenticated, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const product = await Product.findById(productId).lean();

    if (!product) return res.redirect("/products");

    // LÆ°u history "add to cart" (náº¿u muá»‘n phÃ¢n biá»‡t vá»›i view)
    if (req.session?.userId) {
      await UserHistory.create({
        user: req.session.userId,
        product: product._id,
        action: "add_to_cart",
      }).catch((err) =>
        console.error("History add_to_cart error:", err.message),
      );
    }

    if (!req.session.cart) req.session.cart = [];

    const existing = req.session.cart.find(
      (item) => item.productId === productId,
    );
    if (existing) {
      existing.quantity += Number.parseInt(quantity) || 1;
    } else {
      req.session.cart.push({
        productId,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: Number.parseInt(quantity) || 1,
      });
    }

    res.redirect("/cart");
  } catch (error) {
    console.error("ADD TO CART ERROR:", error);
    res.status(500).send("Server error");
  }
});

router.get("/cart", isAuthenticated, (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render("shop/cart", { user: req.session, cart, total });
});

router.post("/cart/update", isAuthenticated, (req, res) => {
  try {
    const { productId, quantity } = req.body;
    let cart = req.session.cart || [];

    const item = cart.find((i) => i.productId === productId);
    if (item) {
      const qty = Number.parseInt(quantity);
      if (qty <= 0) {
        cart = cart.filter((i) => i.productId !== productId);
      } else {
        item.quantity = qty;
      }
      req.session.cart = cart;
    }

    res.redirect("/cart");
  } catch (error) {
    console.error("UPDATE CART ERROR:", error);
    res.status(500).send("Server error");
  }
});

router.post("/cart/remove", isAuthenticated, (req, res) => {
  try {
    const { productId } = req.body;
    req.session.cart = (req.session.cart || []).filter(
      (item) => item.productId !== productId,
    );
    res.redirect("/cart");
  } catch (error) {
    console.error("REMOVE FROM CART ERROR:", error);
    res.status(500).send("Server error");
  }
});

// Checkout & Order
router.get("/checkout", isAuthenticated, async (req, res) => {
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect("/cart");

    const User = require("../models/User");
    const user = await User.findById(req.session.userId).lean();
    const total = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    res.render("shop/checkout", {
      user: req.session,
      cart,
      total,
      userInfo: user,
    });
  } catch (error) {
    console.error("CHECKOUT PAGE ERROR:", error);
    res.status(500).send("Server error");
  }
});

router.post("/checkout", isAuthenticated, async (req, res) => {
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect("/cart");

    const { fullName, phone, address } = req.body;

    const items = [];
    for (const cartItem of cart) {
      const product = await Product.findById(cartItem.productId);
      if (product && product.stock >= cartItem.quantity) {
        items.push({
          product: product._id,
          quantity: cartItem.quantity,
          price: product.price,
        });
        product.stock -= cartItem.quantity;
        product.sold += cartItem.quantity;
        await product.save();
      }
    }

    if (items.length === 0) return res.redirect("/cart");

    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const order = new Order({
      user: req.session.userId,
      items,
      totalAmount,
      shippingAddress: { fullName, phone, address },
    });

    await order.save();

    // LÆ°u history purchase
    for (const item of items) {
      await UserHistory.create({
        user: req.session.userId,
        product: item.product,
        action: "purchase",
      }).catch((err) => console.error("Purchase history error:", err.message));
    }

    req.session.cart = [];
    res.redirect("/orders");
  } catch (error) {
    console.error("PLACE ORDER ERROR:", error);
    res.status(500).send("Server error");
  }
});

// Orders
router.get("/orders", isAuthenticated, async (req, res) => {
  try {
    const search = req.query.search || "";
    const query = { user: req.session.userId };

    if (search) {
      const products = await Product.find({
        name: { $regex: search, $options: "i" },
      }).lean();
      query["items.product"] = { $in: products.map((p) => p._id) };
    }

    const orders = await Order.find(query)
      .populate("items.product")
      .sort({ createdAt: -1 })
      .lean();

    res.render("shop/orders", { user: req.session, orders, search });
  } catch (error) {
    console.error("ORDERS ERROR:", error);
    res.status(500).send("Server error");
  }
});

router.get("/orders/:id", isAuthenticated, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.session.userId,
    })
      .populate("items.product")
      .lean();

    if (!order) return res.redirect("/orders");

    res.render("shop/order-detail", { user: req.session, order });
  } catch (error) {
    console.error("ORDER DETAIL ERROR:", error);
    res.status(500).send("Server error");
  }
});

router.post("/orders/:id/cancel", isAuthenticated, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.session.userId,
    }).populate("items.product");

    if (order && order.status === "pending") {
      for (const item of order.items) {
        const product = await Product.findById(item.product._id);
        if (product) {
          product.stock += item.quantity;
          product.sold -= item.quantity;
          await product.save();
        }
      }
      order.status = "cancelled";
      await order.save();
    }

    res.redirect("/orders");
  } catch (error) {
    console.error("CANCEL ORDER ERROR:", error);
    res.status(500).send("Server error");
  }
});

// Profile
router.get("/profile", isAuthenticated, async (req, res) => {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.session.userId).lean();
    res.render("shop/profile", {
      user: req.session,
      userInfo: user,
      error: null,
      success: null,
    });
  } catch (error) {
    console.error("PROFILE ERROR:", error);
    res.status(500).send("Server error");
  }
});

router.post("/profile", isAuthenticated, async (req, res) => {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.session.userId);

    const { fullName, email, phone, address, currentPassword, newPassword } =
      req.body;

    user.fullName = fullName || user.fullName;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.address = address || user.address;

    if (newPassword) {
      if (!currentPassword || !(await user.comparePassword(currentPassword))) {
        return res.render("shop/profile", {
          user: req.session,
          userInfo: user,
          error: "Mật khẩu hiện tại không đúng",
          success: null,
        });
      }
      user.password = newPassword; // giáº£ Ä‘á»‹nh model tá»± hash
    }

    await user.save();
    req.session.userName = user.fullName;

    res.render("shop/profile", {
      user: req.session,
      userInfo: user,
      error: null,
      success: "Cập nhật hồ sơ thành công",
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.render("shop/profile", {
      user: req.session,
      userInfo: { ...req.body },
      error: "Lỗi cập nhật hồ sơ",
      success: null,
    });
  }
});

module.exports = router;
