// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    id: {
        type: Number, // En MongoDB no se usa el tipo FLOAT, se usa Number
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Referencia al modelo 'User'
        required: true
    },
    monto: {
        type: Number, // En MongoDB no se usa el tipo FLOAT, se usa Number
        required: true
    },
    estado: {
        type: String,
        required: true,
        default: 'pendiente' // Estados posibles: 'pendiente', 'pagado', 'fallido'
    },
    metodoPago: {
        type: String,
        required: true
    },
    correo: {
        type: String,
        required: true
    },
    telefono: {
        type: String,
        required: true
    },
    detalles: {
        type: String, // Usamos String en lugar de TEXT, que es más general en MongoDB
        required: false
    },
    fechaCreacion: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true }); // También agregamos timestamps para createdAt y updatedAt

module.exports = mongoose.model('Payment', paymentSchema);
