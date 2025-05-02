const express = require("express")
const router = express.Router()
const Meeting = require("../models/Meeting")
const User = require("../models/User")
const { ensureSubAdmin } = require("../config/auth")
const bcrypt = require("bcryptjs")
const { v4: uuidv4 } = require("uuid")
const crypto = require("crypto")

// Subadmin dashboard
router.get("/", ensureSubAdmin, async (req, res) => {
  try {
    const userCount = await User.countDocuments({ createdBy: req.user.id })
    const meetingCount = await Meeting.countDocuments({ createdBy: req.user.id })
    const activeMeetings = await Meeting.countDocuments({
      createdBy: req.user.id,
      isActive: true,
    })

    const recentUsers = await User.find({ createdBy: req.user.id }).sort({ createdAt: -1 }).limit(5)

    const recentMeetings = await Meeting.find({ createdBy: req.user.id })
      .populate("host", "name email")
      .sort({ startTime: -1 })
      .limit(5)

    res.render("subadmin/dashboard", {
      title: "Subadmin Dashboard",
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
    req.flash("error_msg", "Error loading subadmin dashboard")
    res.redirect("/dashboard")
  }
})

// Manage users (subadmin)
router.get("/users", ensureSubAdmin, async (req, res) => {
  try {
    const users = await User.find({ createdBy: req.user.id }).sort({ createdAt: -1 })

    res.render("subadmin/users", {
      title: "Manage Users",
      users,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching users")
    res.redirect("/subadmin")
  }
})

// Create user page (subadmin)
router.get("/users/new", ensureSubAdmin, (req, res) => {
  res.render("subadmin/users-new", {
    title: "Create New User",
  })
})

// Create user (subadmin)
router.post("/users", ensureSubAdmin, async (req, res) => {
  const { name, email, password } = req.body

  try {
    // Check if user exists
    const existingUser = await User.findOne({ email })

    if (existingUser) {
      req.flash("error_msg", "Email is already registered")
      return res.redirect("/subadmin/users/new")
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      password,
      role: "user",
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
    res.redirect("/subadmin/users")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error creating user")
    res.redirect("/subadmin/users/new")
  }
})

// Manage meetings (subadmin)
router.get("/meetings", ensureSubAdmin, async (req, res) => {
  try {
    const meetings = await Meeting.find({ createdBy: req.user.id })
      .populate("host", "name email")
      .sort({ startTime: -1 })

    res.render("subadmin/meetings", {
      title: "Manage Meetings",
      meetings,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching meetings")
    res.redirect("/subadmin")
  }
})

// Create meeting (subadmin)
router.get("/meetings/new", ensureSubAdmin, async (req, res) => {
  try {
    const users = await User.find({
      $or: [{ createdBy: req.user.id }, { _id: req.user.id }],
    }).sort({ name: 1 })

    res.render("subadmin/meetings-new", {
      title: "Create New Meeting",
      users,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching users")
    res.redirect("/subadmin/meetings")
  }
})

// Create meeting (subadmin)
router.post("/meetings", ensureSubAdmin, async (req, res) => {
  const { title, description, hostId } = req.body

  try {
    const host = await User.findById(hostId || req.user.id)

    if (!host) {
      req.flash("error_msg", "Host user not found")
      return res.redirect("/subadmin/meetings/new")
    }

    const meetingId = uuidv4()

    const newMeeting = new Meeting({
      meetingId,
      title,
      description,
      host: host._id,
      participants: [{ userId: host._id, email: host.email, joinedAt: new Date() }],
      createdBy: req.user.id,
    })

    await newMeeting.save()

    req.flash("success_msg", `Meeting created successfully. Meeting ID: ${meetingId}`)
    res.redirect("/subadmin/meetings")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error creating meeting")
    res.redirect("/subadmin/meetings/new")
  }
})

// View meeting details (subadmin)
router.get("/meetings/:id", ensureSubAdmin, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({
      meetingId: req.params.id,
      createdBy: req.user.id,
    })
      .populate("host", "name email")
      .populate("participants.userId", "name email")
      .populate("chatHistory.sender", "name email")

    if (!meeting) {
      req.flash("error_msg", "Meeting not found")
      return res.redirect("/subadmin/meetings")
    }

    res.render("subadmin/meeting-details", {
      title: "Meeting Details",
      meeting,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching meeting details")
    res.redirect("/subadmin/meetings")
  }
})

module.exports = router
