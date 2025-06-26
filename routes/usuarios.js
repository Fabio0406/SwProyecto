const express = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../model/Usuario.js');
const Suscripcion = require('../model/Suscripcion.js');
const Pago = require('../model/Pago.js');
const Render = require('../model/Render.js');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const Replicate = require('replicate');
const fs = require('fs/promises');

// Middleware de validación y autenticación
const { verificarAutenticacion } = require('../middleware/autenticacion');
const { 
    validacionesRegistro, 
    validacionesLogin, 
    validacionesRender,
    manejarErroresValidacion 
} = require('../middleware/validacion');
const { 
    limitadorLogin, 
    limitadorRenders,
    sanitizarEntrada 
} = require('../middleware/seguridad');

const router = express.Router();

// ==========================================
// CONFIGURACIONES
// ==========================================

/**
 * Configuración de Multer para almacenamiento de imágenes
 */
const almacenamiento = multer.diskStorage({
    destination: (req, archivo, callback) => {
        callback(null, './public/images');
    },
    filename: (req, archivo, callback) => {
        const nombreUnico = Date.now() + path.extname(archivo.originalname);
        callback(null, nombreUnico);
    }
});

/**
 * Configuración de filtro de archivos para imágenes
 * @param {Request} req - Objeto de solicitud
 * @param {File} archivo - Archivo subido
 * @param {Function} callback - Función de callback
 */
function filtroArchivos(req, archivo, callback) {
    const tiposPermitidos = /jpeg|jpg|png|gif/;
    const extensionValida = tiposPermitidos.test(path.extname(archivo.originalname).toLowerCase());
    const mimetypeValido = tiposPermitidos.test(archivo.mimetype);
    
    if (extensionValida && mimetypeValido) {
        return callback(null, true);
    } else {
        callback(new Error('Solo se permiten archivos de imagen (JPEG, JPG, PNG, GIF)'));
    }
}

const subirArchivo = multer({ 
    storage: almacenamiento,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB máximo
    },
    fileFilter: filtroArchivos
});

/**
 * Configuración de Replicate para IA
 */
const replicateIA = new Replicate({
    auth: process.env.TOKEN_IA
});

// ==========================================
// RUTAS PÚBLICAS
// ==========================================

/**
 * Página de bienvenida
 * @route GET /
 */
router.get('/', (req, res) => {
    try {
        res.render('bienvenida');
    } catch (error) {
        console.error('Error renderizando página de bienvenida:', error);
        res.status(500).render('error', { 
            error: 'Error interno', 
            mensaje: 'No se pudo cargar la página' 
        });
    }
});

/**
 * Formulario de registro
 * @route GET /register
 */
router.get('/register', (req, res) => {
    try {
        res.render('register', { error: null });
    } catch (error) {
        console.error('Error renderizando formulario de registro:', error);
        res.status(500).render('error', { 
            error: 'Error interno', 
            mensaje: 'No se pudo cargar el formulario' 
        });
    }
});

/**
 * Formulario de inicio de sesión
 * @route GET /login
 */
router.get('/login', (req, res) => {
    try {
        res.render('login', { error: null });
    } catch (error) {
        console.error('Error renderizando formulario de login:', error);
        res.status(500).render('error', { 
            error: 'Error interno', 
            mensaje: 'No se pudo cargar el formulario' 
        });
    }
});

// ==========================================
// AUTENTICACIÓN
// ==========================================

/**
 * Procesar registro de usuario
 * @route POST /register
 * @param {string} nombreCompleto - Nombre completo del usuario
 * @param {string} correoElectronico - Email del usuario
 * @param {string} nombreUsuario - Username único
 * @param {string} contrasena - Contraseña del usuario
 * @param {string} confirmarContrasena - Confirmación de contraseña
 * @param {string} tipoUsuario - Tipo de usuario
 */
