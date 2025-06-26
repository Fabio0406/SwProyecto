const express = require('express');
const Usuario = require('../model/Usuario.js');
const Suscripcion = require('../model/Suscripcion.js');
const Pago = require('../model/Pago.js');
const axios = require('axios');

// Middleware de validación y autenticación
const { verificarAutenticacion } = require('../middleware/autenticacion');
const { 
    validacionesPago,
    manejarErroresValidacion 
} = require('../middleware/validacion');
const { sanitizarEntrada } = require('../middleware/seguridad');

const router = express.Router();

// ==========================================
// CONFIGURACIONES DE PAGO
// ==========================================

/**
 * Configuración de constantes para PagoFácil
 */
const CONFIGURACION_PAGO = {
    URL_BASE: 'https://serviciostigomoney.pagofacil.com.bo/api/servicio',
    ENDPOINTS: {
        LOGIN: '/login',
        PAGO_QR: '/pagoqr',
        CONSULTAR: '/consultartransaccion'
    },
    MONEDA: 2, // Bolivianos
    MONTO_SUSCRIPCION: 0.01, // Para pruebas, cambiar en producción
    CALLBACK_URL: 'https://renderia.up.railway.app/callback-pago'
};

// ==========================================
// RUTAS DE PAGO
// ==========================================

/**
 * Página de selección de método de pago
 * @route GET /pagofasil
 */
router.get('/pagofasil', verificarAutenticacion, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        if (!usuario) {
            return res.status(404).render('error', { 
                error: 'Usuario no encontrado' 
            });
        }

        res.render('pagofasil', { usuario });
    } catch (error) {
        console.error('Error cargando página de pago:', error);
        res.status(500).render('error', { 
            error: 'Error cargando página de pago' 
        });
    }
});

/**
 * Procesar solicitud de pago
 * @route POST /procesar-pago
 * @param {number} tipoServicio - Tipo de servicio de pago (1: QR, 2: Tigo Money)
 * @param {string} correoElectronico - Email del usuario
 * @param {string} telefono - Teléfono del usuario
 * @param {string} detalles - Detalles adicionales del pago
 */
router.post('/procesar-pago', 
    verificarAutenticacion,
    sanitizarEntrada,
    validacionesPago,
    manejarErroresValidacion,
    async (req, res) => {
        try {
            const { tipoServicio, correoElectronico, telefono, detalles } = req.body;
            const usuarioId = req.session.usuarioId;

            // Verificar usuario
            const usuario = await Usuario.findById(usuarioId);
            if (!usuario) {
                return res.status(404).json({ 
                    exito: false, 
                    mensaje: 'Usuario no encontrado' 
                });
            }

            // Generar ID único de pago
            const identificadorPago = await generarIdPagoUnico();

            console.log('Procesando pago:', {
                usuario: usuario.nombreUsuario,
                tipo: tipoServicio === 1 ? 'QR' : 'Tigo Money',
                monto: CONFIGURACION_PAGO.MONTO_SUSCRIPCION
            });

            // Crear registro de pago en base de datos
            const nuevoPago = new Pago({
                identificador: identificadorPago,
                usuarioId: usuarioId,
                monto: CONFIGURACION_PAGO.MONTO_SUSCRIPCION,
                estado: 'pendiente',
                metodoPago: tipoServicio === 1 ? 'QR' : 'TigoMoney',
                correoElectronico: correoElectronico,
                telefono: telefono,
                detalles: detalles || 'Suscripción Premium Render AI'
            });

            await nuevoPago.save();

            // Obtener token de autenticación de PagoFácil
            const tokenAcceso = await autenticarServicioPago();

            // Preparar datos para API de PagoFácil
            const datosApiPago = {
                tcComerceID: process.env.PAGOFACIL_COMMERCE_ID,
                tnMoneda: CONFIGURACION_PAGO.MONEDA,
                tnTelefono: telefono,
                tcNombreUsuario: usuario.nombreCompleto,
                tnCiNit: usuario.numeroDocumento || '0', // Agregar campo si es necesario
                tcNroPago: identificadorPago.toString(),
                tnMontoClienteEmpresa: CONFIGURACION_PAGO.MONTO_SUSCRIPCION,
                tcCorreo: correoElectronico,
                tcUrlCallBack: CONFIGURACION_PAGO.CALLBACK_URL,
                tcUrlReturn: "",
                taPedidoDetalle: detalles || 'Suscripción Premium Render AI',
                tcUrl: ""
            };

            // Realizar solicitud a PagoFácil
            const respuestaApi = await realizarSolicitudPago(datosApiPago, tokenAcceso);

            if (respuestaApi.status === 1) {
                let imagenQR = '';
                
                // Obtener QR si es pago tipo QR
                if (tipoServicio === 1) {
                    const valores = JSON.parse(respuestaApi.values);
                    imagenQR = valores.qrImage;
                }

                // Actualizar estado del pago
                await Pago.findOneAndUpdate(
                    { identificador: identificadorPago },
                    { estado: 'generado' }
                );

                console.log(`Pago generado exitosamente: ${identificadorPago}`);

                return res.render('pago', {
                    identificadorPago,
                    imagenQR,
                    monto: CONFIGURACION_PAGO.MONTO_SUSCRIPCION,
                    metodoPago: tipoServicio === 1 ? 'QR' : 'Tigo Money'
                });

            } else {
                // Actualizar estado a fallido
                await Pago.findOneAndUpdate(
                    { identificador: identificadorPago },
                    { estado: 'fallido' }
                );

                console.error('Error en API de PagoFácil:', respuestaApi.message);
                return res.render('pago-fallido', { 
                    error: respuestaApi.message || 'Error procesando el pago' 
                });
            }

        } catch (error) {
            console.error('Error procesando pago:', error);
            return res.status(500).json({ 
                exito: false, 
                mensaje: 'Error interno procesando el pago' 
            });
        }
    }
);

