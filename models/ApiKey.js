const mongoose = require("mongoose")
const crypto = require("crypto")

const ApiKeySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  key: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(32).toString("hex"),
  },
  name: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUsed: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
})

const ApiKey = mongoose.model("ApiKey", ApiKeySchema)

module.exports = ApiKey
