const Product = require("../models/Product");
const UserHistory = require("../models/UserHistory");
const { parseUserQuery, normalizeText } = require("../utils/parseUserQuery");
const cosineSimilarity = require("../utils/cosineSimilarity");
const {
  getEmbedding,
  checkEmbeddingServiceReady,
} = require("../services/ollama.service");

function mapColorToStoredValue(color) {
  const map = {
    den: "đen",
    trang: "trắng",
    do: "đỏ",
    xanh: "xanh",
    vang: "vàng",
    hong: "hồng",
    xam: "xám",
    nau: "nâu",
    tim: "tím",
    cam: "cam",
    be: "be",
  };

  return map[color] || color;
}

function buildMongoFilter(parsed) {
  const filter = {
    stock: { $gt: 0 },
  };

  if (parsed.minPrice !== null || parsed.maxPrice !== null) {
    filter.price = {};

    if (parsed.minPrice !== null) {
      filter.price.$gte = parsed.minPrice;
    }

    if (parsed.maxPrice !== null) {
      filter.price.$lte = parsed.maxPrice;
    }
  }

  if (parsed.color) {
    const normalizedColor = normalizeText(mapColorToStoredValue(parsed.color));

    filter.color = {
      $elemMatch: {
        $regex: new RegExp(normalizedColor, "i"),
      },
    };
  }

  if (parsed.size) {
    filter.size = {
      $elemMatch: {
        $regex: new RegExp(`^${parsed.size}$`, "i"),
      },
    };
  }

  return filter;
}

function buildKeywordRegex(message) {
  const normalized = normalizeText(message || "");
  const terms = normalized
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 1)
    .slice(0, 8);

  if (!terms.length) {
    return null;
  }

  return new RegExp(terms.join("|"), "i");
}

async function fallbackSearchProducts(message, parsed) {
  const mongoFilter = buildMongoFilter(parsed);
  const keywordRegex = buildKeywordRegex(message);

  if (keywordRegex) {
    mongoFilter.$or = [
      { name: { $regex: keywordRegex } },
      { description: { $regex: keywordRegex } },
      { searchText: { $regex: keywordRegex } },
      { tags: { $elemMatch: { $regex: keywordRegex } } },
    ];
  }

  const products = await Product.find(mongoFilter)
    .populate("category", "name")
    .sort({ sold: -1, homeOrder: 1, createdAt: -1 })
    .limit(10)
    .lean();

  return products.map((product) => {
    const { embedding, searchText, ...safeProduct } = product;
    return safeProduct;
  });
}

async function getTopViewedSuggestions(query = "", limit = 3) {
  const safeLimit = Math.min(Math.max(Number(limit) || 3, 1), 10);
  const keyword = String(query || "").trim();

  const products = await Product.find({ stock: { $gt: 0 } })
    .select(
      "name price image viewCount sold searchText description tags createdAt",
    )
    .sort({ viewCount: -1, sold: -1, createdAt: -1 })
    .limit(keyword ? 120 : safeLimit)
    .lean();

  const normalizedKeyword = normalizeText(keyword);
  const filteredProducts = normalizedKeyword
    ? products.filter((product) => {
        const textBucket = normalizeText(
          [
            product.name,
            product.description,
            product.searchText,
            Array.isArray(product.tags) ? product.tags.join(" ") : "",
          ]
            .filter(Boolean)
            .join(" "),
        );

        return textBucket.includes(normalizedKeyword);
      })
    : products;

  return filteredProducts.slice(0, safeLimit).map((product) => ({
    type: "top_viewed",
    keyword: product.name,
    product,
    createdAt: product.createdAt || new Date(0),
    viewCount: Number(product.viewCount || 0),
  }));
}

function tokenizeQuery(query = "") {
  return normalizeText(query)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 1)
    .slice(0, 8);
}

function countMatchedTerms(product, terms) {
  if (!terms.length) return 0;

  const name = normalizeText(product.name || "");
  const description = normalizeText(product.description || "");
  const searchText = normalizeText(product.searchText || "");
  const tags = Array.isArray(product.tags)
    ? product.tags.map((tag) => normalizeText(tag)).join(" ")
    : "";
  const textBucket = `${name} ${description} ${searchText} ${tags}`;

  return terms.reduce((count, term) => {
    return textBucket.includes(term) ? count + 1 : count;
  }, 0);
}