/**
 * Callback para recibir confirmación de pago
 * @route POST /callback-pago
 * @param {string} PedidoID - ID del pago
 * @param {string} Fecha - Fecha del pago
 * @param {string} Hora - Hora del pago
 * @param {string} MetodoPago - Método de pago utilizado
 * @param {string} Estado - Estado del pago
 * @param {number} Monto - Monto pagado
 */
router.post('/callback-pago', async (req, res) => {
    try {
        const {
            PedidoID,
            Fecha,
            Hora,
            MetodoPago,
            Estado,
            Monto
        } = req.body;

        console.log('Callback de pago recibido:', { PedidoID, Estado, Monto });

        // Buscar el pago en la base de datos
        const pago = await Pago.findOne({ identificador: parseInt(PedidoID) });

        if (!pago) {
            console.error('Pago no encontrado:', PedidoID);
            return res.status(404).render('pago-fallido', { 
                error: 'Pago no encontrado' 
            });
        }

        // Actualizar información del pago
        await Pago.findOneAndUpdate(
            { identificador: parseInt(PedidoID) },
            {
                estado: Estado.toLowerCase(),
                fechaPago: new Date(`${Fecha} ${Hora}`),
                metodoPago: MetodoPago
            }
        );

        // Si el pago fue exitoso, activar suscripción premium
        if (Estado.toUpperCase() === 'COMPLETADO') {
            await activarSuscripcionPremium(pago.usuarioId);
            
            console.log(`Suscripción premium activada para usuario: ${pago.usuarioId}`);
            
            return res.render('pago-exitoso', { 
                pago,
                mensaje: 'Pago completado exitosamente. Tu cuenta premium ha sido activada.'
            });

        } else {
            console.log(`Pago no completado: ${PedidoID}, Estado: ${Estado}`);
            return res.render('pago-fallido', { 
                error: 'El pago no fue completado correctamente.' 
            });
        }

    } catch (error) {
        console.error('Error procesando callback de pago:', error);
        return res.status(500).render('pago-fallido', { 
            error: 'Error procesando la confirmación del pago' 
        });
    }
});

/**
 * Consultar estado de transacción
 * @route GET /consultar-pago/:identificador
 * @param {string} identificador - ID de la transacción
 */
