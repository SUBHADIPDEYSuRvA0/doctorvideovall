const Meeting = require("../models/Meeting")
const User = require("../models/User")

module.exports = (io, socket) => {
  // Join meeting room
  socket.on("join-meeting", async ({ meetingId, userId, userName }) => {
    try {
      // Join socket room
      socket.join(meetingId)

      // Store user info in socket
      socket.meetingId = meetingId
      socket.userId = userId
      socket.userName = userName

      // Notify others that user joined
      socket.to(meetingId).emit("user-joined", {
        userId,
        userName,
      })

      // Get all connected users in this meeting
      const sockets = await io.in(meetingId).fetchSockets()
      const users = sockets.map((s) => ({
        userId: s.userId,
        userName: s.userName,
        socketId: s.id,
      }))

      // Send list of connected users to the newly joined user
      socket.emit("connected-users", users)

      // Update meeting in database
      await Meeting.updateOne(
        { meetingId, "participants.userId": userId },
        { $set: { "participants.$.joinedAt": new Date() } },
      )

      // Load chat history
      const meeting = await Meeting.findOne({ meetingId }).populate("chatHistory.sender", "name")

      if (meeting && meeting.chatHistory) {
        socket.emit(
          "chat-history",
          meeting.chatHistory.map((msg) => ({
            sender: msg.sender ? msg.sender._id : null,
            senderName: msg.sender ? msg.sender.name : msg.senderName,
            message: msg.message,
            timestamp: msg.timestamp,
          })),
        )
      }
    } catch (err) {
      console.error("Error in join-meeting:", err)
    }
  })

  // Handle WebRTC signaling
  socket.on("signal", ({ to, from, signal }) => {
    io.to(to).emit("signal", {
      from,
      signal,
    })
  })

  // Handle chat messages
  socket.on("send-message", async ({ meetingId, message }) => {
    try {
      const messageData = {
        sender: socket.userId,
        senderName: socket.userName,
        message,
        timestamp: new Date(),
      }

      // Broadcast to all users in the meeting
      io.to(meetingId).emit("new-message", messageData)

      // Save to database
      await Meeting.findOneAndUpdate(
        { meetingId },
        {
          $push: {
            chatHistory: {
              sender: socket.userId,
              senderName: socket.userName,
              message,
              timestamp: new Date(),
            },
          },
        },
      )
    } catch (err) {
      console.error("Error in send-message:", err)
    }
  })

  // Handle user video/audio state changes
  socket.on("media-state-change", ({ meetingId, video, audio }) => {
    socket.to(meetingId).emit("user-media-state-change", {
      userId: socket.userId,
      video,
      audio,
    })
  })

  // Handle screen sharing
  socket.on("screen-share-started", ({ meetingId }) => {
    socket.to(meetingId).emit("user-screen-share-started", {
      userId: socket.userId,
    })
  })

  socket.on("screen-share-stopped", ({ meetingId }) => {
    socket.to(meetingId).emit("user-screen-share-stopped", {
      userId: socket.userId,
    })
  })

  // Handle reactions/emojis
  socket.on("send-reaction", ({ meetingId, reaction }) => {
    io.to(meetingId).emit("user-reaction", {
      userId: socket.userId,
      userName: socket.userName,
      reaction,
    })
  })

  // Handle disconnection
  socket.on("disconnect", async () => {
    try {
      if (socket.meetingId && socket.userId) {
        // Notify others that user left
        socket.to(socket.meetingId).emit("user-left", {
          userId: socket.userId,
        })

        // Update meeting in database
        await Meeting.updateOne(
          { meetingId: socket.meetingId, "participants.userId": socket.userId },
          { $set: { "participants.$.leftAt": new Date() } },
        )
      }
    } catch (err) {
      console.error("Error in disconnect:", err)
    }
  })
}
