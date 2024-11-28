const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../model/User');
const Subscription = require('../model/Subscription');
const Payment = require('../model/Payment');
const Render = require('../model/render');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const Replicate = require('replicate')
const fs = require('fs/promises')
const router = express.Router();

// Ruta para mostrar el formulario de registro
router.get('/register', (req, res) => {
    res.render('register');  // Renderiza la vista de "register.ejs"
});

// Ruta para mostrar el formulario de inicio de sesión
router.get('/login', (req, res) => {
    res.render('login');  // Renderiza la vista de "login.ejs"
});

router.get('/', (req, res) => {
    res.render('bienvenida');  // Renderiza la vista de "login.ejs"
});

// Ruta de registro
router.post('/register', async (req, res) => {
    const { fullname, email, username, password, confirmPassword, userType } = req.body;

    // Validación de contraseñas
    if (password !== confirmPassword) {
        return res.send('Las contraseñas no coinciden');
    }

    // Verificar si el correo ya está registrado
    const emailExists = await User.findOne({ email });
    if (emailExists) {
        return res.render('register', { error: 'Este correo ya está registrado' });
    }

    // Verificar si el nombre de usuario ya está registrado
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
        return res.render('register', { error: 'Este nombre de usuario ya está registrado' });
    }

    // Cifrado de la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Creación del usuario
    const newUser = new User({
        fullname: fullname,
        email: email,
        username: username,
        password: hashedPassword,
        userType: userType
    });

    await newUser.save();
    res.render('login');
});

//Ruta del login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Verificar si el usuario existe
    const user = await User.findOne({ username });
    if (!user) {
        return res.render('login', { error: 'El usuario no existe' });
    }

    // Verificar la contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
        return res.render('login', { error: 'Contraseña incorrecta' });
    }
    // Iniciar sesión (guardar en la sesión)
    req.session.userId = user._id;
    const renders = await Render.find({ user_id: req.session.userId });

    res.render('dashboard', { user, proyectos: renders });
});

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Usar el middleware en rutas protegidas
router.get('/dashboard', isAuthenticated, async(req, res) => {
    const renders = await Render.find({ user_id: req.session.userId });
    res.render('dashboard', { user: req.session.userId,proyectos: renders   });
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});


// Ruta para mostrar los renders

// Configuración de Multer para almacenar imágenes subidas
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/images');  // Carpeta de destino para las imágenes subidas
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // Nombrar el archivo con un timestamp
    }
});
const upload = multer({ storage: storage });

// Configuración de Replicate
const replicate = new Replicate({
    auth: process.env.TOKEN_IA  // Reemplaza esto con tu clave API de Replicate
});

