require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const db = require('./models'); 
const webRoutes = require('./routes/web');

const app = express(); // 1. Definisikan app dulu

// 2. Konfigurasi View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 3. Middleware
app.set('trust proxy', 1);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    session({
        secret: 'kuncirahasia123',
        resave: false,
        saveUninitialized: true,
        cookie: {
            secure: isHttps,
            sameSite: isHttps ? 'none' : 'lax',
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
        }
    })(req, res, next);
});

// --- 3.5. Middleware untuk membagikan session ke semua file EJS ---
app.use((req, res, next) => {
    const sess = req.session || {};
    res.locals.user = {
        userId: sess.userId || null,
        username: sess.username || '',
        nama_lengkap: sess.nama_lengkap || '',
        role: sess.role || 'Guest',
        tahun: sess.tahun || '2026'
    };
    next();
});

// 4. Menggunakan Routes
app.use('/', webRoutes);

// 5. Jalankan Server & Sinkronisasi Database
const PORT = 3000;
db.sequelize.sync({ alter: true }).then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server jalan di http://0.0.0.0:${PORT}`);
    });
}).catch(err => {
    console.error('Database sync error:', err);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server jalan di http://0.0.0.0:${PORT} (fallback mode)`);
    });
});