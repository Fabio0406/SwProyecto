// middleware/validacion.js
const { body, validationResult, param } = require('express-validator');

/**
 * Middleware para manejar errores de validación
 * @param {Request} req - Objeto de solicitud
 * @param {Response} res - Objeto de respuesta
 * @param {Function} next - Función para continuar
 */
function manejarErroresValidacion(req, res, next) {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
        const primerError = errores.array()[0];
        return res.status(400).json({
            exito: false,
            mensaje: primerError.msg,
            errores: errores.array()
        });
    }
    next();
}

/**
 * Validaciones para registro de usuario
 */
const validacionesRegistro = [
    body('nombreCompleto')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres')
        .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
        .withMessage('El nombre solo puede contener letras y espacios'),
    
    body('correoElectronico')
        .isEmail()
        .withMessage('Formato de correo electrónico inválido')
        .normalizeEmail()
        .isLength({ max: 255 })
        .withMessage('El correo es demasiado largo'),
    
    body('nombreUsuario')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('El nombre de usuario debe tener entre 3 y 30 caracteres')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('El nombre de usuario solo puede contener letras, números y guiones bajos'),
    
    body('contrasena')
        .isLength({ min: 6, max: 128 })
        .withMessage('La contraseña debe tener entre 6 y 128 caracteres')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
    
    body('confirmarContrasena')
        .custom((valor, { req }) => {
            if (valor !== req.body.contrasena) {
                throw new Error('Las contraseñas no coinciden');
            }
            return true;
        }),
    
    body('tipoUsuario')
        .isIn(['arquitecto', 'diseñador', 'constructor', 'estudiante', 'otro'])
        .withMessage('Tipo de usuario inválido')
];

/**
 * Validaciones para login de usuario
 */
const validacionesLogin = [
    body('nombreUsuario')
        .trim()
        .notEmpty()
        .withMessage('El nombre de usuario es requerido')
        .isLength({ min: 3, max: 30 })
        .withMessage('Nombre de usuario inválido'),
    
    body('contrasena')
        .notEmpty()
        .withMessage('La contraseña es requerida')
        .isLength({ min: 6 })
        .withMessage('Contraseña inválida')
];

/**
 * Validaciones para procesamiento de render
 */
const validacionesRender = [
    body('titulo')
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('El título debe tener entre 3 y 100 caracteres')
        .escape(), // Sanitiza HTML
    
    body('tamano')
        .isFloat({ min: 1, max: 10000 })
        .withMessage('El tamaño debe ser un número entre 1 y 10000')
        .toFloat(),
    
    body('pisos')
        .isInt({ min: 1, max: 10 })
        .withMessage('El número de pisos debe ser entre 1 y 10')
        .toInt(),
    
    body('estilo')
        .isIn(['moderno', 'clasico', 'internacional'])
        .withMessage('Estilo arquitectónico inválido'),
    
    body('acabados')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Los acabados no pueden exceder 200 caracteres')
        .escape(),
    
    body('ambiente')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('El ambiente no puede exceder 200 caracteres')
        .escape()
];

/**
 * Validaciones para procesamiento de pago
 */
const validacionesPago = [
    body('tipoServicio')
        .isIn([1, 2])
        .withMessage('Tipo de servicio inválido'),
    
    body('correoElectronico')
        .isEmail()
        .withMessage('Formato de correo electrónico inválido')
        .normalizeEmail(),
    
    body('telefono')
        .matches(/^\+?[\d\s-()]+$/)
        .withMessage('Formato de teléfono inválido')
        .isLength({ min: 7, max: 20 })
        .withMessage('El teléfono debe tener entre 7 y 20 caracteres'),
    
    body('detalles')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Los detalles no pueden exceder 500 caracteres')
        .escape()
];

/**
 * Validación para parámetros de ID
 */
const validacionId = [
    param('id')
        .isMongoId()
        .withMessage('ID de MongoDB inválido')
];

module.exports = {
    manejarErroresValidacion,
    validacionesRegistro,
    validacionesLogin,
    validacionesRender,
    validacionesPago,
    validacionId
};

// ==========================================