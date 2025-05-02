const express = require("express")
const router = express.Router()
const bcrypt = require("bcryptjs")
const crypto = require("crypto")
const User = require("../models/User")
const Meeting = require("../models/Meeting")
const ApiKey = require("../models/ApiKey")
const { ensureAdmin } = require("../config/auth")

// Admin dashboard
router.get("/", ensureAdmin, async (req, res) => {
  try {
    const userCount = await User.countDocuments()
    const meetingCount = await Meeting.countDocuments()
    const activeMeetings = await Meeting.countDocuments({ isActive: true })

    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5)

    const recentMeetings = await Meeting.find().populate("host", "name email").sort({ startTime: -1 }).limit(5)

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats: {
        userCount,
        meetingCount,
        activeMeetings,
      },
      recentUsers,
      recentMeetings,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error loading admin dashboard")
    res.redirect("/dashboard")
  }
})

// Manage users
router.get("/users", ensureAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 })

    res.render("admin/users", {
      title: "Manage Users",
      users,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching users")
    res.redirect("/admin")
  }
})

// Create user page
router.get("/users/new", ensureAdmin, (req, res) => {
  res.render("admin/users-new", {
    title: "Create New User",
  })
})

// Create user
router.post("/users", ensureAdmin, async (req, res) => {
  const { name, email, password, role } = req.body

  try {
    // Check if user exists
    const existingUser = await User.findOne({ email })

    if (existingUser) {
      req.flash("error_msg", "Email is already registered")
      return res.redirect("/admin/users/new")
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password,
      role: role || "user",
      createdBy: req.user.id,
    })

    // Hash password
    const salt = await bcrypt.genSalt(10)
    newUser.password = await bcrypt.hash(password, salt)

    // Generate API key
    newUser.apiKey = crypto.randomBytes(32).toString("hex")

    // Save user
    await newUser.save()

    req.flash("success_msg", "User created successfully")
    res.redirect("/admin/users")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error creating user")
    res.redirect("/admin/users/new")
  }
})

// Edit user page
router.get("/users/:id/edit", ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error_msg", "User not found")
      return res.redirect("/admin/users")
    }

    res.render("admin/users-edit", {
      title: "Edit User",
      user,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching user")
    res.redirect("/admin/users")
  }
})

// Update user
router.post("/users/:id", ensureAdmin, async (req, res) => {
  const { name, email, role } = req.body

  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error_msg", "User not found")
      return res.redirect("/admin/users")
    }

    // Check if email is already in use by another user
    if (email !== user.email) {
      const emailExists = await User.findOne({ email })
      if (emailExists) {
        req.flash("error_msg", "Email already in use")
        return res.redirect(`/admin/users/${req.params.id}/edit`)
      }
    }

    user.name = name
    user.email = email
    user.role = role

    await user.save()

    req.flash("success_msg", "User updated successfully")
    res.redirect("/admin/users")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error updating user")
    res.redirect(`/admin/users/${req.params.id}/edit`)
  }
})

// Delete user
router.delete("/users/:id", ensureAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id)

    req.flash("success_msg", "User deleted successfully")
    res.redirect("/admin/users")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error deleting user")
    res.redirect("/admin/users")
  }
})

// Reset user password
router.post("/users/:id/reset-password", ensureAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)

    if (!user) {
      req.flash("error_msg", "User not found")
      return res.redirect("/admin/users")
    }

    // Generate new password
    const newPassword = crypto.randomBytes(4).toString("hex")

    // Hash password
    const salt = await bcrypt.genSalt(10)
    user.password = await bcrypt.hash(newPassword, salt)

    await user.save()

    req.flash("success_msg", `Password reset successfully. New password: ${newPassword}`)
    res.redirect("/admin/users")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error resetting password")
    res.redirect("/admin/users")
  }
})

// Manage meetings
router.get("/meetings", ensureAdmin, async (req, res) => {
  try {
    const meetings = await Meeting.find().populate("host", "name email").sort({ startTime: -1 })

    res.render("admin/meetings", {
      title: "Manage Meetings",
      meetings,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching meetings")
    res.redirect("/admin")
  }
})

// View meeting details
router.get("/meetings/:id", ensureAdmin, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id })
      .populate("host", "name email")
      .populate("participants.userId", "name email")
      .populate("chatHistory.sender", "name email")

    if (!meeting) {
      req.flash("error_msg", "Meeting not found")
      return res.redirect("/admin/meetings")
    }

    res.render("admin/meeting-details", {
      title: "Meeting Details",
      meeting,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching meeting details")
    res.redirect("/admin/meetings")
  }
})

// End meeting (admin)
router.post("/meetings/:id/end", ensureAdmin, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id })

    if (!meeting) {
      req.flash("error_msg", "Meeting not found")
      return res.redirect("/admin/meetings")
    }

    meeting.isActive = false
    meeting.endTime = new Date()

    await meeting.save()

    req.flash("success_msg", "Meeting ended successfully")
    res.redirect("/admin/meetings")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error ending meeting")
    res.redirect("/admin/meetings")
  }
})

// Delete meeting
router.delete("/meetings/:id", ensureAdmin, async (req, res) => {
  try {
    await Meeting.findOneAndDelete({ meetingId: req.params.id })

    req.flash("success_msg", "Meeting deleted successfully")
    res.redirect("/admin/meetings")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error deleting meeting")
    res.redirect("/admin/meetings")
  }
})

// Manage API keys
router.get("/api-keys", ensureAdmin, async (req, res) => {
  try {
    const apiKeys = await ApiKey.find().populate("user", "name email").sort({ createdAt: -1 })

    res.render("admin/api-keys", {
      title: "Manage API Keys",
      apiKeys,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching API keys")
    res.redirect("/admin")
  }
})

// Create API key page
router.get("/api-keys/new", ensureAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ name: 1 })

    res.render("admin/api-keys-new", {
      title: "Create New API Key",
      users,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching users")
    res.redirect("/admin/api-keys")
  }
})

// Create API key
router.post("/api-keys", ensureAdmin, async (req, res) => {
  const { userId, name } = req.body

  try {
    const user = await User.findById(userId)

    if (!user) {
      req.flash("error_msg", "User not found")
      return res.redirect("/admin/api-keys/new")
    }

    const newApiKey = new ApiKey({
      user: userId,
      name,
      key: crypto.randomBytes(32).toString("hex"),
    })

    await newApiKey.save()

    req.flash("success_msg", `API key created successfully: ${newApiKey.key}`)
    res.redirect("/admin/api-keys")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error creating API key")
    res.redirect("/admin/api-keys/new")
  }
})

// Revoke API key
router.post("/api-keys/:id/revoke", ensureAdmin, async (req, res) => {
  try {
    const apiKey = await ApiKey.findById(req.params.id)

    if (!apiKey) {
      req.flash("error_msg", "API key not found")
      return res.redirect("/admin/api-keys")
    }

    apiKey.isActive = false
    await apiKey.save()

    req.flash("success_msg", "API key revoked successfully")
    res.redirect("/admin/api-keys")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error revoking API key")
    res.redirect("/admin/api-keys")
  }
})

module.exports = router