async function getRelatedProductSuggestions(query = "", limit = 6) {
  const terms = tokenizeQuery(query);

  if (!terms.length) {
    return [];
  }

  const products = await Product.find({
    stock: { $gt: 0 },
  })
    .select(
      "name price image sold viewCount searchText description tags createdAt",
    )
    .sort({ viewCount: -1, sold: -1, createdAt: -1 })
    .limit(200)
    .lean();

  const joinedQuery = terms.join(" ");
  const ranked = products
    .map((product) => ({
      product,
      matchScore: countMatchedTerms(product, terms),
      prefixBoost: normalizeText(product.name || "").startsWith(joinedQuery)
        ? 2
        : 0,
    }))
    .filter((item) => item.matchScore > 0)
    .sort((a, b) => {
      const aFinalScore = a.matchScore + a.prefixBoost;
      const bFinalScore = b.matchScore + b.prefixBoost;
      if (bFinalScore !== aFinalScore) return bFinalScore - aFinalScore;
      if ((b.product.viewCount || 0) !== (a.product.viewCount || 0)) {
        return (b.product.viewCount || 0) - (a.product.viewCount || 0);
      }
      return (b.product.sold || 0) - (a.product.sold || 0);
    })
    .slice(0, Math.min(Math.max(Number(limit) || 6, 1), 12));

  return ranked.map((item) => ({
    type: "related_product",
    keyword: item.product.name,
    product: item.product,
    createdAt: item.product.createdAt || new Date(0),
    viewCount: Number(item.product.viewCount || 0),
    matchScore: item.matchScore,
  }));
}

exports.aiSearchProducts = async (req, res, next) => {
  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        ok: false,
        message: "Vui lòng nhập nội dung tìm kiếm",
      });
    }

    const parsed = parseUserQuery(message);
    const aiHealth = await checkEmbeddingServiceReady();

    let rankedProducts = [];
    let replyPrefix = "";

    if (aiHealth.ok) {
      try {
        const queryEmbedding = await getEmbedding(message);
        const mongoFilter = buildMongoFilter(parsed);

        const products = await Product.find(mongoFilter)
          .populate("category", "name")
          .lean();

        rankedProducts = products
          .filter(
            (product) =>
              Array.isArray(product.embedding) && product.embedding.length > 0,
          )
          .map((product) => {
            const score = cosineSimilarity(queryEmbedding, product.embedding);

            return {
              ...product,
              score,
            };
          })
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.sold !== a.sold) return b.sold - a.sold;
            return a.price - b.price;
          })
          .slice(0, 10);
      } catch (embeddingError) {
        console.error("AI SEARCH EMBEDDING ERROR:", embeddingError.message);
      }
    }

    if (!rankedProducts.length) {
      rankedProducts = await fallbackSearchProducts(message, parsed);
      if (!aiHealth.ok) {
        replyPrefix =
          "(AI tam thoi chua san sang, da chuyen sang tim kiem thuong) ";
      }
    }

    if (req.session?.userId) {
      await UserHistory.create({
        user: req.session.userId,
        product: rankedProducts[0]?._id,
        action: "search",
        searchKeyword: message,
      }).catch((historyError) => {
        console.error("SEARCH HISTORY ERROR:", historyError.message);
      });
    }

    let reply = "Không tìm thấy sản phẩm phù hợp.";

    if (rankedProducts.length > 0) {
      reply = `${replyPrefix}Tôi tìm thấy ${rankedProducts.length} sản phẩm phù hợp nhất cho bạn.`;
    }

    return res.json({
      ok: true,
      reply,
      parsed,
      products: rankedProducts.map((product) => {
        const { embedding, searchText, ...safeProduct } = product;
        return safeProduct;
      }),
    });
  } catch (error) {
    return next(error);
  }
};

