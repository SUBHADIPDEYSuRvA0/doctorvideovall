const express = require("express")
const router = express.Router()
const { v4: uuidv4 } = require("uuid")
const ApiKey = require("../models/ApiKey")
const Meeting = require("../models/Meeting")
const User = require("../models/User")

// Middleware to verify API key
const verifyApiKey = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"]

  if (!apiKey) {
    return res.status(401).json({ error: "API key is required" })
  }

  try {
    const keyDoc = await ApiKey.findOne({ key: apiKey, isActive: true })

    if (!keyDoc) {
      return res.status(401).json({ error: "Invalid or inactive API key" })
    }

    // Update last used timestamp
    keyDoc.lastUsed = new Date()
    await keyDoc.save()

    // Attach user to request
    const user = await User.findById(keyDoc.user)
    req.apiUser = user

    next()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
}

// API documentation
router.get("/", (req, res) => {
  res.render("api/documentation", {
    title: "API Documentation",
  })
})

// Create meeting
router.post("/meetings", verifyApiKey, async (req, res) => {
  const { title, description } = req.body

  if (!title) {
    return res.status(400).json({ error: "Title is required" })
  }

  try {
    const meetingId = uuidv4()

    const newMeeting = new Meeting({
      meetingId,
      title,
      description,
      host: req.apiUser._id,
      participants: [{ userId: req.apiUser._id, email: req.apiUser.email, joinedAt: new Date() }],
      createdBy: req.apiUser._id,
    })

    await newMeeting.save()

    res.status(201).json({
      success: true,
      meeting: {
        id: meetingId,
        title,
        description,
        host: {
          id: req.apiUser._id,
          name: req.apiUser.name,
          email: req.apiUser.email,
        },
        joinUrl: `${req.protocol}://${req.get("host")}/meetings/${meetingId}`,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

// Get meetings
router.get("/meetings", verifyApiKey, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ host: req.apiUser._id }, { createdBy: req.apiUser._id }],
    })
      .populate("host", "name email")
      .sort({ startTime: -1 })

    res.json({
      success: true,
      meetings: meetings.map((meeting) => ({
        id: meeting.meetingId,
        title: meeting.title,
        description: meeting.description,
        host: {
          id: meeting.host._id,
          name: meeting.host.name,
          email: meeting.host.email,
        },
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        isActive: meeting.isActive,
        participantCount: meeting.participants.length,
        joinUrl: `${req.protocol}://${req.get("host")}/meetings/${meeting.meetingId}`,
      })),
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

// Get meeting details
router.get("/meetings/:id", verifyApiKey, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id })
      .populate("host", "name email")
      .populate("participants.userId", "name email")

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" })
    }

    res.json({
      success: true,
      meeting: {
        id: meeting.meetingId,
        title: meeting.title,
        description: meeting.description,
        host: {
          id: meeting.host._id,
          name: meeting.host.name,
          email: meeting.host.email,
        },
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        isActive: meeting.isActive,
        participants: meeting.participants.map((p) => ({
          id: p.userId ? p.userId._id : null,
          name: p.userId ? p.userId.name : null,
          email: p.userId ? p.userId.email : p.email,
          joinedAt: p.joinedAt,
          leftAt: p.leftAt,
        })),
        joinUrl: `${req.protocol}://${req.get("host")}/meetings/${meeting.meetingId}`,
      },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

// End meeting
router.post("/meetings/:id/end", verifyApiKey, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id })

    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" })
    }

    // Check if user is the host or creator
    if (
      meeting.host.toString() !== req.apiUser._id.toString() &&
      meeting.createdBy.toString() !== req.apiUser._id.toString()
    ) {
      return res.status(403).json({ error: "Not authorized to end this meeting" })
    }

    meeting.isActive = false
    meeting.endTime = new Date()

    await meeting.save()

    res.json({
      success: true,
      message: "Meeting ended successfully",
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router
