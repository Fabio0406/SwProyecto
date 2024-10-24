const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../model/User');
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
        fullname,
        email,
        username,
        password: hashedPassword,
        userType
    });

    await newUser.save();
    res.send('Registro exitoso');
});

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
    res.render('dashboard', { user });
});

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Usar el middleware en rutas protegidas
router.get('/dashboard', isAuthenticated, (req, res) => {
    res.render('dashboard', { user: req.session.userId });
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});
module.exports = router;
