require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const methodOverride = require("method-override");
const path = require("path");
const connectDB = require("./config/database");

const app = express();

// ===== GLOBAL ERROR HANDLER (chống crash) =====
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

// ===== START SERVER SAU KHI CONNECT DB =====
const startServer = async () => {
  try {
    await connectDB(); // 👈 bắt buộc chờ DB

    // View engine
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, "public")));
    app.use(methodOverride("_method"));

    // Session (chỉ chạy khi DB OK)
    app.use(
      session({
        secret: process.env.SESSION_SECRET || "secret",
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          mongoUrl: process.env.MONGODB_URI,
          ttl: 14 * 24 * 60 * 60,
        }),
        cookie: {
          maxAge: 1000 * 60 * 60 * 24,
        },
      })
    );

    // Routes
    app.use("/auth", require("./routes/auth"));
    app.use("/admin", require("./routes/admin"));
    app.use("/", require("./routes/shop"));

    // 404
    app.use((req, res) => {
      res.status(404).send("Page not found");
    });

    // Error handler
    app.use((err, req, res, next) => {
      console.error("SERVER ERROR:", err);
      res.status(500).send("Internal Server Error");
    });

    // Listen PORT (Render tự cấp)
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
  }
};

startServer();
