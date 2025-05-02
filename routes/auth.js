const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")
const passport = require("passport")
const crypto = require("crypto")
const User = require("../models/User")
const { ensureAuthenticated, ensureAdmin } = require("../config/auth")

// Home page
router.get("/", (req, res) => {
  res.render("index", { title: "Video Calling App" })
})

// Login page
router.get("/login", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard")
  }
  res.render("login", { title: "Login" })
})

// Register page
router.get("/register", (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard")
  }
  res.render("register", { title: "Register" })
})

// Dashboard
router.get("/dashboard", ensureAuthenticated, (req, res) => {
  res.render("dashboard", {
    title: "Dashboard",
    user: req.user,
  })
})

// Register handle
router.post("/register", async (req, res) => {
  const { name, email, password, password2 } = req.body
  const errors = []

  // Check required fields
  if (!name || !email || !password || !password2) {
    errors.push({ msg: "Please fill in all fields" })
  }

  // Check passwords match
  if (password !== password2) {
    errors.push({ msg: "Passwords do not match" })
  }

  // Check password length
  if (password.length < 6) {
    errors.push({ msg: "Password should be at least 6 characters" })
  }

  if (errors.length > 0) {
    res.render("register", {
      title: "Register",
      errors,
      name,
      email,
    })
  } else {
    try {
      // Check if user exists
      const existingUser = await User.findOne({ email })

      if (existingUser) {
        errors.push({ msg: "Email is already registered" })
        return res.render("register", {
          title: "Register",
          errors,
          name,
          email,
        })
      }

      // Create new user
      const newUser = new User({
        name,
        email,
        password,
        role: "user",
      })

      // Hash password
      const salt = await bcrypt.genSalt(10)
      newUser.password = await bcrypt.hash(password, salt)

      // Generate API key
      newUser.apiKey = crypto.randomBytes(32).toString("hex")

      // Save user
      await newUser.save()

      req.flash("success_msg", "You are now registered and can log in")
      res.redirect("/login")
    } catch (err) {
      console.error(err)
      res.render("register", {
        title: "Register",
        errors: [{ msg: "Server error. Please try again." }],
        name,
        email,
      })
    }
  }
})

// Login handle
router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
    failureFlash: true,
  })(req, res, next)
})

// Logout handle
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err)
    }
    req.flash("success_msg", "You are logged out")
    res.redirect("/login")
  })
})

// Profile page
router.get("/profile", ensureAuthenticated, (req, res) => {
  res.render("profile", {
    title: "Profile",
    user: req.user,
  })
})

// Update profile
router.post("/profile", ensureAuthenticated, async (req, res) => {
  const { name, email } = req.body

  try {
    const user = await User.findById(req.user.id)

    if (email !== user.email) {
      const emailExists = await User.findOne({ email })
      if (emailExists) {
        req.flash("error_msg", "Email already in use")
        return res.redirect("/profile")
      }
    }

    user.name = name
    user.email = email

    await user.save()

    req.flash("success_msg", "Profile updated successfully")
    res.redirect("/profile")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error updating profile")
    res.redirect("/profile")
  }
})

// Change password
router.post("/change-password", ensureAuthenticated, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body

  if (newPassword !== confirmPassword) {
    req.flash("error_msg", "New passwords do not match")
    return res.redirect("/profile")
  }

  try {
    const user = await User.findById(req.user.id)

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      req.flash("error_msg", "Current password is incorrect")
      return res.redirect("/profile")
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    user.password = await bcrypt.hash(newPassword, salt)

    await user.save()

    req.flash("success_msg", "Password changed successfully")
    res.redirect("/profile")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error changing password")
    res.redirect("/profile")
  }
})

module.exports = router
