const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Login page
router.get("/login", (req, res) => {
  res.render("auth/login", { error: null });
});

// Login POST
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select("+password"); // ⚠️ QUAN TRỌNG

    if (!user) {
      return res.render("auth/login", {
        error: "Invalid username or password",
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.render("auth/login", {
        error: "Invalid username or password",
      });
    }

    req.session.userId = user._id.toString();
    req.session.userRole = user.role;
    req.session.userName = user.fullName;

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.render("auth/login", {
      error: "An error occurred. Please try again.",
    });
  }
});
// Register page
router.get("/register", (req, res) => {
  res.render("auth/register", {
    oldData: {},
    errors: {},
    error: null,
  });
});

// Register POST

router.post("/register", async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      confirmPassword,
      fullName,
      phone,
      address,
    } = req.body;

    let errors = {};

    // Validate
    if (!username || username.length < 3) {
      errors.username = "Username must be at least 3 characters";
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      errors.email = "Invalid email";
    }

    if (!password || password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (!fullName) {
      errors.fullName = "Full name is required";
    }

    if (Object.keys(errors).length > 0) {
      return res.render("auth/register", {
        errors,
        oldData: req.body,
        error: null,
      });
    }

    // Check trùng
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        errors.username = "Username already exists";
      }
      if (existingUser.email === email) {
        errors.email = "Email already exists";
      }

      return res.render("auth/register", {
        errors,
        oldData: req.body,
        error: null,
      });
    }

    // Tạo user
    const user = new User({
      username,
      email,
      password,
      fullName,
      phone,
      address,
    });

    await user.save();

    res.redirect("/auth/login");
  } catch (err) {
    console.error(err);

    res.render("auth/register", {
      error: "Something went wrong",
      oldData: req.body,
      errors: {},
    });
  }
});
// Logout
router.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

module.exports = router;
