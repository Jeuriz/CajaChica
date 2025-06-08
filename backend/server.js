// ==========================================
// SERVER.JS - BACKEND COMPLETO SISTEMA CAJA CHICA
// ==========================================

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// MIDDLEWARES DE SEGURIDAD
// ==========================================

// Helmet para headers de seguridad
app.use(helmet());

// CORS configurado
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'], // Agregar tu dominio en producción
  credentials: true
}));

// Rate limiting general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana de tiempo
  message: 'Demasiadas solicitudes desde esta IP'
});
app.use(limiter);

// Rate limiting específico para login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login por IP
  message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
});

app.use(express.json({ limit: '10mb' }));

// ==========================================
// CONFIGURACIÓN BASE DE DATOS
// ==========================================

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  charset: 'utf8mb4'
};

const pool = mysql.createPool(dbConfig);

// Verificar conexión al iniciar
pool.getConnection()
  .then(connection => {
    console.log('✅ Conexión a MySQL establecida correctamente');
    connection.release();
  })
  .catch(error => {
    console.error('❌ Error conectando a MySQL:', error);
  });

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

// Función para obtener fecha operativa RD
const getFechaOperativaRD = () => {
  const now = new Date();
  const rdTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
  
  // Si son antes de las 12 PM, el día operativo es el día anterior
  if (rdTime.getHours() < 12) {
    rdTime.setDate(rdTime.getDate() - 1);
  }
  
  return rdTime.toISOString().split('T')[0]; // Formato YYYY-MM-DD
};

// Función para obtener hora actual RD
const getHoraRD = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
};

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN
// ==========================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// ==========================================
// VALIDADORES
// ==========================================

const validateLogin = [
  body('username').isLength({ min: 3 }).trim().escape(),
  body('password').isLength({ min: 6 })
];

const validateCierre = [
  body('billetes').isObject(),
  body('dolares').optional().isObject(),
  body('usarDolares').optional().isBoolean(),
  body('tasaCambio').optional().isNumeric(),
  body('gastos').isArray(),
  body('totalEnCaja').isNumeric(),
  body('totalGastos').isNumeric(),
  body('saldoFinal').isNumeric(),
  body('totalBilletesContados').isNumeric(),
  body('totalDolaresEnPesos').optional().isNumeric()
];

// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

