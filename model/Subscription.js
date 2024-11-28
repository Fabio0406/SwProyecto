// models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Referencia al modelo 'User'
        required: true
    },
    fechaInicio: {
        type: Date,
        required: true
    },
    fechaFin: {
        type: Date,
        required: true
    },
    estado: {
        type: String,
        default: 'activa'
    }
}, { timestamps: true }); // Esto añadirá automáticamente createdAt y updatedAt

module.exports = mongoose.model('Subscription', subscriptionSchema);
