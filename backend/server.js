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
const XLSX = require('xlsx');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'database');

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

app.listen(PORT, () => {
  console.log(`Backend escuchando en el puerto ${PORT}`);
});
