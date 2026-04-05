const Product = require("../models/Product");
const { buildProductSearchText } = require("../utils/buildProductSearchText");
const { getEmbedding } = require("./ollama.service");

async function syncProductSearchData(productId) {
  const product = await Product.findById(productId).populate(
    "category",
    "name"
  );

  if (!product) {
    throw new Error("Product not found");
  }

  const searchText = buildProductSearchText(product);
  const embedding = await getEmbedding(searchText);

  product.searchText = searchText;
  product.embedding = embedding;

  await product.save();

  return product;
}

module.exports = {
  syncProductSearchData,
};
