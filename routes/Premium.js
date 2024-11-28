const express = require('express');
const User = require('../model/User');
const Subscription = require('../model/Subscription');
const Payment = require('../model/Payment');
const router2 = express.Router();
const axios = require('axios');

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    } else {
        res.redirect('/login');
    }
}


// PAGOFASIL
router2.get('/pagofasil', isAuthenticated, (req, res) => {
    res.render('pagofasil', { user: req.session.userId });
});


router2.post('/procesar-pago', async (req, res) => {
    try {
        const {  tipoServicio, correo, telefono, detalles } = req.body;
        const monto = 390;
        const userId = req.session.userId;
        const user = await User.find(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Generar un ID de pago único
        let pagoId = Math.floor(Math.random() * 1000000);
        while (await Payment.findOne({ where: { id: pagoId } })) {
            pagoId = Math.floor(Math.random() * 1000000); // Generar un nuevo ID si ya existe
        }
        console.log(req.body)

        // Crear la transacción de pago en la base de datos
        const payment = await Payment.create({
            id: pagoId,
            userId: userId,
            monto: monto,
            estado: 'pendiente', // Inicialmente pendiente
            metodoPago: tipoServicio === 1 ? 'QR' : 'Tigo Money',
            correo: correo,
            telefono: telefono,
            detalles: detalles
        });

        // Obtener el token de autenticación
        const accessToken = await authenticateService();

        // Definir la URL de la API dependiendo del tipo de pago
        const apiUrl = tipoServicio === 1
            ? 'https://serviciostigomoney.pagofacil.com.bo/api/servicio/pagoqr'
            : 'https://serviciostigomoney.pagofacil.com.bo/api/servicio/pagotigomoney';

        const requestData = {
            lcComerceID: process.env.PAGOFACIL_COMMERCE_ID,
            lnMoneda: 2,
            lnTelefono: telefono,
            lcNombreUsuario: user.nombre,
            lnCiNit: user.ciNit,
            lcNroPago: pagoId,
            lnMontoClienteEmpresa: monto,
            lcCorreo: correo,
            lcUrlCallBack: 'https://renderia.up.railway.app/callback-pago',
            lcUrlReturn: "",
            laPedidoDetalle: detalles,
            lcUrl: ""
        };

        const response = await axios.post(apiUrl, requestData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        if (response.data.status === 1) {
            // Obtener el qrImage
            let qrImage = '';
            if (tipoServicio === 1) {
                const values = JSON.parse(response.data.values);
                qrImage = values.qrImage; // Imagen QR en base64
            }

            // Actualizar el estado del pago en la base de datos
            payment.estado = 'generado';
            await payment.save();

            // Retornar la vista con el código QR generado
            return res.render('pago', {
                pagoId,
                qrImage
            });
        } else {
            payment.estado = 'fallido';
            await payment.save();
            return res.render('pago-fallido', { error: response.data.message });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Hubo un error procesando el pago' });
    }
});


// Función para consultar el estado del pago
async function consultarEstadoPago(req, res) {
    try {
        const { ventaId } = req.params;

        // Obtener el token de autenticación
        const accessToken = await authenticateService();

        // URL de la API para consultar el estado
        const url = 'https://serviciostigomoney.pagofacil.com.bo/api/servicio/consultartransaccion';

        const response = await axios.post(url, {
            TransaccionDePago: ventaId
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        // Verificar si la respuesta es válida
        if (response.data.status === 1) {
            const { messageEstado } = response.data.values;
            const elementos = messageEstado.split(' - ');

            if (elementos.length >= 2) {
                return res.json({
                    estadoPago: elementos[0] + ' - ' + elementos[1]
                });
            } else {
                return res.status(500).json({ error: 'Formato inesperado en messageEstado.' });
            }
        } else {
            return res.status(500).json({ error: 'Error consultando la transacción' });
        }

    } catch (error) {
        return res.status(500).json({ error: 'Error de consulta de pago: ' + error.message });
    }
}

// Ruta del Callback para recibir el estado del pago
router2.post('/callback-pago', async (req, res) => {
    try {
        const {
            PedidoID, // ID del pago
            Fecha, // Fecha del pago
            Hora, // Hora del pago
            MetodoPago, // Método de pago (QR, Tigo Money, etc.)
            Estado, // Estado del pago (por ejemplo, 'COMPLETADO', 'VENCIDO', etc.)
            Monto, // Monto del pago
            UsuarioID, // ID del usuario (si lo tienes)
        } = req.body;

        // Buscar el pago en la base de datos por el ID
        const pago = await Payment.findOne({ where: { id: PedidoID } });

        if (!pago) {
            return res.status(404).render('pago-fallido', { error: 'Pago no encontrado' });
        }

        // Actualizar la fecha, estado y método de pago
        pago.estado = Estado;
        pago.fechapago = Fecha; // Convertir a formato adecuado si es necesario
        pago.metodopago = MetodoPago;
        await pago.save();

        // Si el pago fue exitoso, activar la cuenta premium
        if (Estado === 'COMPLETADO') {
            const user = await User.findByPk(pago.userId); // Asumiendo que el pago tiene un `userId`
            if (user) {
                // Activar la suscripción premium del usuario
                const subscription = await Subscription.create({
                    userId: user.id,
                    fechaInicio: new Date(),
                    fechaFin: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 año de suscripción
                    estado: 'activa',
                });
                user.estadoCuenta = 'premium'; // Actualiza el estado de la cuenta del usuario
                await user.save();
            }

            // Renderiza la vista de éxito
            return res.render('pago-exitoso', { pago, user });
        } else {
            // Si el pago no fue exitoso, renderiza la vista de error
            return res.render('pago-fallido', { error: 'El pago no fue completado correctamente.' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).render('pago-fallido', { error: 'Hubo un error al procesar el pago' });
    }
});



// Función para autenticar y obtener el token de acceso
async function authenticateService() {
    try {
        const response = await axios.post('https://serviciostigomoney.pagofacil.com.bo/api/servicio/login', {
            TokenService: process.env.PAGOFACIL_SERVICE_TOKEN,
            TokenSecret: process.env.PAGOFACIL_SECRET_TOKEN
        }, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (response.data.status === 1) {
            return response.data.values; // Devuelve el accessToken
        } else {
            throw new Error('Autenticación fallida');
        }
    } catch (error) {
        throw new Error('Error de autenticación: ' + error.message);
    }
}

// Función para generar el QR y el pago
async function generarPago(req, res) {

}

module.exports = { generarPago, consultarEstadoPago };

module.exports = router2;