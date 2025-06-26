// model/Suscripcion.js
const mongoose = require('mongoose');

/**
 * Esquema de Suscripción para usuarios premium
 * @typedef {Object} Suscripcion
 * @property {ObjectId} usuarioId - ID del usuario suscrito
 * @property {Date} fechaInicio - Fecha de inicio de la suscripción
 * @property {Date} fechaFin - Fecha de finalización de la suscripción
 * @property {string} estado - Estado actual de la suscripción
 * @property {string} tipoPlan - Tipo de plan de suscripción
 */
const esquemaSuscripcion = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        required: [true, 'El ID del usuario es requerido'],
        unique: true,
        index: true
    },
    fechaInicio: {
        type: Date,
        required: [true, 'La fecha de inicio es requerida'],
        default: Date.now
    },
    fechaFin: {
        type: Date,
        required: [true, 'La fecha de fin es requerida'],
        validate: {
            validator: function(fechaFin) {
                return fechaFin > this.fechaInicio;
            },
            message: 'La fecha de fin debe ser posterior a la fecha de inicio'
        }
    },
    estado: {
        type: String,
        enum: ['activa', 'pausada', 'cancelada', 'expirada'],
        default: 'activa'
    },
    tipoPlan: {
        type: String,
        enum: ['mensual', 'anual', 'vitalicio'],
        default: 'mensual'
    }
}, { 
    timestamps: true,
    collection: 'suscripciones'
});

/**
 * Índices para optimizar consultas
 */
esquemaSuscripcion.index({ usuarioId: 1 });
esquemaSuscripcion.index({ estado: 1, fechaFin: 1 });

/**
 * Método para verificar si la suscripción está activa
 * @returns {boolean} True si la suscripción está activa y no ha expirado
 */
esquemaSuscripcion.methods.estaActiva = function() {
    return this.estado === 'activa' && this.fechaFin > new Date();
};

module.exports = mongoose.model('Suscripcion', esquemaSuscripcion);