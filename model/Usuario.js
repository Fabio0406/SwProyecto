// model/Usuario.js
const mongoose = require('mongoose');

/**
 * Esquema de Usuario para el sistema Render AI
 * @typedef {Object} Usuario
 * @property {string} nombreCompleto - Nombre completo del usuario
 * @property {string} correoElectronico - Email único del usuario
 * @property {string} nombreUsuario - Username único para login
 * @property {string} contrasena - Hash de la contraseña
 * @property {string} tipoUsuario - Tipo de usuario (arquitecto, diseñador, etc.)
 * @property {boolean} esPremium - Indica si tiene suscripción premium
 * @property {number} rendersGratuitos - Contador de renders gratuitos usados
 */
const esquemaUsuario = new mongoose.Schema({
  nombreCompleto: {
    type: String,
    required: [true, 'El nombre completo es requerido'],
    trim: true,
    minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  correoElectronico: {
    type: String,
    required: [true, 'El correo electrónico es requerido'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Formato de correo inválido']
  },
  nombreUsuario: {
    type: String,
    required: [true, 'El nombre de usuario es requerido'],
    unique: true,
    trim: true,
    minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres'],
    maxlength: [30, 'El nombre de usuario no puede exceder 30 caracteres'],
    match: [/^[a-zA-Z0-9_]+$/, 'El nombre de usuario solo puede contener letras, números y guiones bajos']
  },
  contrasena: {
    type: String,
    required: [true, 'La contraseña es requerida'],
    minlength: [6, 'La contraseña debe tener al menos 6 caracteres']
  },
  tipoUsuario: {
    type: String,
    required: [true, 'El tipo de usuario es requerido'],
    enum: ['arquitecto', 'diseñador', 'constructor', 'estudiante', 'otro'],
    default: 'otro'
  },
  esPremium: {
    type: Boolean,
    default: false
  },
  rendersGratuitos: {
    type: Number,
    default: 0,
    min: [0, 'El contador no puede ser negativo'],
    max: [3, 'Máximo 3 renders gratuitos permitidos']
  }
}, {
  timestamps: true,
  collection: 'usuarios'
});

/**
 * Índices para optimizar consultas
 */
esquemaUsuario.index({ correoElectronico: 1 });
esquemaUsuario.index({ nombreUsuario: 1 });

module.exports = mongoose.model('Usuario', esquemaUsuario);

// ==========================================