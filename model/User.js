const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  username: String,
  password: String,
  userType: String
});

module.exports = mongoose.model('User', userSchema);
