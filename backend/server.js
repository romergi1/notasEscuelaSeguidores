/**
 * Backend Express: expone una API para consultar a los alumnos
 * a partir de los archivos Excel guardados en ./database
 *
 *   GET /api/health          -> estado del servicio
 *   GET /api/alumno?correo=..&modulo=1|2  -> datos del alumno
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'database');

// --- Autenticación de administrador ---------------------------------------
// La contraseña se define por variable de entorno ADMIN_PASSWORD (ver docker-compose.yml / .env).
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
// Si no se define JWT_SECRET, se genera una al arrancar (las sesiones se invalidan al reiniciar el backend).
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL = '8h';

// Mapa de módulo -> archivo Excel dentro de la carpeta local /database
const MODULES = {
  '1': 'Seguidores_Primer_Modulo.xlsx',
  '2': 'Seguidores_Segundo_Modulo.xlsx'
};

/**
 * Corrige textos que quedaron con "mojibake" (UTF-8 leído como Latin-1),
 * por ejemplo "Té©cnico" -> "Técnico".
 */
function fixEncoding(value) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    const fixed = Buffer.from(value, 'latin1').toString('utf8');
    // Solo lo aplicamos si el resultado no introduce el carácter de reemplazo
    if (!fixed.includes('\uFFFD')) {
      return fixed;
    }
  } catch (e) {
    // si algo falla, devolvemos el original
  }
  return value;
}

/**
 * Lee un archivo Excel y devuelve { headers: [...], rows: [ {..}, ... ] }.
 * Se usan los valores ya calculados de las fórmulas (cellFormula: false).
 */
function readModule(moduleId) {
  const fileName = MODULES[moduleId];
  if (!fileName) {
    return null;
  }
  const filePath = path.join(DB_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error('No se encontró el archivo: ' + fileName);
  }

  const workbook = XLSX.readFile(filePath); // toma los valores cacheados de las fórmulas
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Matriz de filas (array de arrays). defval:'' -> celdas vacías como cadena vacía
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!matrix.length) {
    return { headers: [], rows: [] };
  }

  const headers = matrix[0].map(fixEncoding);
  const rows = [];

  for (let i = 1; i < matrix.length; i++) {
    const rawRow = matrix[i];
    // Ignorar filas totalmente vacías
    const isEmpty = rawRow.every((c) => c === '' || c === null || c === undefined);
    if (isEmpty) {
      continue;
    }
    const obj = {};
    headers.forEach((h, idx) => {
      let cell = rawRow[idx];
      if (cell === undefined || cell === null) {
        cell = '';
      }
      obj[h] = fixEncoding(cell);
    });
    rows.push(obj);
  }

  return { headers, rows };
}

/**
 * Guarda una copia del Excel actual en database/backups/ antes de sobrescribirlo.
 */
function backupModule(moduleId) {
  const fileName = MODULES[moduleId];
  const filePath = path.join(DB_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }
  const backupDir = path.join(DB_DIR, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(filePath, path.join(backupDir, `${stamp}_${fileName}`));
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Reemplaza filePath por tmpPath, reintentando: en carpetas sincronizadas por
 * OneDrive el rename puede fallar transitoriamente con EBUSY/EPERM mientras
 * el archivo está siendo leído por el sincronizador.
 */
function replaceFileWithRetry(tmpPath, filePath, attempts = 8) {
  for (let i = 1; i <= attempts; i++) {
    try {
      fs.renameSync(tmpPath, filePath);
      return;
    } catch (err) {
      const retryable = err.code === 'EBUSY' || err.code === 'EPERM';
      if (!retryable || i === attempts) {
        try { fs.unlinkSync(tmpPath); } catch (e) { /* ignorar */ }
        throw err;
      }
      sleepSync(200);
    }
  }
}

/**
 * Reescribe el archivo Excel de un módulo a partir de los headers y filas dados,
 * preservando el nombre de la hoja original.
 */
function writeModule(moduleId, headers, rows) {
  const fileName = MODULES[moduleId];
  const filePath = path.join(DB_DIR, fileName);
  const original = XLSX.readFile(filePath);
  const sheetName = original.SheetNames[0];

  const matrix = [headers, ...rows.map((row) => headers.map((h) => (row[h] === undefined || row[h] === null ? '' : row[h])))];
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Se escribe primero a un archivo temporal y luego se reemplaza con rename:
  // escribir directamente sobre el .xlsx puede fallar con EBUSY en Windows
  // (por ejemplo, mientras OneDrive lo está sincronizando).
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  XLSX.writeFile(workbook, tmpPath, { bookType: 'xlsx' });
  replaceFileWithRetry(tmpPath, filePath);
}

/**
 * Middleware: exige un token válido (Authorization: Bearer <token>) emitido por /api/admin/login.
 */
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesión inválida o expirada. Vuelve a iniciar sesión.' });
  }
}

// --- Rutas ---------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/alumno', (req, res) => {
  const correo = (req.query.correo || '').toString().trim().toLowerCase();
  const modulo = (req.query.modulo || '').toString().trim();

  if (!correo) {
    return res.status(400).json({ error: 'Debe indicar un correo electrónico.' });
  }
  if (!MODULES[modulo]) {
    return res.status(400).json({ error: 'Módulo inválido. Use 1 o 2.' });
  }

  let data;
  try {
    data = readModule(modulo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al leer la base de datos.' });
  }

  // Buscamos por la columna CorreoElectronico (insensible a mayúsculas y espacios)
  const correoKey = 'CorreoElectronico';
  const alumno = data.rows.find((row) => {
    const value = (row[correoKey] || '').toString().trim().toLowerCase();
    return value === correo;
  });

  if (!alumno) {
    return res.status(404).json({ error: 'Alumno no existe' });
  }

  return res.json({
    headers: data.headers,
    alumno: alumno,
    modulo: modulo
  });
});

