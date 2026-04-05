const mongoose = require("mongoose");
const Product = require("../models/Product");
require("dotenv").config();

async function checkProductImages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const products = await Product.find().lean();
    console.log(`\n📊 Total products: ${products.length}\n`);

    let missingImages = 0;
    let withoutImagesArray = 0;
    let invalidImagePaths = 0;

    products.forEach((product, index) => {
      const hasImage = product.image && product.image !== "";
      const hasImagesArray =
        Array.isArray(product.images) && product.images.length > 0;

      if (!hasImage && !hasImagesArray) {
        missingImages++;
        console.log(`❌ ${index + 1}. ${product.name} - NO IMAGE AT ALL`);
      } else if (!hasImagesArray) {
        withoutImagesArray++;
        console.log(`⚠️  ${index + 1}. ${product.name}`);
        console.log(`    - image: ${product.image}`);
        console.log(
          `    - images array: NOT SET (should auto-fix on next save)`,
        );
      } else {
        console.log(`✅ ${index + 1}. ${product.name}`);
        console.log(`    - Primary: ${product.images[0]}`);
        console.log(`    - Total: ${product.images.length} images`);

        // Check for invalid paths
        const invalidPaths = product.images.filter(
          (img) =>
            !img.startsWith("/uploads/") &&
            !img.startsWith("/images/") &&
            !img.startsWith("http"),
        );
        if (invalidPaths.length > 0) {
          invalidImagePaths++;
          console.log(`    ⚠️  Invalid paths: ${invalidPaths.join(", ")}`);
        }
      }
    });

    console.log("\n📈 SUMMARY:");
    console.log(`   Missing images completely: ${missingImages}`);
    console.log(`   Without images array: ${withoutImagesArray}`);
    console.log(`   With invalid paths: ${invalidImagePaths}`);
    console.log(
      `   Healthy: ${products.length - missingImages - withoutImagesArray - invalidImagePaths}`,
    );

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkProductImages();
