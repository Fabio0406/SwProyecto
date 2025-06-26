// middleware/autenticacion.js

/**
 * Middleware para verificar si el usuario está autenticado
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta  
 * @param {Function} next - Función para continuar al siguiente middleware
 * @returns {void}
 */
function verificarAutenticacion(req, res, next) {
    if (req.session && req.session.usuarioId) {
        return next();
    } else {
        console.log('Acceso no autorizado a ruta protegida:', req.path);
        return res.redirect('/login');
    }
}

/**
 * Middleware para verificar si el usuario es premium
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar al siguiente middleware
 */
async function verificarUsuarioPremium(req, res, next) {
    try {
        const Usuario = require('../model/Usuario');
        const usuario = await Usuario.findById(req.session.usuarioId);
        
        if (!usuario) {
            return res.status(404).json({ 
                exito: false, 
                mensaje: 'Usuario no encontrado' 
            });
        }
        
        if (!usuario.esPremium) {
            return res.status(403).json({ 
                exito: false, 
                mensaje: 'Esta funcionalidad requiere una suscripción premium' 
            });
        }
        
        req.usuario = usuario;
        next();
    } catch (error) {
        console.error('Error verificando usuario premium:', error);
        res.status(500).json({ 
            exito: false, 
            mensaje: 'Error interno del servidor' 
        });
    }
}

module.exports = {
    verificarAutenticacion,
    verificarUsuarioPremium
};