// --- Rutas de administración ----------------------------------------------

app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: 'El servidor no tiene configurada ADMIN_PASSWORD.' });
  }
  const password = (req.body && req.body.password) || '';
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token });
});

// Headers de un módulo (útil para armar el formulario de "nuevo alumno")
app.get('/api/admin/headers', requireAdmin, (req, res) => {
  const modulo = (req.query.modulo || '').toString().trim();
  if (!MODULES[modulo]) {
    return res.status(400).json({ error: 'Módulo inválido. Use 1 o 2.' });
  }
  try {
    const modData = readModule(modulo);
    res.json({ headers: modData.headers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer la base de datos.' });
  }
});

app.get('/api/admin/alumno', requireAdmin, (req, res) => {
  const correo = (req.query.correo || '').toString().trim().toLowerCase();
  const modulo = (req.query.modulo || '').toString().trim();

  if (!correo) {
    return res.status(400).json({ error: 'Debe indicar un correo electrónico.' });
  }
  if (!MODULES[modulo]) {
    return res.status(400).json({ error: 'Módulo inválido. Use 1 o 2.' });
  }

  let modData;
  try {
    modData = readModule(modulo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al leer la base de datos.' });
  }

  const alumno = modData.rows.find((row) => (row['CorreoElectronico'] || '').toString().trim().toLowerCase() === correo);
  if (!alumno) {
    return res.status(404).json({ error: 'Alumno no existe', headers: modData.headers });
  }
  res.json({ headers: modData.headers, alumno, modulo });
});

// Crear un alumno nuevo
app.post('/api/admin/alumno', requireAdmin, (req, res) => {
  const modulo = (req.body && req.body.modulo) || '';
  const nuevo = (req.body && req.body.data) || null;

  if (!MODULES[modulo]) {
    return res.status(400).json({ error: 'Módulo inválido. Use 1 o 2.' });
  }
  if (!nuevo || !(nuevo['CorreoElectronico'] || '').toString().trim()) {
    return res.status(400).json({ error: 'El correo electrónico es obligatorio.' });
  }

  let modData;
  try {
    modData = readModule(modulo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al leer la base de datos.' });
  }

  const correo = nuevo['CorreoElectronico'].toString().trim().toLowerCase();
  const existe = modData.rows.some((row) => (row['CorreoElectronico'] || '').toString().trim().toLowerCase() === correo);
  if (existe) {
    return res.status(409).json({ error: 'Ya existe un alumno con ese correo en este módulo.' });
  }

  const fila = {};
  modData.headers.forEach((h) => {
    fila[h] = nuevo[h] !== undefined && nuevo[h] !== null ? nuevo[h] : '';
  });
  modData.rows.push(fila);

  try {
    backupModule(modulo);
    writeModule(modulo, modData.headers, modData.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al guardar el archivo Excel.' });
  }

  res.status(201).json({ headers: modData.headers, alumno: fila, modulo });
});

// Editar un alumno existente (se identifica por su correo original)
app.put('/api/admin/alumno', requireAdmin, (req, res) => {
  const modulo = (req.body && req.body.modulo) || '';
  const correoOriginal = ((req.body && req.body.correoOriginal) || '').toString().trim().toLowerCase();
  const cambios = (req.body && req.body.data) || {};

  if (!MODULES[modulo]) {
    return res.status(400).json({ error: 'Módulo inválido. Use 1 o 2.' });
  }
  if (!correoOriginal) {
    return res.status(400).json({ error: 'Falta el correo original del alumno.' });
  }

  let modData;
  try {
    modData = readModule(modulo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al leer la base de datos.' });
  }

  const idx = modData.rows.findIndex((row) => (row['CorreoElectronico'] || '').toString().trim().toLowerCase() === correoOriginal);
  if (idx === -1) {
    return res.status(404).json({ error: 'Alumno no existe' });
  }

  const filaActualizada = { ...modData.rows[idx] };
  modData.headers.forEach((h) => {
    if (Object.prototype.hasOwnProperty.call(cambios, h)) {
      filaActualizada[h] = cambios[h] !== undefined && cambios[h] !== null ? cambios[h] : '';
    }
  });
  modData.rows[idx] = filaActualizada;

  try {
    backupModule(modulo);
    writeModule(modulo, modData.headers, modData.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al guardar el archivo Excel.' });
  }

  res.json({ headers: modData.headers, alumno: filaActualizada, modulo });
});

// Eliminar un alumno
app.delete('/api/admin/alumno', requireAdmin, (req, res) => {
  const correo = (req.query.correo || '').toString().trim().toLowerCase();
  const modulo = (req.query.modulo || '').toString().trim();

  if (!correo) {
    return res.status(400).json({ error: 'Debe indicar un correo electrónico.' });
  }
  if (!MODULES[modulo]) {
    return res.status(400).json({ error: 'Módulo inválido. Use 1 o 2.' });
  }

  let modData;
  try {
    modData = readModule(modulo);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al leer la base de datos.' });
  }

  const idx = modData.rows.findIndex((row) => (row['CorreoElectronico'] || '').toString().trim().toLowerCase() === correo);
  if (idx === -1) {
    return res.status(404).json({ error: 'Alumno no existe' });
  }
  modData.rows.splice(idx, 1);

  try {
    backupModule(modulo);
    writeModule(modulo, modData.headers, modData.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al guardar el archivo Excel.' });
  }

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
