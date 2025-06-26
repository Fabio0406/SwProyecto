// model/Proyecto.js
const mongoose = require('mongoose');

/**
 * Esquema de Proyecto para agrupar renders relacionados
 * @typedef {Object} Proyecto
 * @property {string} nombre - Nombre del proyecto
 * @property {string} descripcion - Descripción del proyecto
 * @property {string} categoria - Categoría del proyecto (residencial, comercial, etc.)
 * @property {ObjectId} usuarioId - ID del usuario propietario
 * @property {Array} renders - Array de IDs de renders asociados
 */
const esquemaProyecto = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del proyecto es requerido'],
    trim: true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [100, 'El nombre no puede exceder 100 caracteres']
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [500, 'La descripción no puede exceder 500 caracteres'],
    default: ''
  },
  categoria: {
    type: String,
    enum: ['residencial', 'comercial', 'industrial', 'institucional', 'mixto', 'otro'],
    default: 'residencial'
  },
  usuarioId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: [true, 'El ID del usuario es requerido'],
    index: true
  },
  renders: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Render'
  }]
}, { 
  timestamps: true,
  collection: 'proyectos'
});

/**
 * Índices para optimizar consultas
 */
esquemaProyecto.index({ usuarioId: 1, createdAt: -1 });
esquemaProyecto.index({ categoria: 1 });

/**
 * Método virtual para contar renders
 */
esquemaProyecto.virtual('totalRenders').get(function() {
  return this.renders ? this.renders.length : 0;
});

/**
 * Método para agregar un render al proyecto
 */
esquemaProyecto.methods.agregarRender = function(renderId) {
  if (!this.renders.includes(renderId)) {
    this.renders.push(renderId);
  }
  return this.save();
};

/**
 * Método para remover un render del proyecto
 */
esquemaProyecto.methods.removerRender = function(renderId) {
  this.renders = this.renders.filter(id => !id.equals(renderId));
  return this.save();
};

module.exports = mongoose.model('Proyecto', esquemaProyecto);