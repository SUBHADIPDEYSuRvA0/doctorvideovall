const express = require("express")
const router = express.Router()
const { v4: uuidv4 } = require("uuid")
const Meeting = require("../models/Meeting")
const User = require("../models/User")
const { ensureAuthenticated } = require("../config/auth")

// Get all meetings for current user
router.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ host: req.user.id }, { "participants.userId": req.user.id }],
    }).sort({ startTime: -1 })

    res.render("meetings/index", {
      title: "My Meetings",
      meetings,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error fetching meetings")
    res.redirect("/dashboard")
  }
})

// Create new meeting page
router.get("/new", ensureAuthenticated, (req, res) => {
  res.render("meetings/new", {
    title: "Create New Meeting",
  })
})

// Create new meeting
router.post("/", ensureAuthenticated, async (req, res) => {
  const { title, description } = req.body

  try {
    const meetingId = uuidv4()

    const newMeeting = new Meeting({
      meetingId,
      title,
      description,
      host: req.user.id,
      participants: [{ userId: req.user.id, email: req.user.email, joinedAt: new Date() }],
      createdBy: req.user.id,
    })

    await newMeeting.save()

    res.redirect(`/meetings/${meetingId}`)
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error creating meeting")
    res.redirect("/meetings/new")
  }
})

// Join meeting page
router.get("/join", ensureAuthenticated, (req, res) => {
  res.render("meetings/join", {
    title: "Join Meeting",
  })
})

// Join meeting by ID
router.post("/join", ensureAuthenticated, async (req, res) => {
  const { meetingId } = req.body

  try {
    const meeting = await Meeting.findOne({ meetingId })

    if (!meeting) {
      req.flash("error_msg", "Meeting not found")
      return res.redirect("/meetings/join")
    }

    if (!meeting.isActive) {
      req.flash("error_msg", "This meeting has ended")
      return res.redirect("/meetings/join")
    }

    res.redirect(`/meetings/${meetingId}`)
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error joining meeting")
    res.redirect("/meetings/join")
  }
})

// Meeting room
router.get("/:id", ensureAuthenticated, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id })
      .populate("host", "name email")
      .populate("participants.userId", "name email")

    if (!meeting) {
      req.flash("error_msg", "Meeting not found")
      return res.redirect("/meetings")
    }

    // Check if user is already a participant
    const isParticipant = meeting.participants.some((p) => p.userId && p.userId.toString() === req.user.id)

    // Add user to participants if not already there
    if (!isParticipant) {
      meeting.participants.push({
        userId: req.user.id,
        email: req.user.email,
        joinedAt: new Date(),
      })
      await meeting.save()
    }

    res.render("meetings/room", {
      title: meeting.title,
      meeting,
      user: req.user,
    })
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error accessing meeting")
    res.redirect("/meetings")
  }
})

// End meeting
router.post("/:id/end", ensureAuthenticated, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id })

    if (!meeting) {
      req.flash("error_msg", "Meeting not found")
      return res.redirect("/meetings")
    }

    // Check if user is the host
    if (meeting.host.toString() !== req.user.id) {
      req.flash("error_msg", "Only the host can end the meeting")
      return res.redirect(`/meetings/${req.params.id}`)
    }

    meeting.isActive = false
    meeting.endTime = new Date()

    await meeting.save()

    req.flash("success_msg", "Meeting ended successfully")
    res.redirect("/meetings")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error ending meeting")
    res.redirect(`/meetings/${req.params.id}`)
  }
})

// Leave meeting
router.post("/:id/leave", ensureAuthenticated, async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ meetingId: req.params.id })

    if (!meeting) {
      req.flash("error_msg", "Meeting not found")
      return res.redirect("/meetings")
    }

    // Update participant's left time
    const participantIndex = meeting.participants.findIndex((p) => p.userId && p.userId.toString() === req.user.id)

    if (participantIndex !== -1) {
      meeting.participants[participantIndex].leftAt = new Date()
      await meeting.save()
    }

    req.flash("success_msg", "You have left the meeting")
    res.redirect("/meetings")
  } catch (err) {
    console.error(err)
    req.flash("error_msg", "Error leaving meeting")
    res.redirect(`/meetings/${req.params.id}`)
  }
})

module.exports = router
