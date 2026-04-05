require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 4000,
  MONGODB_URI: process.env.MONGODB_URI,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
};
