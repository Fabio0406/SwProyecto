const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

dotenv.config();

const app = express();

/**
 * Genera un secreto de sesión seguro si no existe en variables de entorno
 * @returns {string} Secreto de sesión
 */
function generarSecretoSesion() {
    return process.env.SESSION_SECRET || crypto.randomBytes(64).toString('hex');
}

/**
 * Configura la conexión a MongoDB Atlas
 * @async
 * @throws {Error} Error de conexión a la base de datos
 */
async function configurarBaseDatos() {
    try {
        await mongoose.connect(process.env.DB_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('✓ Conectado exitosamente a MongoDB Atlas');
    } catch (error) {
        console.error('✗ Error de conexión a MongoDB:', error.message);
        process.exit(1);
    }
}

/**
 * Configura las sesiones de usuario con almacenamiento en MongoDB
 * @param {Express} aplicacion - Instancia de Express
 */
function configurarSesiones(aplicacion) {
    aplicacion.use(session({
        secret: generarSecretoSesion(),
        resave: false,
        saveUninitialized: false, // Cambiado a false por seguridad
        store: MongoStore.create({ 
            mongoUrl: process.env.DB_URI,
            touchAfter: 24 * 3600 // Lazy session update
        }),
        cookie: {
            secure: process.env.NODE_ENV === 'production', // HTTPS en producción
            httpOnly: true, // Previene acceso desde JavaScript
            maxAge: 1000 * 60 * 60 * 24 // 24 horas
        }
    }));
}

/**
 * Configura middleware de Express para parsing y archivos estáticos
 * @param {Express} aplicacion - Instancia de Express
 */
function configurarMiddleware(aplicacion) {
    // Parsing de datos
    aplicacion.use(express.urlencoded({ 
        extended: false,
        limit: '10mb' // Límite para archivos de imagen
    }));
    aplicacion.use(express.json({ limit: '10mb' }));
    
    // Archivos estáticos
    aplicacion.use('/public', express.static(path.join(__dirname, 'public')));
    
    // Motor de plantillas
    aplicacion.set('view engine', 'ejs');
    aplicacion.set('views', path.join(__dirname, 'views'));
}

/**
 * Configura las rutas de la aplicación
 * @param {Express} aplicacion - Instancia de Express
 */
function configurarRutas(aplicacion) {
    const rutasUsuarios = require('./routes/usuarios.js');
    const rutasPremium = require('./routes/Premium.js'); 
    const rutasProyectos = require('./routes/proyectos.js');
    
    aplicacion.use('/', rutasUsuarios);
    aplicacion.use('/', rutasPremium);
    aplicacion.use('/', rutasProyectos);
}

/**
 * Middleware para manejo de errores 404
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar al siguiente middleware
 */
function manejarError404(req, res, next) {
    res.status(404).render('error', { 
        error: 'Página no encontrada',
        mensaje: 'La página que buscas no existe.'
    });
}

/**
 * Middleware global para manejo de errores
 * @param {Error} error - Error capturado
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar
 */
function manejarErrores(error, req, res, next) {
    console.error('Error no manejado:', error);
    
    res.status(500).render('error', {
        error: 'Error interno del servidor',
        mensaje: process.env.NODE_ENV === 'production' 
            ? 'Algo salió mal. Por favor intenta de nuevo.' 
            : error.message
    });
}

/**
 * Inicializa y configura la aplicación Express
 * @async
 */
async function inicializarAplicacion() {
    try {
        // Configurar base de datos
        await configurarBaseDatos();
        
        // Configurar middleware
        configurarSesiones(app);
        configurarMiddleware(app);
        
        // Configurar rutas
        configurarRutas(app);
        
        // Middleware de manejo de errores (debe ir al final)
        app.use(manejarError404);
        app.use(manejarErrores);
        
        // Iniciar servidor
        const puerto = process.env.PORT || 3000;
        app.listen(puerto, () => {
            console.log(`🚀 Servidor Render AI ejecutándose en puerto ${puerto}`);
            console.log(`🌐 Ambiente: ${process.env.NODE_ENV || 'development'}`);
        });
        
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        process.exit(1);
    }
}

// Manejo de cierre graceful
process.on('SIGTERM', () => {
    console.log('Cerrando servidor gracefully...');
    mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Cerrando servidor gracefully...');
    mongoose.connection.close();
    process.exit(0);
});

// Inicializar aplicación
inicializarAplicacion();