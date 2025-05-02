const express = require("express")
const http = require("http")
const path = require("path")
const socketIO = require("socket.io")
const mongoose = require("mongoose")
const session = require("express-session")
const MongoStore = require("connect-mongo")
const flash = require("connect-flash")
const passport = require("passport")
const methodOverride = require("method-override")
const dotenv = require("dotenv")

// Load environment variables
dotenv.config()

// Import routes
const authRoutes = require("./routes/auth")
const meetingRoutes = require("./routes/meetings")
const adminRoutes = require("./routes/admin")
const subadminRoutes = require("./routes/subadmin")
const apiRoutes = require("./routes/api")

// Import socket handlers
const socketHandler = require("./socket/socketHandler")

// Passport config
require("./config/passport")(passport)

// Initialize app
const app = express()
const server = http.createServer(app)
const io = socketIO(server)

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/videocall-app", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err))

// Set view engine
app.set("view engine", "ejs")

// Middleware
app.use(express.static(path.join(__dirname, "public")))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(methodOverride("_method"))

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI || "mongodb://localhost:27017/videocall-app",
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
  }),
)

// Passport middleware
app.use(passport.initialize())
app.use(passport.session())

// Flash messages
app.use(flash())

// Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg")
  res.locals.error_msg = req.flash("error_msg")
  res.locals.error = req.flash("error")
  res.locals.user = req.user || null
  next()
})

// Routes
app.use("/", authRoutes)
app.use("/meetings", meetingRoutes)
app.use("/admin", adminRoutes)
app.use("/subadmin", subadminRoutes)
app.use("/api", apiRoutes)

// Socket.io connection
io.on("connection", (socket) => {
  socketHandler(io, socket)
})

// Start server
const PORT = process.env.PORT || 3000
server.listen(PORT, () => 
  console.log(`Server running on port ${PORT}`),
console.log(`http://localhost:${PORT}`)   
)

