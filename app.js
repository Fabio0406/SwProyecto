const express = require('express');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();

// Conexión a MongoDB
mongoose.connect(process.env.DB_URI, {
    serverSelectionTimeoutMS: 5000  // Timeout después de 5 segundos
})
    .then(() => console.log('Conectado a MongoDB Atlas'))
    .catch((err) => console.log('Error de conexión a MongoDB:', err));

// Configuración de sesiones (con MongoStore)
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: process.env.DB_URI })
}));

// Configuraciones de Express
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));

// Motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rutas
const userRoutes = require('./routes/users');
app.use('/', userRoutes);

// Middleware para rutas no encontradas (404)
app.use((req, res, next) => {
    res.status(404).render('error');  // Renderiza la vista "error.ejs"
  });
  
app.listen(process.env.PORT || 3000, () => {
    console.log('Servidor corriendo en puerto 4000');
});
