const Product = require("../models/Product");

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Build MongoDB query with flexible keyword search + price filter
function buildMongoQuery(searchFilter) {
  const query = {
    $and: [],
  };

  // Stock filter
  if (searchFilter.needsInStock) {
    query.$and.push({ stock: { $gt: 0 } });
  }

  // Price filter
  if (
    typeof searchFilter.minPrice === "number" ||
    typeof searchFilter.maxPrice === "number"
  ) {
    const priceQuery = {};
    if (typeof searchFilter.minPrice === "number") {
      priceQuery.$gte = searchFilter.minPrice;
    }
    if (typeof searchFilter.maxPrice === "number") {
      priceQuery.$lte = searchFilter.maxPrice;
    }
    query.$and.push({ price: priceQuery });
  }

  // Separate size keywords from other keywords
  // Size keywords are those that match patterns like "16 inch", "20", etc.
  const sizeKeywords = [];
  const otherKeywords = [];

  if (searchFilter.keywords && searchFilter.keywords.length > 0) {
    for (const kw of searchFilter.keywords) {
      // Detect size keywords: contains numbers (with inch/cm) or is just a number
      if (/^\d+\s*(inch|cm|"|\')?$/.test(kw.trim())) {
        sizeKeywords.push(kw);
      } else {
        otherKeywords.push(kw);
      }
    }
  }

  // Size keywords are REQUIRED - add as strict $and conditions
  if (sizeKeywords.length > 0) {
    for (const sizeKw of sizeKeywords) {
      const sizeCondition = {
        $or: [
          { name: { $regex: sizeKw, $options: "i" } },
          { description: { $regex: sizeKw, $options: "i" } },
        ],
      };
      query.$and.push(sizeCondition);
    }
  }

  // Other keywords are optional - match ANY in $or
  if (otherKeywords.length > 0) {
    const keywordConditions = [];
    for (const kw of otherKeywords) {
      keywordConditions.push({ name: { $regex: kw, $options: "i" } });
      keywordConditions.push({ description: { $regex: kw, $options: "i" } });
    }
    query.$and.push({ $or: keywordConditions });
  }

  // Simplify if only one condition in $and
  const finalQuery = query.$and.length === 1 ? query.$and[0] : query;

  console.log("[SEARCH] MongoDB Query:", JSON.stringify(finalQuery));
  console.log("[SEARCH] Filter Input:", searchFilter);
  console.log("[SEARCH] Size Keywords:", sizeKeywords);
  console.log("[SEARCH] Other Keywords:", otherKeywords);
  return finalQuery;
}

// Score product based on how many keywords match
function scoreProduct(product, searchFilter) {
  let matchCount = 0;
  let score = 0;

  if (!searchFilter.keywords || searchFilter.keywords.length === 0) {
    // No keywords = flat score
    score = product.stock > 0 ? 10 : 0;
    return score;
  }

  const name = normalizeText(product.name || "");
  const desc = normalizeText(product.description || "");
  const category = normalizeText(product.category?.name || "");
  const tags = (product.tags || []).map(normalizeText);

  // Separate size keywords from other keywords
  const sizeKeywords = [];
  const otherKeywords = [];
  for (const kw of searchFilter.keywords) {
    if (/^\d+\s*(inch|cm|"|\')?$/.test(kw.trim())) {
      sizeKeywords.push(kw);
    } else {
      otherKeywords.push(kw);
    }
  }

  // Count how many keywords match
  for (const keyword of searchFilter.keywords) {
    const kwNorm = normalizeText(keyword);
    if (!kwNorm) continue;

    if (name.includes(kwNorm)) {
      // Size keywords in name get extra boost (+12 instead of +8)
      const boost = sizeKeywords.includes(keyword) ? 12 : 8;
      score += boost;
      matchCount++;
    } else if (desc.includes(kwNorm)) {
      // Size keywords in description also get boost (+6 instead of +4)
      const boost = sizeKeywords.includes(keyword) ? 6 : 4;
      score += boost;
      matchCount++;
    } else if (category.includes(kwNorm)) {
      score += 3; // Keyword in category
      matchCount++;
    } else if (tags.some((tag) => tag.includes(kwNorm))) {
      score += 2; // Keyword in tags
      matchCount++;
    }
  }

  // Boost score for popular products
  if (product.stock > 0) score += 1;
  score += Math.min(product.sold || 0, 50) * 0.1;

  return { score, matchCount };
}

function sortProducts(products, sortBy) {
  switch (sortBy) {
    case "price_asc":
      return products.sort((a, b) => a.price - b.price);
    case "price_desc":
      return products.sort((a, b) => b.price - a.price);
    case "best_selling":
      return products.sort((a, b) => (b.sold || 0) - (a.sold || 0));
    case "newest":
      return products.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    case "relevance":
    default:
      return products.sort((a, b) => {
        // Sort by score first, then by match count, then by sold
        if (b.searchScore !== a.searchScore) {
          return b.searchScore - a.searchScore;
        }
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount;
        }
        return (b.sold || 0) - (a.sold || 0);
      });
  }
}

async function findRecommendedProducts(searchFilter) {
  const mongoQuery = buildMongoQuery(searchFilter);

  const products = await Product.find(mongoQuery)
    .populate("category", "name")
    .lean();

  console.log(`[SEARCH] MongoDB returned ${products.length} products`);

  // Score each product
  const scored = products.map((product) => {
    const { score, matchCount } = scoreProduct(product, searchFilter);
    return {
      ...product,
      searchScore: score,
      matchCount: matchCount,
    };
  });

  // Filter: only keep products with at least 1 keyword match
  // (unless no keywords provided)
  const filtered =
    searchFilter.keywords && searchFilter.keywords.length > 0
      ? scored.filter((p) => p.matchCount > 0)
      : scored;

  const sorted = sortProducts(filtered, searchFilter.sortBy);
  console.log(`[SEARCH] Final result: ${sorted.length} products`);

  return sorted.slice(0, 6);
}

module.exports = {
  findRecommendedProducts,
};
