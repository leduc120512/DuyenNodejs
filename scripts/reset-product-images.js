const mongoose = require("mongoose");
const Product = require("../models/Product");
require("dotenv").config();

async function resetMissingImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Reset all products to use default image template
    // This way users can upload their own images fresh
    const defaultImage = "/images/default-product.jpg";

    const result = await Product.updateMany(
      {},
      {
        $set: {
          image: defaultImage,
          images: [defaultImage],
          updatedAt: new Date(),
        },
      },
    );

    console.log("\n✅ Reset complete!");
    console.log(`📊 Modified products: ${result.modifiedCount}`);
    console.log(`   All products now use default image`);
    console.log(`   Users can re-upload images in admin panel`);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

resetMissingImages();
