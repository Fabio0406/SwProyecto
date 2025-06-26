// routes/proyectos.js
const express = require('express');
const Proyecto = require('../model/Proyecto');
const Render = require('../model/Render');
const Usuario = require('../model/Usuario');

// Middleware de validación y autenticación
const { verificarAutenticacion } = require('../middleware/autenticacion');
const { sanitizarEntrada } = require('../middleware/seguridad');

const router = express.Router();

// ==========================================
// RUTAS DE GESTIÓN DE PROYECTOS
// ==========================================

/**
 * Vista principal de proyectos
 * @route GET /proyectos
 */
router.get('/proyectos', verificarAutenticacion, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        const proyectos = await Proyecto.find({ usuarioId: req.session.usuarioId })
            .populate('renders')
            .sort({ createdAt: -1 });

        res.render('proyectos', { 
            usuario, 
            proyectos,
            totalProyectos: proyectos.length 
        });
    } catch (error) {
        console.error('Error cargando proyectos:', error);
        res.status(500).render('error', { 
            error: 'Error cargando proyectos' 
        });
    }
});

/**
 * Crear nuevo proyecto
 * @route POST /proyectos/crear
 */
router.post('/proyectos/crear', 
    verificarAutenticacion,
    sanitizarEntrada,
    async (req, res) => {
        try {
            const { nombre, descripcion, categoria } = req.body;

            // Validaciones básicas
            if (!nombre || nombre.trim().length < 3) {
                return res.status(400).json({
                    exito: false,
                    mensaje: 'El nombre del proyecto debe tener al menos 3 caracteres'
                });
            }

            // Verificar si ya existe un proyecto con el mismo nombre para este usuario
            const proyectoExistente = await Proyecto.findOne({
                usuarioId: req.session.usuarioId,
                nombre: nombre.trim()
            });

            if (proyectoExistente) {
                return res.status(400).json({
                    exito: false,
                    mensaje: 'Ya tienes un proyecto con este nombre'
                });
            }

            // Crear nuevo proyecto
            const nuevoProyecto = new Proyecto({
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || '',
                categoria: categoria || 'residencial',
                usuarioId: req.session.usuarioId
            });

            await nuevoProyecto.save();

            console.log(`Nuevo proyecto creado: ${nombre} por usuario: ${req.session.usuarioId}`);

            res.json({
                exito: true,
                mensaje: 'Proyecto creado exitosamente',
                proyecto: {
                    id: nuevoProyecto._id,
                    nombre: nuevoProyecto.nombre,
                    categoria: nuevoProyecto.categoria
                }
            });

        } catch (error) {
            console.error('Error creando proyecto:', error);
            res.status(500).json({
                exito: false,
                mensaje: 'Error interno creando el proyecto'
            });
        }
    }
);

/**
 * Ver detalles de un proyecto específico
 * @route GET /proyectos/:id
 */
router.get('/proyectos/:id', verificarAutenticacion, async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await Usuario.findById(req.session.usuarioId);
        
        const proyecto = await Proyecto.findOne({
            _id: id,
            usuarioId: req.session.usuarioId
        }).populate('renders');

        if (!proyecto) {
            return res.status(404).render('error', { 
                error: 'Proyecto no encontrado' 
            });
        }

        res.render('proyecto-detalle', { 
            usuario, 
            proyecto,
            renders: proyecto.renders || []
        });

    } catch (error) {
        console.error('Error cargando proyecto:', error);
        res.status(500).render('error', { 
            error: 'Error cargando proyecto' 
        });
    }
});

/**
 * Asignar render a proyecto
 * @route POST /proyectos/:id/agregar-render
 */
router.post('/proyectos/:id/agregar-render', 
    verificarAutenticacion,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { renderId } = req.body;

            // Verificar que el proyecto pertenece al usuario
            const proyecto = await Proyecto.findOne({
                _id: id,
                usuarioId: req.session.usuarioId
            });

            if (!proyecto) {
                return res.status(404).json({
                    exito: false,
                    mensaje: 'Proyecto no encontrado'
                });
            }

            // Verificar que el render pertenece al usuario
            const render = await Render.findOne({
                _id: renderId,
                usuarioId: req.session.usuarioId
            });

            if (!render) {
                return res.status(404).json({
                    exito: false,
                    mensaje: 'Render no encontrado'
                });
            }

            // Asignar render al proyecto
            await proyecto.agregarRender(renderId);
            await render.asignarAProyecto(id);

            console.log(`Render ${renderId} agregado al proyecto ${id}`);

            res.json({
                exito: true,
                mensaje: 'Render agregado al proyecto exitosamente'
            });

        } catch (error) {
            console.error('Error agregando render al proyecto:', error);
            res.status(500).json({
                exito: false,
                mensaje: 'Error interno agregando render al proyecto'
            });
        }
    }
);

