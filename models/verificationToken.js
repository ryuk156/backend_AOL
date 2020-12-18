const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Teacher = require(__dirname+"/teacher")
const Volunteer = require(__dirname+"/volunteer");
// import Teacher from "../../models/teacher"
// import Volunteer from "../../models/volunteer"

//Token schema for email validation

var tokenSchema = new Schema({
  _userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: Teacher || Volunteer
  },
  token: {
    type: String,
    required: true
  },
  expireAt: {
    type: Date,
    default: Date.now,
    index: {
      expires: 86400000
    }
  }
});

module.exports = Token = mongoose.model('token', tokenSchema);