router.post('/register', 
    sanitizarEntrada,
    validacionesRegistro, 
    manejarErroresValidacion, 
    async (req, res) => {
        try {
            const { 
                nombreCompleto, 
                correoElectronico, 
                nombreUsuario, 
                contrasena, 
                tipoUsuario 
            } = req.body;

            // Verificar si el correo ya existe
            const correoExiste = await Usuario.findOne({ correoElectronico });
            if (correoExiste) {
                return res.render('register', { 
                    error: 'Este correo electrónico ya está registrado' 
                });
            }

            // Verificar si el nombre de usuario ya existe
            const usuarioExiste = await Usuario.findOne({ nombreUsuario });
            if (usuarioExiste) {
                return res.render('register', { 
                    error: 'Este nombre de usuario ya está registrado' 
                });
            }

            // Cifrar contraseña
            const contrasenaHasheada = await bcrypt.hash(contrasena, 12);

            // Crear nuevo usuario
            const nuevoUsuario = new Usuario({
                nombreCompleto,
                correoElectronico,
                nombreUsuario,
                contrasena: contrasenaHasheada,
                tipoUsuario
            });

            await nuevoUsuario.save();
            
            console.log(`Nuevo usuario registrado: ${nombreUsuario}`);
            res.render('login', { 
                exito: 'Registro exitoso. Por favor inicia sesión.' 
            });

        } catch (error) {
            console.error('Error en registro de usuario:', error);
            res.render('register', { 
                error: 'Error interno del servidor. Intenta de nuevo.' 
            });
        }
    }
);

/**
 * Procesar inicio de sesión
 * @route POST /login
 * @param {string} nombreUsuario - nombreUsuario del usuario
 * @param {string} contrasena - Contraseña del usuario
 */
router.post('/login', 
    limitadorLogin,
    sanitizarEntrada,
    validacionesLogin, 
    manejarErroresValidacion,
    async (req, res) => {
        try {
            const { nombreUsuario, contrasena } = req.body;

            // Buscar usuario
            const usuario = await Usuario.findOne({ nombreUsuario });
            if (!usuario) {
                return res.render('login', { 
                    error: 'Usuario o contraseña incorrectos' 
                });
            }

            // Verificar contraseña
            const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
            if (!contrasenaValida) {
                return res.render('login', { 
                    error: 'Usuario o contraseña incorrectos' 
                });
            }

            // Crear sesión
            req.session.usuarioId = usuario._id;
            
            // Obtener renders del usuario
            const renders = await Render.find({ usuarioId: usuario._id });

            console.log(`Usuario autenticado: ${nombreUsuario}`);
            res.render('dashboard', { 
                usuario, 
                proyectos: renders 
            });

        } catch (error) {
            console.error('Error en inicio de sesión:', error);
            res.render('login', { 
                error: 'Error interno del servidor. Intenta de nuevo.' 
            });
        }
    }
);

/**
 * Cerrar sesión
 * @route GET /logout
 */
router.get('/logout', (req, res) => {
    try {
        const usuarioId = req.session.usuarioId;
        req.session.destroy((error) => {
            if (error) {
                console.error('Error cerrando sesión:', error);
                return res.status(500).render('error', { 
                    error: 'Error cerrando sesión' 
                });
            }
            console.log(`Usuario cerró sesión: ${usuarioId}`);
            res.redirect('/login');
        });
    } catch (error) {
        console.error('Error en logout:', error);
        res.redirect('/login');
    }
});

// ==========================================
// RUTAS PROTEGIDAS
// ==========================================

/**
 * Dashboard del usuario
 * @route GET /dashboard
 */
router.get('/dashboard', verificarAutenticacion, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        const renders = await Render.find({ usuarioId: req.session.usuarioId })
            .sort({ createdAt: -1 });

        res.render('dashboard', { 
            usuario, 
            proyectos: renders 
        });
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        res.status(500).render('error', { 
            error: 'Error cargando dashboard' 
        });
    }
});

/**
 * Página de renders (diferente vista según tipo de usuario)
 * @route GET /renders
 */
router.get('/renders', verificarAutenticacion, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        
        if (!usuario) {
            return res.status(404).render('error', { 
                error: 'Usuario no encontrado' 
            });
        }

        if (usuario.esPremium) {
            res.render('premiumRender', { usuario });
        } else {
            res.render('freeRender', { 
                usuario, 
                intentos: usuario.rendersGratuitos 
            });
        }
    } catch (error) {
        console.error('Error cargando vista de renders:', error);
        res.status(500).render('error', { 
            error: 'Error cargando la vista' 
        });
    }
});

// ==========================================
// PROCESAMIENTO DE RENDERS
// ==========================================

/**
 * Procesar generación de render con IA
 * @route POST /process
 * @param {File} imagen - Imagen del boceto
 * @param {number} tamaño - Tamaño en metros cuadrados
 * @param {number} pisos - Número de pisos
 * @param {string} acabados - Tipo de acabados
 * @param {string} ambiente - Tipo de ambiente
 * @param {string} estilo - Estilo arquitectónico
 * @param {string} titulo - Título del proyecto
 */
