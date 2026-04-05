require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await Product.updateMany(
    { $or: [{ viewCount: { $exists: false } }, { homeOrder: { $exists: false } }] },
    { $set: { viewCount: 0, homeOrder: 9999 } },
  );
  console.log("Backfill complete:", res.modifiedCount, "updated");
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (e) {}
  process.exit(1);
});
