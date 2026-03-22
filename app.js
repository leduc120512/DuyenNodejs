require("dotenv").config()
const express = require("express")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const methodOverride = require("method-override")
const path = require("path")
const connectDB = require("./config/database")

const app = express()

// Connect to MongoDB
connectDB()

// View engine setup
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "views"))

// Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))
app.use(methodOverride("_method"))

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/fan-shop",
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    },
  }),
)

// Routes
app.use("/auth", require("./routes/auth"))
app.use("/admin", require("./routes/admin"))
app.use("/", require("./routes/shop"))

// Error handling
app.use((req, res) => {
  res.status(404).render("error", {
    user: req.session,
    message: "Page not found",
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
