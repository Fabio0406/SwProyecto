// middleware/seguridad.js
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Configuración de rate limiting para prevenir ataques de fuerza bruta
 */
const limitadorLogin = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // Máximo 5 intentos por IP
    message: {
        exito: false,
        mensaje: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiting general para la API
 */
const limitadorGeneral = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo 100 requests por IP
    message: {
        exito: false,
        mensaje: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
    }
});

/**
 * Rate limiting específico para generación de renders
 */
const limitadorRenders = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 3, // Máximo 3 renders por minuto
    message: {
        exito: false,
        mensaje: 'Máximo 3 renders por minuto. Espera un poco antes de generar otro.'
    }
});

/**
 * Configuración de seguridad con Helmet
 */
const configuracionSeguridad = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://api.replicate.com"]
        }
    },
    crossOriginEmbedderPolicy: false // Permitir embeds para demos
});

/**
 * Sanitización de entrada para prevenir XSS
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar
 */
function sanitizarEntrada(req, res, next) {
    // Sanitizar parámetros de consulta
    if (req.query) {
        for (let key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key].trim();
            }
        }
    }
    
    // Sanitizar cuerpo de la solicitud
    if (req.body) {
        for (let key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key].trim();
            }
        }
    }
    
    next();
}

module.exports = {
    limitadorLogin,
    limitadorGeneral,
    limitadorRenders,
    configuracionSeguridad,
    sanitizarEntrada
};