exports.getSearchHistorySuggestions = async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    const daysInput = Number.parseInt(String(req.query.days || "7"), 10);
    const days = Number.isNaN(daysInput)
      ? 7
      : Math.min(Math.max(daysInput, 1), 30);
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const relatedSuggestions = query
      ? await getRelatedProductSuggestions(query, 6)
      : [];
    const topViewedSuggestions = await getTopViewedSuggestions(query, 3);

    if (!req.session?.userId) {
      const guestSuggestions = relatedSuggestions.length
        ? [...relatedSuggestions, ...topViewedSuggestions]
        : topViewedSuggestions;

      return res.json({
        ok: true,
        suggestions: guestSuggestions,
      });
    }

    const filter = {
      user: req.session.userId,
      action: "search",
      searchKeyword: { $exists: true, $ne: "" },
      createdAt: { $gte: sinceDate },
    };

    const searchHistories = await UserHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(80)
      .populate("product", "name price image")
      .lean();

    const viewedHistories = await UserHistory.find({
      user: req.session.userId,
      action: "view",
      product: { $exists: true, $ne: null },
      createdAt: { $gte: sinceDate },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("product", "name price image")
      .lean();

    const seenKeywords = new Set();
    const seenProducts = new Set();
    const historySuggestions = [];
    const viewedSuggestions = [];
    const normalizedQuery = normalizeText(query);

    for (const item of searchHistories) {
      const keyword = String(item.searchKeyword || "").trim();
      if (!keyword) continue;

      const normalizedKeyword = normalizeText(keyword);
      if (seenKeywords.has(normalizedKeyword)) continue;

      if (normalizedQuery && !normalizedKeyword.includes(normalizedQuery)) {
        continue;
      }

      seenKeywords.add(normalizedKeyword);
      historySuggestions.push({
        type: "search",
        keyword,
        product: item.product || null,
        createdAt: item.createdAt,
      });

      if (historySuggestions.length >= 5) break;
    }

    for (const item of viewedHistories) {
      if (!item.product?._id || !item.product?.name) continue;

      const productId = String(item.product._id);
      if (seenProducts.has(productId)) continue;

      if (
        normalizedQuery &&
        !normalizeText(item.product.name).includes(normalizedQuery)
      ) {
        continue;
      }

      seenProducts.add(productId);
      viewedSuggestions.push({
        type: "viewed",
        product: item.product,
        createdAt: item.createdAt,
      });

      if (viewedSuggestions.length >= 3) break;
    }

    const existingProductIds = new Set(
      viewedSuggestions
        .map((item) => String(item.product?._id || ""))
        .filter(Boolean),
    );

    const mergedTopViewed = topViewedSuggestions.filter((item) => {
      const productId = String(item.product?._id || "");
      return productId && !existingProductIds.has(productId);
    });

    const filteredRelated = relatedSuggestions.filter((item) => {
      if (!normalizedQuery) return true;

      const keywordText = normalizeText(item.keyword || "");
      const productName = normalizeText(item.product?.name || "");
      return (
        keywordText.includes(normalizedQuery) ||
        productName.includes(normalizedQuery)
      );
    });

    const filteredTopViewed = mergedTopViewed.filter((item) => {
      if (!normalizedQuery) return true;
      const productName = normalizeText(
        item.product?.name || item.keyword || "",
      );
      return productName.includes(normalizedQuery);
    });

    // Interleave results so dropdown always shows a blend of history + product suggestions.
    const suggestions = [];
    const maxItems = normalizedQuery ? 14 : 12;
    let cursor = 0;

    while (suggestions.length < maxItems) {
      let appended = false;

      if (cursor < historySuggestions.length) {
        suggestions.push(historySuggestions[cursor]);
        appended = true;
      }

      if (cursor < filteredRelated.length && suggestions.length < maxItems) {
        suggestions.push(filteredRelated[cursor]);
        appended = true;
      }

      if (cursor < viewedSuggestions.length && suggestions.length < maxItems) {
        suggestions.push(viewedSuggestions[cursor]);
        appended = true;
      }

      if (cursor < filteredTopViewed.length && suggestions.length < maxItems) {
        suggestions.push(filteredTopViewed[cursor]);
        appended = true;
      }

      if (!appended) break;
      cursor += 1;
    }

    return res.json({
      ok: true,
      suggestions,
    });
  } catch (error) {
    return next(error);
  }
};

exports.deleteSearchHistoryKeyword = async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        ok: false,
        message: "Vui long dang nhap",
      });
    }

    const keyword = String(req.query.keyword || req.body?.keyword || "").trim();

    if (!keyword) {
      return res.status(400).json({
        ok: false,
        message: "Thieu keyword",
      });
    }

    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const keywordRegex = new RegExp(`^${escapedKeyword}$`, "i");

    const result = await UserHistory.deleteMany({
      user: req.session.userId,
      action: "search",
      searchKeyword: keywordRegex,
    });

    return res.json({
      ok: true,
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    return next(error);
  }
};

exports.clearAllSearchHistory = async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({
        ok: false,
        message: "Vui long dang nhap",
      });
    }

    const result = await UserHistory.deleteMany({
      user: req.session.userId,
      action: "search",
    });

    return res.json({
      ok: true,
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    return next(error);
  }
};