router.post('/process', 
    verificarAutenticacion,
    limitadorRenders,
    subirArchivo.single('imagen'),
    sanitizarEntrada,
    validacionesRender,
    manejarErroresValidacion,
    async (req, res) => {
        try {
            const { tamano, pisos, acabados, ambiente, estilo, titulo } = req.body;
            
            // Validar archivo subido
            if (!req.file) {
                return res.status(400).json({
                    exito: false,
                    mensaje: 'Por favor sube una imagen válida'
                });
            }

            const tamañoEnMetros = parseFloat(tamano);
            const numeroPisos = parseInt(pisos);

            // Obtener usuario
            const usuario = await Usuario.findById(req.session.usuarioId);
            if (!usuario) {
                return res.status(404).json({
                    exito: false,
                    mensaje: 'Usuario no encontrado'
                });
            }

            // Verificar límites para usuarios gratuitos
            if (!usuario.esPremium && usuario.rendersGratuitos >= 3) {
                return res.status(400).json({
                    exito: false,
                    mensaje: 'Has alcanzado el límite de renders gratuitos. Actualiza a premium para acceso ilimitado.'
                });
            }

            // Incrementar contador para usuarios gratuitos
            if (!usuario.esPremium) {
                await Usuario.findByIdAndUpdate(
                    req.session.usuarioId,
                    { $inc: { rendersGratuitos: 1 } }
                );
            }

            // Procesar imagen con IA
            const urlImagenGenerada = await procesarConIA(req.file, estilo, ambiente);
            
            // Calcular estimación de costo
            const estimacionCosto = calcularCostoEstimado(tamañoEnMetros, numeroPisos, estilo);

            // Guardar render en base de datos
            const nuevoRender = new Render({
                titulo,
                urlImagen: urlImagenGenerada,
                estimacionCosto,
                usuarioId: req.session.usuarioId,
                parametros: {
                    tamaño: tamañoEnMetros,
                    pisos: numeroPisos,
                    estilo,
                    acabados,
                    ambiente
                }
            });

            await nuevoRender.save();

            console.log(`Render generado exitosamente para usuario: ${req.session.usuarioId}`);
            
            res.render('Render', {
                imagenGenerada: urlImagenGenerada,
                costo: estimacionCosto.toLocaleString('es-ES', { 
                    style: 'currency', 
                    currency: 'USD' 
                }),
                titulo,
                parametros: {
                    tamaño: tamañoEnMetros,
                    pisos: numeroPisos,
                    estilo,
                    acabados,
                    ambiente
                },
                usuario
            });

        } catch (error) {
            console.error('Error procesando render:', error);
            
            // Revertir contador si hubo error
            if (!req.usuario?.esPremium) {
                await Usuario.findByIdAndUpdate(
                    req.session.usuarioId,
                    { $inc: { rendersGratuitos: -1 } }
                );
            }

            res.status(500).json({
                exito: false,
                mensaje: 'Error generando el render. Por favor intenta de nuevo.'
            });
        }
    }
);

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

/**
 * Procesa una imagen con IA para generar render arquitectónico
 * @param {File} archivo - Archivo de imagen subido
 * @param {string} estilo - Estilo arquitectónico
 * @param {string} ambiente - Tipo de ambiente
 * @returns {Promise<string>} URL de la imagen generada
 * @throws {Error} Error en el procesamiento de IA
 */
async function procesarConIA(archivo, estilo, ambiente) {
    try {
        // Leer archivo de imagen
        const rutaImagen = path.resolve(archivo.path);
        const bufferImagen = await fs.readFile(rutaImagen);

        // Configurar parámetros para el modelo de IA
        const parametrosEntrada = {
            image: `data:image/png;base64,${bufferImagen.toString('base64')}`,
            prompt: `una casa de estilo ${estilo}, realista con ambiente ${ambiente}, foto 4k, altamente detallada`,
            scheduler: "K_EULER_ANCESTRAL",
            num_samples: 1,
            guidance_scale: 7.5,
            negative_prompt: "dígitos extra, menos dígitos, recortado, peor calidad, baja calidad, falla, deformado, mutado, feo, desfigurado",
            num_inference_steps: 30,
            adapter_conditioning_scale: 0.9,
            adapter_conditioning_factor: 1
        };

        // Ejecutar modelo de Replicate
        const salida = await replicateIA.run(
            "adirik/t2i-adapter-sdxl-sketch:3a14a915b013decb6ab672115c8bced7c088df86c2ddd0a89433717b9ec7d927",
            { input: parametrosEntrada }
        );

        // Limpiar archivo temporal
        await fs.unlink(rutaImagen).catch(console.error);

        return salida[1]; // URL de la imagen generada

    } catch (error) {
        console.error('Error en procesamiento de IA:', error);
        throw new Error('Error generando render con inteligencia artificial');
    }
}

