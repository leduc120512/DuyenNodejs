function normalizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(Boolean).map((item) => String(item).trim().toLowerCase());
}

function buildProductSearchText(product) {
  const name = product?.name ? String(product.name).trim() : "";
  const description = product?.description
    ? String(product.description).trim()
    : "";
  const tags = normalizeArray(product?.tags).join(", ");
  const colors = normalizeArray(product?.color).join(", ");
  const sizes = normalizeArray(product?.size).join(", ");

  let categoryName = "";
  if (
    product?.category &&
    typeof product.category === "object" &&
    product.category.name
  ) {
    categoryName = String(product.category.name).trim();
  }

  return [name, description, categoryName, tags, colors, sizes]
    .filter(Boolean)
    .join(", ")
    .trim();
}

module.exports = {
  buildProductSearchText,
};
