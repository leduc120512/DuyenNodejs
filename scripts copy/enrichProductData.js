/**
 * Database Enrichment Script
 * Adds semantic tags to products to improve AI search understanding
 * This script APPENDS to tags array without destroying existing data
 */

require("dotenv").config({ path: ".env" });
const mongoose = require("mongoose");
const Product = require("../models/Product");

const DB_URL = process.env.MONGODB_URL || "mongodb://localhost:27017/shop";

// Define semantic tags for different product types
const PRODUCT_ENRICHMENT_MAP = {
  // Áo (Shirts, T-shirts, Hoodies, Jackets)
  áo: {
    keywords: [
      "áo",
      "shirt",
      "tshirt",
      "camiseta",
      "hoodie",
      "váy",
      "áo khoác",
      "jacket",
    ],
    defaultTags: ["áo", "thời trang"],
    subtypes: {
      hoodie: ["hoodie", "nón", "dây kéo"],
      "áo dài": ["áo dài", "truyền thống", "lễ tết"],
      "áo sơ mi": ["sơ mi", "công sở", "trang trọng"],
      "áo phông": ["phông", "casual", "thoải mái"],
    },
  },

  // Giày (Shoes, Boots, Sneakers)
  giày: {
    keywords: [
      "giày",
      "shoe",
      "boot",
      "sneaker",
      "dép",
      "sandal",
      "giày cao",
      "boots",
    ],
    defaultTags: ["giày", "thời trang"],
    subtypes: {
      sneaker: ["sneaker", "thể thao", "nhẹ"],
      "giày cao": ["cao", "hợp thời trang", "dress"],
      boot: ["boot", "ấm áp", "mùa đông"],
      sandal: ["sandal", "mát", "mùa hè"],
    },
  },

  // Balo/Túi (Backpacks, Bags)
  balo: {
    keywords: [
      "balo",
      "backpack",
      "túi",
      "bag",
      "vali",
      "xách",
      "đựng",
      "ba lô",
    ],
    defaultTags: ["balo", "túi xách"],
    subtypes: {
      "balo học": ["học", "đi học", "tuổi teen"],
      "balo du lịch": ["du lịch", "du khách", "ngoài trời"],
      "balo chống nước": ["chống nước", "thoát nước", "bền"],
      "túi làm việc": ["công sở", "làm việc", "chuyên nghiệp"],
    },
  },

  // Quạt (Fans)
  quạt: {
    keywords: ["quạt", "fan", "máy thổi gió"],
    defaultTags: ["quạt", "điện"],
    subtypes: {
      "quạt bàn": ["bàn", "để bàn", "nhỏ gọn"],
      "quạt đứng": ["đứng", "cao", "dài"],
      "quạt treo tường": ["treo tường", "tường", "tiết kiệm"],
      "quạt điều hòa": ["điều hòa", "làm mát", "mạnh"],
    },
  },

  // Điện thoại & Phụ kiện
  "điện thoại": {
    keywords: ["điện thoại", "phone", "mobile", "smartphone"],
    defaultTags: ["điện thoại", "công nghệ"],
    subtypes: {
      iphone: ["iphone", "apple", "ios"],
      samsung: ["samsung", "android"],
      xiaomi: ["xiaomi", "giá tốt"],
    },
  },

  // Sách
  sách: {
    keywords: ["sách", "book", "truyện"],
    defaultTags: ["sách", "tri thức"],
    subtypes: {
      "truyện tranh": ["tranh", "manga", "comic"],
      "sách kỹ năng": ["kỹ năng", "học tập"],
      "tiểu thuyết": ["tiểu thuyết", "tâm lý"],
    },
  },
};

// Helper function to detect product type from name/description
function detectProductType(product) {
  const text = (
    (product.name || "") +
    " " +
    (product.description || "")
  ).toLowerCase();

  for (const [type, config] of Object.entries(PRODUCT_ENRICHMENT_MAP)) {
    for (const keyword of config.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return type;
      }
    }
  }

  // Check if product already has category
  if (product.category) {
    const categoryName =
      typeof product.category === "object"
        ? product.category.name
        : product.category;
    return categoryName?.toLowerCase() || null;
  }

  return null;
}

// Main enrichment function
async function enrichProducts() {
  try {
    await mongoose.connect(DB_URL);
    console.log("✓ Connected to MongoDB");

    const products = await Product.find({});
    console.log(`\nProcessing ${products.length} products...`);

    let updated = 0;
    let errors = 0;

    for (const product of products) {
      try {
        const productType = detectProductType(product);

        if (!productType) {
          console.log(`⚠ Skipped (unknown type): ${product.name}`);
          continue;
        }

        const config = PRODUCT_ENRICHMENT_MAP[productType.toLowerCase()];
        if (!config) {
          console.log(
            `⚠ Skipped (no config): ${product.name} (${productType})`
          );
          continue;
        }

        // Initialize tags if not exists
        if (!product.tags) {
          product.tags = [];
        }

        // Convert tags to set to avoid duplicates
        const tagSet = new Set(
          product.tags.map((t) => (typeof t === "string" ? t : t.name))
        );

        // Add default semantic tags
        config.defaultTags.forEach((tag) => tagSet.add(tag));

        // Detect and add subtype tags
        const text = (
          (product.name || "") +
          " " +
          (product.description || "")
        ).toLowerCase();

        for (const [subtype, subtypeTags] of Object.entries(
          config.subtypes || {}
        )) {
          const subtypeKeywords =
            typeof subtypeTags === "string" ? [subtype] : subtypeTags || [];
          for (const kw of subtypeKeywords) {
            if (text.includes(kw.toLowerCase())) {
              tagSet.forEach((tag) => {
                if (kw.toLowerCase() !== tag.toLowerCase() && !tagSet.has(kw)) {
                  tagSet.add(kw);
                }
              });
            }
          }
        }

        // Update product with merged tags (convert back to array)
        const newTags = Array.from(tagSet);

        // Only update if tags changed
        if (
          JSON.stringify(product.tags.sort()) !== JSON.stringify(newTags.sort())
        ) {
          product.tags = newTags;
          await product.save();
          console.log(
            `✓ Updated: ${product.name} → Tags: [${newTags.join(", ")}]`
          );
          updated++;
        } else {
          console.log(`- Unchanged: ${product.name}`);
        }
      } catch (err) {
        console.error(`✗ Error processing ${product.name}:`, err.message);
        errors++;
      }
    }

    console.log(`\n=== ENRICHMENT SUMMARY ===`);
    console.log(`✓ Updated: ${updated} products`);
    console.log(`✗ Errors: ${errors} products`);
    console.log(`✓ Total: ${products.length} products processed`);

    await mongoose.connection.close();
    console.log("\n✓ Disconnected from MongoDB");
  } catch (error) {
    console.error("Fatal error:", error.message);
    process.exit(1);
  }
}

// Run enrichment
enrichProducts();
