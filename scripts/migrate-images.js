const mongoose = require("mongoose");
const Product = require("../models/Product");
require("dotenv").config();

async function migrateImages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find all products where images array is empty but image field has a value
    const productsToMigrate = await Product.find({
      $or: [{ images: { $exists: false } }, { images: [] }],
      image: { $exists: true, $ne: "", $ne: null },
    });

    console.log(`Found ${productsToMigrate.length} products to migrate`);

    // Update each product
    for (const product of productsToMigrate) {
      if (product.image) {
        product.images = [product.image];
        await product.save();
        console.log(`✓ Migrated product: ${product.name}`);
      }
    }

    // Also ensure all products have images array
    await Product.updateMany(
      { images: { $exists: false } },
      { $set: { images: [] } },
    );

    console.log("\n✓ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
}

migrateImages();
