// model/Video.js
const mongoose = require('mongoose');

/**
 * Esquema de Video generado a partir de renders de un proyecto
 * @typedef {Object} Video
 * @property {ObjectId} proyectoId - ID del proyecto asociado
 * @property {ObjectId} usuarioId - ID del usuario propietario
 * @property {string} videoUrl - URL del video generado
 * @property {Object} configuracion - Configuraciones usadas para generar el video
 * @property {number} duracion - Duración del video en segundos
 * @property {string} formato - Formato del video (MP4, MOV)
 * @property {string} resolucion - Resolución del video (720p, 1080p, 4K)
 * @property {string} estado - Estado del video (procesando, completado, error)
 * @property {Array} renders - Array de renders utilizados en el video
 * @property {string} template - Plantilla utilizada
 * @property {string} thumbnailUrl - URL de la miniatura del video
 */
const esquemaVideo = new mongoose.Schema({
  proyectoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Proyecto',
    required: [true, 'El ID del proyecto es requerido'],
    index: true
  },
  usuarioId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: [true, 'El ID del usuario es requerido'],
    index: true
  },
  videoUrl: {
    type: String,
    validate: {
      validator: function(url) {
        return !url || /^https?:\/\/.+\.(mp4|mov|avi|mkv)$/i.test(url);
      },
      message: 'URL de video inválida'
    }
  },
  configuracion: {
    duracion: {
      type: Number,
      min: [5, 'La duración mínima es 5 segundos'],
      max: [300, 'La duración máxima es 300 segundos'],
      default: 30
    },
    transicion: {
      type: String,
      enum: ['fade', 'slide', 'zoom', 'dissolve', 'none'],
      default: 'fade'
    },
    musica: {
      type: Boolean,
      default: false
    },
    logoEmpresa: {
      type: Boolean,
      default: false
    },
    textoIntro: {
      type: String,
      maxlength: [100, 'El texto de introducción no puede exceder 100 caracteres'],
      default: ''
    }
  },
  formato: {
    type: String,
    enum: ['MP4', 'MOV'],
    default: 'MP4'
  },
  resolucion: {
    type: String,
    enum: ['720p', '1080p', '4K'],
    default: '1080p'
  },
  estado: {
    type: String,
    enum: ['pendiente', 'procesando', 'completado', 'error', 'cancelado'],
    default: 'pendiente'
  },
  renders: [{
    renderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Render'
    },
    orden: {
      type: Number,
      min: 0
    },
    duracionSegmento: {
      type: Number,
      min: 1,
      default: 3
    }
  }],
  template: {
    type: String,
    enum: ['recorrido_virtual', 'presentacion_corporativa', 'portfolio', 'marketing', 'custom'],
    default: 'recorrido_virtual'
  },
  thumbnailUrl: {
    type: String,
    validate: {
      validator: function(url) {
        return !url || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url);
      },
      message: 'URL de thumbnail inválida'
    }
  },
  exportProgress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  errorMessage: {
    type: String,
    maxlength: [500, 'El mensaje de error no puede exceder 500 caracteres']
  }
}, { 
  timestamps: true,
  collection: 'videos'
});

/**
 * Índices para optimizar consultas
 */
esquemaVideo.index({ usuarioId: 1, createdAt: -1 });
esquemaVideo.index({ proyectoId: 1 });
esquemaVideo.index({ estado: 1 });

/**
 * Método virtual para obtener duración total calculada
 */
esquemaVideo.virtual('duracionCalculada').get(function() {
  if (!this.renders || this.renders.length === 0) return 0;
  return this.renders.reduce((total, render) => total + (render.duracionSegmento || 3), 0);
});

/**
 * Método para actualizar progreso de exportación
 */
esquemaVideo.methods.actualizarProgreso = function(progreso) {
  this.exportProgress = Math.min(100, Math.max(0, progreso));
  return this.save();
};

/**
 * Método para marcar como completado
 */
esquemaVideo.methods.marcarCompletado = function(videoUrl, thumbnailUrl = null) {
  this.estado = 'completado';
  this.videoUrl = videoUrl;
  this.exportProgress = 100;
  if (thumbnailUrl) {
    this.thumbnailUrl = thumbnailUrl;
  }
  return this.save();
};

/**
 * Método para marcar como error
 */
esquemaVideo.methods.marcarError = function(errorMessage) {
  this.estado = 'error';
  this.errorMessage = errorMessage;
  return this.save();
};

module.exports = mongoose.model('Video', esquemaVideo);