const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    required: true,
    default: "",
  },

  price: {
    type: Number,
    required: true,
    min: 0,
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },

  image: {
    type: String,
    default: "/images/default-product.jpg",
  },

  images: {
    type: [String],
    default: [],
  },

  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },

  sold: {
    type: Number,
    default: 0,
  },

  viewCount: {
    type: Number,
    default: 0,
    min: 0,
  },

  homeOrder: {
    type: Number,
    default: 9999,
  },

  color: {
    type: [String],
    default: [],
  },

  size: {
    type: [String],
    default: [],
  },

  tags: {
    type: [String],
    default: [],
  },

  searchText: {
    type: String,
    default: "",
  },

  embedding: {
    type: [Number],
    default: [],
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

productSchema.pre("validate", function (next) {
  const fallbackImage = "/images/default-product.jpg";

  if (Array.isArray(this.images) && this.images.length > 0) {
    this.image = this.images[0];
    return next();
  }

  if (this.image) {
    this.images = [this.image];
    return next();
  }

  this.image = fallbackImage;
  this.images = [fallbackImage];
  next();
});

module.exports = mongoose.model("Product", productSchema);
