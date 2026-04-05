require("dotenv").config();

const connectDB = require("../config/database");
const Product = require("../models/Product");
require("../models/Category"); // thêm dòng này

const { buildProductSearchText } = require("../utils/buildProductSearchText");
const { getEmbedding } = require("../services/ollama.service");

async function main() {
  await connectDB();

  const products = await Product.find({}).populate("category", "name");

  console.log(`🔎 Found ${products.length} products`);

  for (const product of products) {
    try {
      const searchText = buildProductSearchText(product);
      const embedding = await getEmbedding(searchText);

      product.searchText = searchText;
      product.embedding = embedding;

      await product.save();

      console.log(`✅ Embedded: ${product.name}`);
    } catch (error) {
      console.error(`❌ Failed embedding: ${product.name}`, error.message);
    }
  }

  console.log("🎉 Done generating embeddings");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
