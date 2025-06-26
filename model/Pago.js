// model/Pago.js
const mongoose = require('mongoose');

/**
 * Esquema de Pago para transacciones del sistema
 * @typedef {Object} Pago
 * @property {number} identificador - ID único del pago
 * @property {ObjectId} usuarioId - ID del usuario que realizó el pago
 * @property {number} monto - Monto del pago
 * @property {string} estado - Estado actual del pago
 * @property {string} metodoPago - Método de pago utilizado
 * @property {string} correoElectronico - Email del pagador
 * @property {string} telefono - Teléfono del pagador
 * @property {string} detalles - Detalles adicionales del pago
 */
const esquemaPago = new mongoose.Schema({
    identificador: {
        type: Number,
        required: [true, 'El identificador del pago es requerido'],
        unique: true,
        min: [1, 'El identificador debe ser positivo']
    },
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: [true, 'El ID del usuario es requerido'],
        index: true
    },
    monto: {
        type: Number,
        required: [true, 'El monto es requerido'],
        min: [0.01, 'El monto debe ser mayor a 0']
    },
    estado: {
        type: String,
        required: [true, 'El estado del pago es requerido'],
        enum: ['pendiente', 'completado', 'fallido', 'cancelado'],
        default: 'pendiente'
    },
    metodoPago: {
        type: String,
        required: [true, 'El método de pago es requerido'],
        enum: ['QR', 'TigoMoney', 'transferencia', 'tarjeta']
    },
    correoElectronico: {
        type: String,
        required: [true, 'El correo electrónico es requerido'],
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Formato de correo inválido']
    },
    telefono: {
        type: String,
        required: [true, 'El teléfono es requerido'],
        match: [/^\+?[\d\s-()]+$/, 'Formato de teléfono inválido']
    },
    detalles: {
        type: String,
        maxlength: [500, 'Los detalles no pueden exceder 500 caracteres']
    },
    fechaCreacion: {
        type: Date,
        default: Date.now
    },
    fechaPago: {
        type: Date
    }
}, { 
    timestamps: true,
    collection: 'pagos'
});

/**
 * Índices para optimizar consultas
 */
esquemaPago.index({ usuarioId: 1, fechaCreacion: -1 });
esquemaPago.index({ identificador: 1 });
esquemaPago.index({ estado: 1 });

module.exports = mongoose.model('Pago', esquemaPago);

// ==========================================