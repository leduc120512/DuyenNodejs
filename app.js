require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const methodOverride = require("method-override");
const path = require("path");
const connectDB = require("./config/database");

const app = express();

// ===== GLOBAL ERROR HANDLER =====
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

const startServer = async () => {
  try {
    await connectDB();

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, "public")));
    app.use(methodOverride("_method"));
    app.use((req, res, next) => {
      res.locals.currentPath = req.path || "";
      res.locals.user = req.session;
      next();
    });

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
      }),
    );

    app.use("/auth", require("./routes/auth"));
    app.use("/admin", require("./routes/admin"));
    app.use("/", require("./routes/shop"));
    app.use("/debug", require("./routes/debug"));

    // AI SEARCH
    app.use("/api/ai-search", require("./routes/aiSearch.route"));

    app.use((req, res) => {
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(404).json({
          ok: false,
          message: "API route not found",
        });
      }

      return res.status(404).send("Page not found");
    });

    app.use((err, req, res, next) => {
      console.error("SERVER ERROR:", err);

      if (req.originalUrl.startsWith("/api/")) {
        return res.status(500).json({
          ok: false,
          message: err.message || "Internal Server Error",
        });
      }

      return res.status(500).send("Internal Server Error");
    });

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
  }
};

startServer();
