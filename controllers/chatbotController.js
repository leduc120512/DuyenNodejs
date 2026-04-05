const { getChatbotRecommendation } = require("../services/chatbotService");

async function recommendProducts(req, res, next) {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        reply: "Bạn chưa nhập nội dung tìm kiếm.",
        products: [],
      });
    }

    const data = await getChatbotRecommendation(message);

    return res.json({
      reply: data.reply,
      products: data.products,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  recommendProducts,
};
