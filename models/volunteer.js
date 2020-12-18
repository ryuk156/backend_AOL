const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema
const volunteerSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  whatsAppNumber: {
    type: Number,
    required: true
  },
  alternateNumber: {
    type: Number,
    required: false,
    default: null
  },
  teacherReferenceContact: {
    type: Number,
    required: true
  },
  teacherName: {
    type: String,
    required: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: Date.now
  }
});

module.exports = volunteer = mongoose.model("volunteer", volunteerSchema);