// Login
app.post('/api/auth/login', loginLimiter, validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    // Buscar usuario en la base de datos
    const [rows] = await pool.execute(
      'SELECT * FROM usuarios WHERE username = ? AND activo = TRUE',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = rows[0];

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        rol: user.rol,
        nombre: user.nombre 
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log del login
    console.log(`🔐 Login exitoso: ${user.username} (${user.rol}) - ${getHoraRD().toLocaleString()}`);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol,
        nombre: user.nombre
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// RUTAS DE CIERRES
// ==========================================

// Verificar si se puede hacer cierre
app.get('/api/cierres/puede-cerrar', authenticateToken, async (req, res) => {
  try {
    const fechaOperativa = getFechaOperativaRD();
    
    // Verificar si ya existe un cierre para el día operativo actual
    const [existeCierre] = await pool.execute(
      'SELECT id, fecha_creacion FROM cierres WHERE fecha_cierre = ?',
      [fechaOperativa]
    );

    if (existeCierre.length > 0) {
      // Calcular cuándo se puede hacer el próximo cierre (12 PM del día siguiente)
      const proximoCierre = new Date();
      const rdTime = new Date(proximoCierre.toLocaleString("en-US", {timeZone: "America/Santo_Domingo"}));
      
      // Establecer la próxima fecha a las 12 PM
      rdTime.setDate(rdTime.getDate() + 1);
      rdTime.setHours(12, 0, 0, 0);
      
      return res.json({
        puedeCrear: false,
        message: 'Ya se realizó el cierre del día operativo actual',
        fechaCierreExistente: fechaOperativa,
        proximoCierrePermitido: rdTime.toISOString()
      });
    }

    res.json({
      puedeCrear: true,
      fechaOperativa: fechaOperativa,
      message: 'Puede realizar el cierre del día'
    });

  } catch (error) {
    console.error('Error al verificar cierre:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener historial de cierres (Solo Admin)
app.get('/api/cierres', authenticateToken, async (req, res) => {
  try {
    // Solo administradores pueden ver el historial completo
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const [rows] = await pool.execute(`
      SELECT c.*, u.nombre as usuario_nombre 
      FROM cierres c 
      JOIN usuarios u ON c.usuario_id = u.id 
      ORDER BY c.fecha_creacion DESC
      LIMIT 100
    `);

    // Parsear JSON fields incluyendo dólares
    const cierres = rows.map(cierre => ({
      ...cierre,
      billetes: JSON.parse(cierre.billetes),
      dolares: cierre.dolares ? JSON.parse(cierre.dolares) : null,
      gastos: JSON.parse(cierre.gastos)
    }));

    res.json(cierres);

  } catch (error) {
    console.error('Error al obtener cierres:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo cierre
app.post('/api/cierres', authenticateToken, validateCierre, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verificar si se puede hacer cierre antes de proceder
    const fechaOperativa = getFechaOperativaRD();
    
    const [existeCierre] = await pool.execute(
      'SELECT id FROM cierres WHERE fecha_cierre = ?',
      [fechaOperativa]
    );

    if (existeCierre.length > 0) {
      return res.status(400).json({ 
        error: 'Ya se realizó el cierre del día operativo actual. Próximo cierre disponible después de las 12:00 PM.',
        codigo: 'CIERRE_YA_REALIZADO'
      });
    }

    const {
      billetes,
      dolares,
      usarDolares,
      tasaCambio,
      gastos,
      montoBase,
      totalBilletesContados,
      totalDolaresEnPesos,
      totalEnCaja,
      totalGastos,
      saldoFinal
    } = req.body;

    // Validaciones adicionales
    if (totalEnCaja < 0) {
      return res.status(400).json({ error: 'El total en caja no puede ser negativo' });
    }

    if (usarDolares && (!tasaCambio || tasaCambio <= 0)) {
      return res.status(400).json({ error: 'La tasa de cambio debe ser mayor a 0' });
    }

    // Insertar el cierre en la base de datos con la fecha operativa
    const [result] = await pool.execute(`
      INSERT INTO cierres (
        usuario_id, 
        billetes, 
        dolares,
        usar_dolares,
        tasa_cambio,
        gastos, 
        monto_base,
        total_billetes_contados,
        total_dolares_pesos,
        total_en_caja, 
        total_gastos, 
        saldo_final,
        fecha_cierre,
        fecha_creacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      req.user.userId,
      JSON.stringify(billetes),
      usarDolares ? JSON.stringify(dolares) : null,
      usarDolares || false,
      usarDolares ? tasaCambio : null,
      JSON.stringify(gastos),
      montoBase || 4000,
      totalBilletesContados,
      totalDolaresEnPesos || 0,
      totalEnCaja,
      totalGastos,
      saldoFinal,
      fechaOperativa
    ]);

    // Log del cierre
    console.log(`💰 Cierre guardado: Usuario ${req.user.username} - Fecha ${fechaOperativa} - Total: $${totalEnCaja} - Saldo: $${saldoFinal}`);

    res.status(201).json({
      id: result.insertId,
      message: 'Cierre guardado exitosamente',
      fechaOperativa: fechaOperativa
    });

  } catch (error) {
    console.error('Error al crear cierre:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// RUTAS DE ESTADÍSTICAS (Solo Admin)
// ==========================================

app.get('/api/estadisticas', authenticateToken, async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Estadísticas generales
    const [totalCierres] = await pool.execute('SELECT COUNT(*) as total FROM cierres');
    const [totalAcumulado] = await pool.execute('SELECT SUM(saldo_final) as total FROM cierres');
    const [totalGastos] = await pool.execute('SELECT SUM(total_gastos) as total FROM cierres');
    const [ultimoCierre] = await pool.execute(`
      SELECT fecha_cierre FROM cierres 
      ORDER BY fecha_creacion DESC LIMIT 1
    `);

    // Estadísticas adicionales
    const [cierresDelMes] = await pool.execute(`
      SELECT COUNT(*) as total FROM cierres 
      WHERE MONTH(fecha_creacion) = MONTH(CURRENT_DATE()) 
      AND YEAR(fecha_creacion) = YEAR(CURRENT_DATE())
    `);

    const [promedioSaldo] = await pool.execute(`
      SELECT AVG(saldo_final) as promedio FROM cierres
      WHERE fecha_creacion >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    res.json({
      totalCierres: totalCierres[0].total,
      totalAcumulado: totalAcumulado[0].total || 0,
      totalGastos: totalGastos[0].total || 0,
      ultimoCierre: ultimoCierre[0]?.fecha_cierre || null,
      cierresDelMes: cierresDelMes[0].total,
      promedioSaldo: Math.round(promedioSaldo[0].promedio || 0)
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// RUTAS DE TASA DE CAMBIO
// ==========================================

// Obtener tasa de cambio actual
app.get('/api/tasa-cambio', authenticateToken, async (req, res) => {
  try {
    // Tasa por defecto (configurable)
    const tasaDefecto = 58.50;
    
    // Obtener la última tasa usada en un cierre
    const [ultimaTasa] = await pool.execute(`
      SELECT tasa_cambio FROM cierres 
      WHERE usar_dolares = TRUE AND tasa_cambio IS NOT NULL
      ORDER BY fecha_creacion DESC LIMIT 1
    `);

    const tasa = ultimaTasa[0]?.tasa_cambio || tasaDefecto;

    res.json({
      tasa: parseFloat(tasa),
      fecha: new Date().toISOString(),
      fuente: ultimaTasa[0] ? 'ultimo_cierre' : 'configuracion_sistema'
    });

  } catch (error) {
    console.error('Error al obtener tasa de cambio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// RUTAS DE USUARIOS (Solo Admin)
// ==========================================

// Listar usuarios
app.get('/api/usuarios', authenticateToken, async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const [users] = await pool.execute(`
      SELECT id, username, nombre, rol, activo, fecha_creacion 
      FROM usuarios 
      ORDER BY fecha_creacion DESC
    `);

    res.json(users);

  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// RUTAS DE SISTEMA
// ==========================================

// Ruta de salud del sistema
app.get('/api/health', (req, res) => {
  const horaRD = getHoraRD();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    horaRD: horaRD.toLocaleString(),
    fechaOperativa: getFechaOperativaRD(),
    version: '1.0.0'
  });
});

// Información del sistema
app.get('/api/info', authenticateToken, (req, res) => {
  res.json({
    version: '1.0.0',
    montoBaseCaja: 4000,
    denominacionesPesos: [2000, 1000, 500, 200, 100, 50],
    denominacionesDolares: [100, 50, 20, 10, 5, 1],
    horaInicioOperativo: '12:00',
    zonaHoraria: 'America/Santo_Domingo'
  });
});

// ==========================================
// RUTAS DE REPORTES (Solo Admin)
// ==========================================

// Reporte por rango de fechas
app.get('/api/reportes/fechas', authenticateToken, async (req, res) => {
  try {
    if (req.user.rol !== 'administrador') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ error: 'fechaInicio y fechaFin son requeridos' });
    }

    const [cierres] = await pool.execute(`
      SELECT c.*, u.nombre as usuario_nombre 
      FROM cierres c 
      JOIN usuarios u ON c.usuario_id = u.id 
      WHERE c.fecha_cierre BETWEEN ? AND ?
      ORDER BY c.fecha_cierre DESC
    `, [fechaInicio, fechaFin]);

    // Calcular totales del reporte
    const totalSaldo = cierres.reduce((sum, c) => sum + parseFloat(c.saldo_final), 0);
    const totalGastos = cierres.reduce((sum, c) => sum + parseFloat(c.total_gastos), 0);
    const totalEnCaja = cierres.reduce((sum, c) => sum + parseFloat(c.total_en_caja), 0);

    res.json({
      cierres: cierres.length,
      fechaInicio,
      fechaFin,
      resumen: {
        totalSaldo,
        totalGastos,
        totalEnCaja,
        promedioDiario: cierres.length > 0 ? totalSaldo / cierres.length : 0
      },
      datos: cierres.map(cierre => ({
        ...cierre,
        billetes: JSON.parse(cierre.billetes),
        dolares: cierre.dolares ? JSON.parse(cierre.dolares) : null,
        gastos: JSON.parse(cierre.gastos)
      }))
    });

  } catch (error) {
    console.error('Error en reporte por fechas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==========================================
// MANEJO DE ERRORES GLOBAL
// ==========================================

// Middleware para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err.stack);
  
  // Error de validación de JSON
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'JSON malformado' });
  }
  
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`📊 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🕐 Hora actual RD: ${getHoraRD().toLocaleString()}`);
  console.log(`📅 Fecha operativa: ${getFechaOperativaRD()}`);
  console.log('🚀 ================================');
});

// ==========================================
// MANEJO DE CIERRE LIMPIO
// ==========================================

const gracefulShutdown = (signal) => {
  console.log(`👋 Señal ${signal} recibida, cerrando servidor...`);
  
  // Cerrar pool de conexiones
  pool.end(() => {
    console.log('🔌 Pool de conexiones MySQL cerrado');
    process.exit(0);
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
  console.error('💥 Excepción no capturada:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesa rechazada no manejada:', reason);
  process.exit(1);
});
