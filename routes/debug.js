const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// Check current products and sizes
router.get("/products-info", async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const productsWithSize = await Product.countDocuments({
      size: { $exists: true, $ne: null },
    });
    const sizeStats = await Product.aggregate([
      { $match: { size: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          minSize: { $min: "$size" },
          maxSize: { $max: "$size" },
          avgSize: { $avg: "$size" },
          count: { $sum: 1 },
        },
      },
    ]);

    const products = await Product.find()
      .select("name size price stock")
      .lean();

    res.json({
      totalProducts,
      productsWithSize,
      sizeStats: sizeStats[0] || {},
      products,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update products with test sizes
router.post("/update-product-sizes", async (req, res) => {
  try {
    const products = await Product.find().lean();

    // Assign sizes based on product index
    const sizes = [14, 16, 18, 20, 22, 24];
    for (let i = 0; i < products.length; i++) {
      const size = sizes[i % sizes.length];
      await Product.findByIdAndUpdate(products[i]._id, { size }, { new: true });
    }

    res.json({
      message: `Updated ${products.length} products with sizes`,
      sizes,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
