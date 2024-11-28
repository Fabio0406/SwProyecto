const mongoose = require('mongoose');

// Definimos el esquema del modelo 'Render'
const renderSchema = new mongoose.Schema({
  titulo: {
    type: String,
    required: true
  },
  estimacion: {
    type: String,
    required: true
  },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  dir: {
    type: String,
    required: true
  }
}, { timestamps: true }); // El 'timestamps' agrega automáticamente 'createdAt' y 'updatedAt'

module.exports = mongoose.model('Render', renderSchema);