/**
 * Remover render de proyecto
 * @route DELETE /proyectos/:id/remover-render/:renderId
 */
router.delete('/proyectos/:id/remover-render/:renderId', 
    verificarAutenticacion,
    async (req, res) => {
        try {
            const { id, renderId } = req.params;

            // Verificar que el proyecto pertenece al usuario
            const proyecto = await Proyecto.findOne({
                _id: id,
                usuarioId: req.session.usuarioId
            });

            if (!proyecto) {
                return res.status(404).json({
                    exito: false,
                    mensaje: 'Proyecto no encontrado'
                });
            }

            // Remover render del proyecto
            await proyecto.removerRender(renderId);
            
            // Actualizar render para quitar referencia al proyecto
            await Render.findByIdAndUpdate(renderId, {
                proyectoId: null
            });

            console.log(`Render ${renderId} removido del proyecto ${id}`);

            res.json({
                exito: true,
                mensaje: 'Render removido del proyecto exitosamente'
            });

        } catch (error) {
            console.error('Error removiendo render del proyecto:', error);
            res.status(500).json({
                exito: false,
                mensaje: 'Error interno removiendo render del proyecto'
            });
        }
    }
);

/**
 * Actualizar proyecto
 * @route PUT /proyectos/:id
 */
router.put('/proyectos/:id', 
    verificarAutenticacion,
    sanitizarEntrada,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { nombre, descripcion, categoria } = req.body;

            // Verificar que el proyecto pertenece al usuario
            const proyecto = await Proyecto.findOne({
                _id: id,
                usuarioId: req.session.usuarioId
            });

            if (!proyecto) {
                return res.status(404).json({
                    exito: false,
                    mensaje: 'Proyecto no encontrado'
                });
            }

            // Actualizar campos
            if (nombre && nombre.trim().length >= 3) {
                proyecto.nombre = nombre.trim();
            }
            
            if (descripcion !== undefined) {
                proyecto.descripcion = descripcion.trim();
            }
            
            if (categoria) {
                proyecto.categoria = categoria;
            }

            await proyecto.save();

            console.log(`Proyecto ${id} actualizado`);

            res.json({
                exito: true,
                mensaje: 'Proyecto actualizado exitosamente',
                proyecto: {
                    id: proyecto._id,
                    nombre: proyecto.nombre,
                    descripcion: proyecto.descripcion,
                    categoria: proyecto.categoria
                }
            });

        } catch (error) {
            console.error('Error actualizando proyecto:', error);
            res.status(500).json({
                exito: false,
                mensaje: 'Error interno actualizando el proyecto'
            });
        }
    }
);

/**
 * Eliminar proyecto
 * @route DELETE /proyectos/:id
 */
router.delete('/proyectos/:id', verificarAutenticacion, async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que el proyecto pertenece al usuario
        const proyecto = await Proyecto.findOne({
            _id: id,
            usuarioId: req.session.usuarioId
        });

        if (!proyecto) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Proyecto no encontrado'
            });
        }

        // Remover referencia de proyecto en todos los renders asociados
        await Render.updateMany(
            { proyectoId: id },
            { $unset: { proyectoId: 1 } }
        );

        // Eliminar el proyecto
        await Proyecto.findByIdAndDelete(id);

        console.log(`Proyecto ${id} eliminado`);

        res.json({
            exito: true,
            mensaje: 'Proyecto eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error eliminando proyecto:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error interno eliminando el proyecto'
        });
    }
});

/**
 * Obtener renders sin proyecto para asignar
 * @route GET /proyectos/renders-disponibles
 */
router.get('/proyectos/renders-disponibles', verificarAutenticacion, async (req, res) => {
    try {
        const rendersSinProyecto = await Render.find({
            usuarioId: req.session.usuarioId,
            $or: [
                { proyectoId: null },
                { proyectoId: { $exists: false } }
            ]
        }).sort({ createdAt: -1 });

        res.json({
            exito: true,
            renders: rendersSinProyecto
        });

    } catch (error) {
        console.error('Error obteniendo renders disponibles:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error obteniendo renders disponibles'
        });
    }
});

module.exports = router;