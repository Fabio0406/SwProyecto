// model/Render.js (ACTUALIZADO)
const mongoose = require('mongoose');

/**
 * Esquema de Render para almacenar los renders generados
 * @typedef {Object} Render
 * @property {string} titulo - Título del proyecto de render
 * @property {string} estimacionCosto - Estimación de costo del proyecto
 * @property {ObjectId} usuarioId - ID del usuario que creó el render
 * @property {ObjectId} proyectoId - ID del proyecto al que pertenece (opcional para compatibilidad)
 * @property {string} urlImagen - URL de la imagen del render generado
 * @property {Object} parametros - Parámetros utilizados para generar el render
 * @property {string} originalImage - URL de la imagen original (boceto)
 * @property {Object} quality - Información sobre la calidad del render
 * @property {string} status - Estado del render (procesando, completado, error)
 */
const esquemaRender = new mongoose.Schema({
  titulo: {
    type: String,
    required: [true, 'El título del render es requerido'],
    trim: true,
    minlength: [3, 'El título debe tener al menos 3 caracteres'],
    maxlength: [100, 'El título no puede exceder 100 caracteres']
  },
  estimacionCosto: {
    type: Number,
    required: [true, 'La estimación de costo es requerida'],
    min: [0, 'El costo no puede ser negativo']
  },
  usuarioId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: [true, 'El ID del usuario es requerido'],
    index: true
  },
  proyectoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proyecto',
    default: null, // Permite renders sin proyecto (para compatibilidad)
    index: true
  },
  urlImagen: {
    type: String,
    required: [true, 'La URL de la imagen es requerida'],
    validate: {
      validator: function(url) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
      },
      message: 'URL de imagen inválida'
    }
  },
  originalImage: {
    type: String,
    validate: {
      validator: function(url) {
        return !url || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
      },
      message: 'URL de imagen original inválida'
    }
  },
  parametros: {
    tamaño: {
      type: Number,
      required: true,
      min: [1, 'El tamaño debe ser mayor a 0']
    },
    pisos: {
      type: Number,
      required: true,
      min: [1, 'Debe tener al menos 1 piso'],
      max: [10, 'Máximo 10 pisos permitidos']
    },
    estilo: {
      type: String,
      required: true,
      enum: ['moderno', 'clasico', 'internacional', 'contemporaneo', 'minimalista', 'industrial'],
      default: 'moderno'
    },
    acabados: {
      type: String,
      enum: ['economicos', 'medios', 'premium', 'lujo'],
      default: 'medios'
    },
    ambiente: {
      type: String,
      enum: ['clean', 'urban', 'natural', 'luxurious', 'rustic'],
      default: 'clean'
    }
  },
  quality: {
    resolucion: {
      type: String,
      enum: ['SD', 'HD', 'FHD', '4K'],
      default: 'HD'
    },
    tiempoProcesamiento: {
      type: Number, // en segundos
      min: 0
    }
  },
  status: {
    type: String,
    enum: ['pendiente', 'procesando', 'completado', 'error'],
    default: 'pendiente'
  },
  downloadCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { 
  timestamps: true,
  collection: 'renders'
});

/**
 * Índices para optimizar consultas
 */
esquemaRender.index({ usuarioId: 1, createdAt: -1 });
esquemaRender.index({ proyectoId: 1, createdAt: -1 });
esquemaRender.index({ status: 1 });

/**
 * Método para incrementar contador de descargas
 */
esquemaRender.methods.incrementarDescarga = function() {
  this.downloadCount += 1;
  return this.save();
};

/**
 * Método para asignar a un proyecto
 */
esquemaRender.methods.asignarAProyecto = function(proyectoId) {
  this.proyectoId = proyectoId;
  return this.save();
};

module.exports = mongoose.model('Render', esquemaRender);