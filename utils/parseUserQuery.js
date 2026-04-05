function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function convertMoney(value, unit = "") {
  const n = Number(value);
  if (Number.isNaN(n)) return null;

  if (unit === "trieu") return n * 1000000;
  if (unit === "nghin" || unit === "k" || unit === "ngan") return n * 1000;
  return n;
}

function extractPrice(text) {
  const normalized = normalizeText(text);

  let minPrice = null;
  let maxPrice = null;

  const underMatch = normalized.match(
    /(duoi|toi da|max|<)\s*(\d+(?:\.\d+)?)\s*(trieu|nghin|k|ngan)?/
  );
  if (underMatch) {
    maxPrice = convertMoney(underMatch[2], underMatch[3] || "");
  }

  const overMatch = normalized.match(
    /(tren|tu|>=|>)\s*(\d+(?:\.\d+)?)\s*(trieu|nghin|k|ngan)?/
  );
  if (overMatch) {
    minPrice = convertMoney(overMatch[2], overMatch[3] || "");
  }

  const rangeMatch = normalized.match(
    /tu\s*(\d+(?:\.\d+)?)\s*(trieu|nghin|k|ngan)?\s*(den|-)\s*(\d+(?:\.\d+)?)\s*(trieu|nghin|k|ngan)?/
  );

  if (rangeMatch) {
    minPrice = convertMoney(rangeMatch[1], rangeMatch[2] || "");
    maxPrice = convertMoney(rangeMatch[4], rangeMatch[5] || "");
  }

  return { minPrice, maxPrice };
}

function extractColor(text) {
  const normalized = normalizeText(text);

  const knownColors = [
    "den",
    "trang",
    "do",
    "xanh",
    "vang",
    "hong",
    "xam",
    "nau",
    "tim",
    "cam",
    "be",
  ];

  return knownColors.find((color) => normalized.includes(color)) || null;
}

function extractSize(text) {
  const normalized = normalizeText(text);

  const sizeMatch = normalized.match(/size\s*([a-z0-9]+)/i);
  if (sizeMatch) {
    return String(sizeMatch[1]).toUpperCase();
  }

  return null;
}

function parseUserQuery(text = "") {
  const { minPrice, maxPrice } = extractPrice(text);
  const color = extractColor(text);
  const size = extractSize(text);

  return {
    raw: text,
    normalized: normalizeText(text),
    minPrice,
    maxPrice,
    color,
    size,
  };
}

module.exports = {
  normalizeText,
  parseUserQuery,
};