router.get('/consultar-pago/:identificador', verificarAutenticacion, async (req, res) => {
    try {
        const { identificador } = req.params;

        // Verificar que el pago pertenece al usuario autenticado
        const pago = await Pago.findOne({ 
            identificador: parseInt(identificador),
            usuarioId: req.session.usuarioId 
        });

        if (!pago) {
            return res.status(404).json({
                exito: false,
                mensaje: 'Pago no encontrado'
            });
        }

        // Obtener token de autenticación
        const tokenAcceso = await autenticarServicioPago();

        // Consultar estado en PagoFácil
        const respuesta = await axios.post(
            `${CONFIGURACION_PAGO.URL_BASE}${CONFIGURACION_PAGO.ENDPOINTS.CONSULTAR}`,
            { TransaccionDePago: identificador },
            {
                headers: {
                    'Authorization': `Bearer ${tokenAcceso}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        if (respuesta.data.status === 1) {
            const { messageEstado } = respuesta.data.values;
            const elementos = messageEstado.split(' - ');

            return res.json({
                exito: true,
                estadoPago: elementos.length >= 2 ? 
                    `${elementos[0]} - ${elementos[1]}` : 
                    messageEstado,
                estadoLocal: pago.estado
            });
        } else {
            return res.status(500).json({ 
                exito: false, 
                mensaje: 'Error consultando el estado del pago' 
            });
        }

    } catch (error) {
        console.error('Error consultando estado de pago:', error);
        return res.status(500).json({ 
            exito: false, 
            mensaje: 'Error interno consultando el pago' 
        });
    }
});

// ==========================================
// FUNCIONES DE UTILIDAD
// ==========================================

/**
 * Autentica con el servicio de PagoFácil y obtiene token de acceso
 * @returns {Promise<string>} Token de acceso
 * @throws {Error} Error de autenticación
 */
async function autenticarServicioPago() {
    try {
        const respuesta = await axios.post(
            `${CONFIGURACION_PAGO.URL_BASE}${CONFIGURACION_PAGO.ENDPOINTS.LOGIN}`,
            {
                TokenService: process.env.PAGOFACIL_SERVICE_TOKEN,
                TokenSecret: process.env.PAGOFACIL_SECRET_TOKEN
            },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 segundos timeout
            }
        );

        if (respuesta.data.status === 1) {
            console.log('Autenticación exitosa con PagoFácil');
            return respuesta.data.values;
        } else {
            throw new Error(`Error de autenticación: ${respuesta.data.message}`);
        }

    } catch (error) {
        console.error('Error autenticando con PagoFácil:', error.message);
        throw new Error(`Error de autenticación con servicio de pagos: ${error.message}`);
    }
}

/**
 * Realiza solicitud de pago a la API de PagoFácil
 * @param {Object} datosPago - Datos del pago
 * @param {string} token - Token de autenticación
 * @returns {Promise<Object>} Respuesta de la API
 * @throws {Error} Error en la solicitud
 */
async function realizarSolicitudPago(datosPago, token) {
    try {
        const respuesta = await axios.post(
            `${CONFIGURACION_PAGO.URL_BASE}${CONFIGURACION_PAGO.ENDPOINTS.PAGO_QR}`,
            datosPago,
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 segundos timeout
            }
        );

        return respuesta.data;

    } catch (error) {
        console.error('Error en solicitud de pago:', error.message);
        throw new Error(`Error procesando solicitud de pago: ${error.message}`);
    }
}

/**
 * Genera un ID único para el pago
 * @returns {Promise<number>} ID único de pago
 */
async function generarIdPagoUnico() {
    let identificador;
    let intentos = 0;
    const maxIntentos = 10;

    do {
        identificador = Math.floor(100000 + Math.random() * 900000); // 6 dígitos
        const pagoExistente = await Pago.findOne({ identificador });
        
        if (!pagoExistente) {
            return identificador;
        }
        
        intentos++;
    } while (intentos < maxIntentos);

    throw new Error('No se pudo generar un ID único para el pago');
}

/**
 * Activa la suscripción premium para un usuario
 * @param {string} usuarioId - ID del usuario
 * @throws {Error} Error activando suscripción
 */
async function activarSuscripcionPremium(usuarioId) {
    try {
        // Verificar si ya tiene suscripción activa
        const suscripcionExistente = await Suscripcion.findOne({ 
            usuarioId,
            estado: 'activa'
        });

        if (suscripcionExistente) {
            // Extender suscripción existente
            const nuevaFechaFin = new Date(suscripcionExistente.fechaFin);
            nuevaFechaFin.setFullYear(nuevaFechaFin.getFullYear() + 1);
            
            await Suscripcion.findByIdAndUpdate(suscripcionExistente._id, {
                fechaFin: nuevaFechaFin
            });

            console.log(`Suscripción extendida para usuario: ${usuarioId}`);
        } else {
            // Crear nueva suscripción
            const fechaInicio = new Date();
            const fechaFin = new Date();
            fechaFin.setFullYear(fechaFin.getFullYear() + 1); // 1 año

            const nuevaSuscripcion = new Suscripcion({
                usuarioId: usuarioId,
                fechaInicio: fechaInicio,
                fechaFin: fechaFin,
                estado: 'activa',
                tipoPlan: 'anual'
            });

            await nuevaSuscripcion.save();
            console.log(`Nueva suscripción creada para usuario: ${usuarioId}`);
        }

        // Actualizar estado premium del usuario
        await Usuario.findByIdAndUpdate(usuarioId, {
            esPremium: true,
            rendersGratuitos: 0 // Resetear contador
        });

        console.log(`Usuario ${usuarioId} actualizado a premium`);

    } catch (error) {
        console.error('Error activando suscripción premium:', error);
        throw new Error('Error activando suscripción premium');
    }
}

/**
 * Verifica y actualiza suscripciones expiradas
 * @returns {Promise<void>}
 */
async function verificarSuscripcionesExpiradas() {
    try {
        const fechaActual = new Date();
        
        // Buscar suscripciones expiradas
        const suscripcionesExpiradas = await Suscripcion.find({
            estado: 'activa',
            fechaFin: { $lt: fechaActual }
        });

        for (const suscripcion of suscripcionesExpiradas) {
            // Actualizar estado de suscripción
            await Suscripcion.findByIdAndUpdate(suscripcion._id, {
                estado: 'expirada'
            });

            // Actualizar usuario a no premium
            await Usuario.findByIdAndUpdate(suscripcion.usuarioId, {
                esPremium: false,
                rendersGratuitos: 0
            });

            console.log(`Suscripción expirada para usuario: ${suscripcion.usuarioId}`);
        }

    } catch (error) {
        console.error('Error verificando suscripciones expiradas:', error);
    }
}

// ==========================================
// RUTAS DE GESTIÓN DE SUSCRIPCIONES
// ==========================================

/**
 * Obtener información de suscripción del usuario
 * @route GET /mi-suscripcion
 */
router.get('/mi-suscripcion', verificarAutenticacion, async (req, res) => {
    try {
        const usuario = await Usuario.findById(req.session.usuarioId);
        const suscripcion = await Suscripcion.findOne({ 
            usuarioId: req.session.usuarioId,
            estado: 'activa'
        });

        res.json({
            exito: true,
            usuario: {
                esPremium: usuario.esPremium,
                rendersGratuitos: usuario.rendersGratuitos
            },
            suscripcion: suscripcion ? {
                fechaInicio: suscripcion.fechaInicio,
                fechaFin: suscripcion.fechaFin,
                tipoPlan: suscripcion.tipoPlan,
                diasRestantes: Math.ceil((suscripcion.fechaFin - new Date()) / (1000 * 60 * 60 * 24))
            } : null
        });

    } catch (error) {
        console.error('Error obteniendo información de suscripción:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error obteniendo información de suscripción'
        });
    }
});

/**
 * Cancelar suscripción
 * @route POST /cancelar-suscripcion
 */
router.post('/cancelar-suscripcion', verificarAutenticacion, async (req, res) => {
    try {
        const suscripcion = await Suscripcion.findOne({
            usuarioId: req.session.usuarioId,
            estado: 'activa'
        });

        if (!suscripcion) {
            return res.status(404).json({
                exito: false,
                mensaje: 'No tienes una suscripción activa'
            });
        }

        // Cancelar suscripción (mantener activa hasta fecha de fin)
        await Suscripcion.findByIdAndUpdate(suscripcion._id, {
            estado: 'cancelada'
        });

        console.log(`Suscripción cancelada para usuario: ${req.session.usuarioId}`);

        res.json({
            exito: true,
            mensaje: 'Suscripción cancelada. Mantendrás acceso premium hasta la fecha de vencimiento.'
        });

    } catch (error) {
        console.error('Error cancelando suscripción:', error);
        res.status(500).json({
            exito: false,
            mensaje: 'Error cancelando suscripción'
        });
    }
});

// ==========================================
// TAREAS PROGRAMADAS
// ==========================================

// Verificar suscripciones expiradas cada hora
setInterval(verificarSuscripcionesExpiradas, 60 * 60 * 1000);

// Verificar al iniciar el servidor
verificarSuscripcionesExpiradas();

module.exports = router;