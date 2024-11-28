const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true  // Esto asegura que el correo electrónico sea único en la base de datos
  },
  username: {
    type: String,
    required: true,
    unique: true  // Esto asegura que el nombre de usuario sea único
  },
  password: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    required: true
  },
  premium: {
    type: Boolean,
    default: false
  },
  free:{
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('User', userSchema);
