document.addEventListener("DOMContentLoaded", () => {
  // Get DOM elements
  const videoGrid = document.getElementById("video-grid")
  const chatForm = document.getElementById("chat-form")
  const chatInput = document.getElementById("chat-input")
  const chatMessages = document.getElementById("chat-messages")
  const participantsList = document.getElementById("participants-list")
  const toggleVideoBtn = document.getElementById("toggle-video")
  const toggleAudioBtn = document.getElementById("toggle-audio")
  const toggleScreenShareBtn = document.getElementById("toggle-screen-share")
  const leaveBtn = document.getElementById("leave-meeting")
  const sendReactionBtn = document.getElementById("send-reaction")
  const reactionMenu = document.getElementById("reaction-menu")
  const toggleChatBtn = document.getElementById("toggle-chat")
  const chatPanel = document.getElementById("chat-panel")

  // Get meeting data from the page
  const meetingId = document.getElementById("meeting-data").dataset.meetingId
  const userId = document.getElementById("meeting-data").dataset.userId
  const userName = document.getElementById("meeting-data").dataset.userName

  // WebRTC variables
  const peers = {}
  let myStream = null
  let screenStream = null
  let isScreenSharing = false
  let isVideoOn = true
  let isAudioOn = true

  // Initialize socket connection
  const socket = io()

  // Initialize peer connection
  const myPeer = new Peer(userId, {
    host: "/",
    port: "3001",
  })

  // Get user media
  async function setupMediaStream() {
    try {
      myStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      // Create video element for current user
      addVideoStream(myStream, userId, true)

      // Answer calls from other users
      myPeer.on("call", (call) => {
        call.answer(myStream)

        // Create video element for the caller
        const callerId = call.peer

        call.on("stream", (userVideoStream) => {
          addVideoStream(userVideoStream, callerId, false)
        })

        // Store the call
        peers[callerId] = call
      })

      // Join the meeting room
      socket.emit("join-meeting", {
        meetingId,
        userId,
        userName,
      })
    } catch (err) {
      console.error("Failed to get media devices", err)
      alert("Failed to access camera and microphone. Please check permissions.")
    }
  }

  // Connect to a new user
  function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream)

    call.on("stream", (userVideoStream) => {
      addVideoStream(userVideoStream, userId, false)
    })

    call.on("close", () => {
      removeVideoStream(userId)
    })

    peers[userId] = call
  }

  // Add a video stream to the grid
  function addVideoStream(stream, userId, isMe) {
    // Check if video already exists
    const existingVideo = document.getElementById(`video-${userId}`)
    if (existingVideo) {
      existingVideo.srcObject = stream
      return
    }

    // Create container
    const videoContainer = document.createElement("div")
    videoContainer.id = `container-${userId}`
    videoContainer.className = "video-container"

    // Create video element
    const video = document.createElement("video")
    video.id = `video-${userId}`
    video.srcObject = stream
    video.autoplay = true
    if (isMe) {
      video.muted = true
      videoContainer.classList.add("my-video")
    }

    // Create name label
    const nameLabel = document.createElement("div")
    nameLabel.className = "name-label"
    nameLabel.textContent = isMe ? `${userName} (You)` : getUserName(userId)

    // Create media indicators
    const indicators = document.createElement("div")
    indicators.className = "media-indicators"

    const micIndicator = document.createElement("span")
    micIndicator.id = `mic-${userId}`
    micIndicator.className = "indicator mic-on"
    micIndicator.innerHTML = '<i class="fas fa-microphone"></i>'

    const videoIndicator = document.createElement("span")
    videoIndicator.id = `video-indicator-${userId}`
    videoIndicator.className = "indicator video-on"
    videoIndicator.innerHTML = '<i class="fas fa-video"></i>'

    indicators.appendChild(micIndicator)
    indicators.appendChild(videoIndicator)

    // Add elements to container
    videoContainer.appendChild(video)
    videoContainer.appendChild(nameLabel)
    videoContainer.appendChild(indicators)

    // Add reaction container
    const reactionContainer = document.createElement("div")
    reactionContainer.id = `reaction-${userId}`
    reactionContainer.className = "reaction-container"
    videoContainer.appendChild(reactionContainer)

    // Add to grid
    videoGrid.appendChild(videoContainer)

    // Update participants list
    updateParticipantsList()
  }

  // Remove a video stream from the grid
  function removeVideoStream(userId) {
    const videoContainer = document.getElementById(`container-${userId}`)
    if (videoContainer) {
      videoContainer.remove()
    }

    // Update participants list
    updateParticipantsList()
  }

  // Update the participants list
  function updateParticipantsList() {
    const containers = document.querySelectorAll(".video-container")
    participantsList.innerHTML = ""

    containers.forEach((container) => {
      const id = container.id.replace("container-", "")
      const name = container.querySelector(".name-label").textContent

      const li = document.createElement("li")
      li.textContent = name
      participantsList.appendChild(li)
    })
  }

  // Get user name from DOM
  function getUserName(userId) {
    // This should be improved to get the actual name from the server
    return `User ${userId.substring(0, 5)}`
  }

  // Toggle video
  function toggleVideo() {
    if (myStream) {
      const videoTrack = myStream.getVideoTracks()[0]
      if (videoTrack) {
        isVideoOn = !videoTrack.enabled
        videoTrack.enabled = isVideoOn

        // Update button
        toggleVideoBtn.innerHTML = isVideoOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>'

        // Update indicator
        const indicator = document.getElementById(`video-indicator-${userId}`)
        if (indicator) {
          indicator.className = isVideoOn ? "indicator video-on" : "indicator video-off"
          indicator.innerHTML = isVideoOn ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>'
        }

        // Notify others
        socket.emit("media-state-change", {
          meetingId,
          video: isVideoOn,
          audio: isAudioOn,
        })
      }
    }
  }

  // Toggle audio
  function toggleAudio() {
    if (myStream) {
      const audioTrack = myStream.getAudioTracks()[0]
      if (audioTrack) {
        isAudioOn = !audioTrack.enabled
        audioTrack.enabled = isAudioOn

        // Update button
        toggleAudioBtn.innerHTML = isAudioOn
          ? '<i class="fas fa-microphone"></i>'
          : '<i class="fas fa-microphone-slash"></i>'

        // Update indicator
        const indicator = document.getElementById(`mic-${userId}`)
        if (indicator) {
          indicator.className = isAudioOn ? "indicator mic-on" : "indicator mic-off"
          indicator.innerHTML = isAudioOn
            ? '<i class="fas fa-microphone"></i>'
            : '<i class="fas fa-microphone-slash"></i>'
        }

        // Notify others
        socket.emit("media-state-change", {
          meetingId,
          video: isVideoOn,
          audio: isAudioOn,
        })
      }
    }
  }

  // Toggle screen sharing
  async function toggleScreenShare() {
    if (!isScreenSharing) {
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        })

        // Replace video track
        const videoTrack = screenStream.getVideoTracks()[0]
        const senders = myPeer.getSenders()
        const sender = senders.find((s) => s.track.kind === "video")
        sender.replaceTrack(videoTrack)

        // Update UI
        isScreenSharing = true
        toggleScreenShareBtn.innerHTML = '<i class="fas fa-desktop"></i> Stop Sharing'

        // Handle track ending
        videoTrack.onended = () => {
          stopScreenSharing()
        }

        // Notify others
        socket.emit("screen-share-started", { meetingId })
      } catch (err) {
        console.error("Error sharing screen:", err)
      }
    } else {
      stopScreenSharing()
    }
  }

  // Stop screen sharing
  function stopScreenSharing() {
    if (isScreenSharing && myStream && screenStream) {
      // Replace with camera track
      const videoTrack = myStream.getVideoTracks()[0]
      const senders = myPeer.getSenders()
      const sender = senders.find((s) => s.track.kind === "video")
      sender.replaceTrack(videoTrack)

      // Stop screen share tracks
      screenStream.getTracks().forEach((track) => track.stop())
      screenStream = null

      // Update UI
      isScreenSharing = false
      toggleScreenShareBtn.innerHTML = '<i class="fas fa-desktop"></i> Share Screen'

      // Notify others
      socket.emit("screen-share-stopped", { meetingId })
    }
  }

  // Send a chat message
  function sendMessage(e) {
    e.preventDefault()

    const message = chatInput.value.trim()
    if (message) {
      // Emit message to server
      socket.emit("send-message", {
        meetingId,
        message,
      })

      // Clear input
      chatInput.value = ""
    }
  }

  // Add a message to the chat
  function addMessageToChat(data) {
    const messageElement = document.createElement("div")
    messageElement.className = "message"

    if (data.sender === userId) {
      messageElement.classList.add("my-message")
    }

    const senderElement = document.createElement("div")
    senderElement.className = "message-sender"
    senderElement.textContent = data.sender === userId ? "You" : data.senderName

    const textElement = document.createElement("div")
    textElement.className = "message-text"
    textElement.textContent = data.message

    const timeElement = document.createElement("div")
    timeElement.className = "message-time"
    timeElement.textContent = formatTime(new Date(data.timestamp))

    messageElement.appendChild(senderElement)
    messageElement.appendChild(textElement)
    messageElement.appendChild(timeElement)

    chatMessages.appendChild(messageElement)

    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  // Format time for chat messages
  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  // Toggle chat panel
  function toggleChat() {
    chatPanel.classList.toggle("hidden")
  }

  // Send a reaction/emoji
  function sendReaction(emoji) {
    socket.emit("send-reaction", {
      meetingId,
      reaction: emoji,
    })

    // Hide menu
    reactionMenu.classList.add("hidden")
  }

  // Show reaction on video
  function showReaction(userId, reaction) {
    const container = document.getElementById(`reaction-${userId}`)
    if (container) {
      const reactionElement = document.createElement("div")
      reactionElement.className = "reaction"
      reactionElement.textContent = reaction

      container.appendChild(reactionElement)

      // Remove after animation
      setTimeout(() => {
        reactionElement.remove()
      }, 3000)
    }
  }

  // Toggle reaction menu
  function toggleReactionMenu() {
    reactionMenu.classList.toggle("hidden")
  }

  // Leave meeting
  function leaveMeeting() {
    // Stop all tracks
    if (myStream) {
      myStream.getTracks().forEach((track) => track.stop())
    }

    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop())
    }

    // Close all peer connections
    for (const id in peers) {
      peers[id].close()
    }

    // Disconnect socket
    socket.disconnect()

    // Submit leave form
    document.getElementById("leave-form").submit()
  }

  // Socket event handlers
  socket.on("connected-users", (users) => {
    users.forEach((user) => {
      if (user.userId !== userId) {
        connectToNewUser(user.userId, myStream)
      }
    })
  })

  socket.on("user-joined", (user) => {
    console.log("User joined:", user)
  })

  socket.on("user-left", (user) => {
    console.log("User left:", user)

    if (peers[user.userId]) {
      peers[user.userId].close()
      delete peers[user.userId]
    }

    removeVideoStream(user.userId)
  })

  socket.on("user-media-state-change", (data) => {
    const micIndicator = document.getElementById(`mic-${data.userId}`)
    if (micIndicator) {
      micIndicator.className = data.audio ? "indicator mic-on" : "indicator mic-off"
      micIndicator.innerHTML = data.audio
        ? '<i class="fas fa-microphone"></i>'
        : '<i class="fas fa-microphone-slash"></i>'
    }

    const videoIndicator = document.getElementById(`video-indicator-${data.userId}`)
    if (videoIndicator) {
      videoIndicator.className = data.video ? "indicator video-on" : "indicator video-off"
      videoIndicator.innerHTML = data.video ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>'
    }
  })

  socket.on("user-screen-share-started", (data) => {
    // Could add UI indication that user is sharing screen
    console.log(`${data.userId} started sharing screen`)
  })

  socket.on("user-screen-share-stopped", (data) => {
    // Could add UI indication that user stopped sharing screen
    console.log(`${data.userId} stopped sharing screen`)
  })

  socket.on("new-message", addMessageToChat)

  socket.on("chat-history", (messages) => {
    messages.forEach(addMessageToChat)
  })

  socket.on("user-reaction", (data) => {
    showReaction(data.userId, data.reaction)
  })

  // Event listeners
  toggleVideoBtn.addEventListener("click", toggleVideo)
  toggleAudioBtn.addEventListener("click", toggleAudio)
  toggleScreenShareBtn.addEventListener("click", toggleScreenShare)
  leaveBtn.addEventListener("click", leaveMeeting)
  chatForm.addEventListener("submit", sendMessage)
  toggleChatBtn.addEventListener("click", toggleChat)
  sendReactionBtn.addEventListener("click", toggleReactionMenu)

  // Reaction emoji buttons
  document.querySelectorAll(".emoji-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      sendReaction(btn.textContent)
    })
  })

  // Initialize
  setupMediaStream()
})