/**
 * Calcula el costo estimado basado en parámetros del proyecto
 * @param {number} tamaño - Tamaño en metros cuadrados
 * @param {number} pisos - Número de pisos
 * @param {string} estilo - Estilo arquitectónico
 * @returns {number} Costo estimado en USD
 */
function calcularCostoEstimado(tamaño, pisos, estilo) {
    const costoPorMetro = {
        'internacional': 250,
        'clasico': 500,
        'moderno': 1500
    };

    const costoBase = tamaño * (costoPorMetro[estilo] || 300) * pisos;
    return Math.round(costoBase * 0.75); // 25% de descuento aplicado
}

// ==========================================
// RUTAS ADICIONALES
// ==========================================

/**
 * Editor de bocetos
 * @route GET /editarB
 */
router.get('/editarB', verificarAutenticacion, async(req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        res.render('editarboc', { usuario });
    } catch (error) {
        console.error('Error cargando editor:', error);
        res.status(500).render('error', { error: 'Error cargando editor' });
    }
});

/**
 * Ver render específico
 * @route GET /render/:id
 */
router.get('/render/:id', verificarAutenticacion, async (req, res) => {
    try {
        const { id } = req.params;
        const render = await Render.findById(id);
        const usuario = await Usuario.findById(req.session.usuarioId);
        
        if (!render || render.usuarioId.toString() !== req.session.usuarioId) {
            return res.status(404).render('error', { 
                error: 'Render no encontrado' 
            });
        }

        res.render('Render', {
            imagenGenerada: render.urlImagen,
            costo: render.estimacionCosto.toLocaleString('es-ES', { 
                style: 'currency', 
                currency: 'USD' 
            }),
            titulo: render.titulo,
            parametros: render.parametros,
            usuario
        });

    } catch (error) {
        console.error('Error cargando render:', error);
        res.status(500).render('error', { 
            error: 'Error cargando render' 
        });
    }
});

/**
 * Página de feedback
 * @route GET /feedback
 */
router.get('/feedback', verificarAutenticacion, async(req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        res.render('feedback', { usuario});
    } catch (error) {
        console.error('Error cargando feedback:', error);
        res.status(500).render('error', { error: 'Error cargando página' });
    }
});

/**
 * Página de suscripción
 * @route GET /suscripcion
 */
router.get('/suscripcion', verificarAutenticacion, async(req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        res.render('suscripcion', { usuario });
    } catch (error) {
        console.error('Error cargando suscripción:', error);
        res.status(500).render('error', { error: 'Error cargando página' });
    }
});

/**
 * Perfil de usuario
 * @route GET /profile
 */
router.get('/profile', verificarAutenticacion, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        if (!usuario) {
            return res.redirect('/login');
        }

        res.render('editProfile', {
            usuario,
            error: req.query.error,
            exito: req.query.exito
        });
    } catch (error) {
        console.error('Error cargando perfil:', error);
        res.status(500).render('error', { error: 'Error cargando perfil' });
    }
});

/**
 * Actualizar perfil de usuario
 * @route POST /profile
 */
router.post('/profile', verificarAutenticacion, async (req, res) => {
    try {
        const { nombreCompleto, correoElectronico, nombreUsuario } = req.body;
        const usuario = await Usuario.findById(req.session.usuarioId);
        
        if (!usuario) {
            return res.redirect('/login');
        }

        // Actualizar datos
        usuario.nombreCompleto = nombreCompleto || usuario.nombreCompleto;
        usuario.correoElectronico = correoElectronico || usuario.correoElectronico;
        usuario.nombreUsuario = nombreUsuario || usuario.nombreUsuario;

        await usuario.save();

        res.render('editProfile', { 
            usuario, 
            exito: 'Perfil actualizado correctamente' 
        });

    } catch (error) {
        console.error('Error actualizando perfil:', error);
        const usuario = await Usuario.findById(req.session.usuarioId);
        res.render('editProfile', { 
            usuario, 
            error: 'Error actualizando el perfil' 
        });
    }
});

module.exports = router;