router.post('/process', upload.single('image'), async (req, res) => {
    const { size, floors, finish, environment, style, titulo } = req.body;

    // Validar los datos del formulario
    const sizeInMeters = parseFloat(size);
    if (!req.file || isNaN(sizeInMeters) || sizeInMeters <= 0) {
        return res.send('Por favor, asegúrate de subir un boceto válido y llenar todos los campos del formulario correctamente.');
    }

    try {
        const userId = req.session.userId;  // Cambia según tu sistema de autenticación
        const user = await User.findById(userId);

        if (!user) return res.status(404).send('Usuario no encontrado');

        // Verificar si el usuario tiene una versión gratuita
        if (!user.premium) {
            if (user.free >= 3) {
                return res.status(400).json({ message: 'Has alcanzado el límite de intentos gratuitos.' });
            }

            user.free += 1;
            await user.save();
        }

        // Aquí va la lógica para generar el render
        // Leer la imagen subida
        const imagePath = path.resolve(req.file.path);
        const imageBuffer = await fs.readFile(imagePath);

        // Crear parámetros para el modelo
        const input = {
            image: `data:image/png;base64,${imageBuffer.toString('base64')}`, // Convierte la imagen a base64
            prompt: "a "+ style +", realistic house with an "+ environment +" environment, 4k photo, highly detailed",
            scheduler: "K_EULER_ANCESTRAL",
            num_samples: 1,
            guidance_scale: 7.5,
            negative_prompt: "extra digit, fewer digits, cropped, worst quality, low quality, glitch, deformed, mutated, ugly, disfigured",
            num_inference_steps: 30,
            adapter_conditioning_scale: 0.9,
            adapter_conditioning_factor: 1
        };

        // Ejecutar el modelo de Replicate
        const output = await replicate.run(
            "adirik/t2i-adapter-sdxl-sketch:3a14a915b013decb6ab672115c8bced7c088df86c2ddd0a89433717b9ec7d927",
            { input }
        );

        // Extraer URLs de las imágenes generadas
        const generatedImageUrl = output[1]; // Imagen generada final

        // Determinar el costo por metro cuadrado según el tipo de acabados
        let costPerSquareMeter;
        switch (style) {
            case 'international':
                costPerSquareMeter = 250; // USD/m²
                break;
            case 'classic':
                costPerSquareMeter = 500; // USD/m²
                break;
            case 'modern':
                costPerSquareMeter = 1500; // USD/m²
                break;
            default:
                return res.send('Selecciona un tipo de acabado válido.');
        }

        // Calcular el costo total
        const totalCost = sizeInMeters * costPerSquareMeter * parseInt(floors, 10);
        const totalCost2 = totalCost - (totalCost * 0.25);

        // Crear un nuevo documento de Render y guardarlo en la base de datos
        const newRender = new Render({
            titulo: titulo,
            dir: generatedImageUrl,
            estimacion: totalCost2,
            user_id: userId
        });

        // Guardar el render en la base de datos
        await newRender.save();

        // Renderizar la vista con la imagen generada y el costo estimado
        res.render('Render', {
            generatedImageUrl,
            cost: totalCost2.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
        });

    } catch (error) {
        console.error(error);
        return res.status(500).send('Error al generar el render');
    }
});


router.get('/renders', isAuthenticated, async (req, res) => {
    try {
        // Asumiendo que el usuario está autenticado y su ID se guarda en req.user (verifica tu autenticación)
        const userId = req.session.userId;  // Cambia esto según cómo manejas la autenticación
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send('Usuario no encontrado');
        }

        // Verifica si el usuario tiene la versión premium o no
        if (user.premium) {
            // Si es premium, renderiza la vista premium
            res.render('premiumRender', { user: req.session.userId });
        } else {
            // Si no es premium, renderiza la vista gratuita
            res.render('freeRender', { user: req.session.userId, intentos: user.free });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send('Error al cargar la vista');
    }
});

// Ruta para editar bocetos
router.get('/editarB', isAuthenticated, (req, res) => {
    res.render('editarboc', { user: req.session.userId });
});

// Ruta para feedbacks
router.get('/feedback', isAuthenticated, (req, res) => {
    res.render('feedback', { user: req.session.userId });
});

// Ruta para feedbacks
router.get('/suscripcion', isAuthenticated, (req, res) => {
    res.render('suscripcion', { user: req.session.userId });
});


//////////////////
// Ruta para mostrar el formulario de edición de perfil
router.get('/profile', isAuthenticated, async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (!user) {
        return res.redirect('/login');
    }

    // Obtener error y éxito de la URL (usamos req.query para acceder a los parámetros de la URL)
    const error = req.query.error;
    const success = req.query.success;

    res.render('editProfile', {
        user,
        error,
        success
    });
});

// Ruta para guardar los cambios en el perfil
router.post('/profile', isAuthenticated, async (req, res) => {
    const { fullname, email, username } = req.body;
    const user = await User.findById(req.session.userId);
    if (!user) {
        return res.redirect('/login');
    }

    try {
        // Actualizar los datos del usuario
        user.fullname = fullname || user.fullname;
        user.email = email || user.email;
        user.username = username || user.username;

        await user.save();  // Guardar los cambios

        // Redirigir con éxito
        res.render('editProfile', { user, success: 'Perfil actualizado correctamente' });
    } catch (err) {
        // Si hay un error, pasar el error a la vista
        res.render('editProfile', { user, error: 'Hubo un error al actualizar tu perfil' });
    }
});



// Ruta para eliminar el perfil
router.post('/profile', isAuthenticated, async (req, res) => {
    const user = await User.findByIdAndDelete(req.session.userId);
    if (!user) {
        return res.redirect('/login');
    }
    req.session.destroy(() => {
        res.redirect('/login'); // Redirigir a la página de login después de eliminar la cuenta
    });
});





module.exports = router;