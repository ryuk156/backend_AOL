const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Create Schema
const teacherSchema = new Schema({
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
  teacherIdImage: {
    data: Buffer,
    contentType: String,
    required: false
  },
  teacherIdNumber: {
    type: Number,
    required: false,
  },
  yourTeacherName: {
    type: String,
    required: true
  },
  yourTeacherMobileNumber: {
    type: Number,
    required: true
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

module.exports = teacher = mongoose.model("teacher", teacherSchema);
