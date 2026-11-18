/**
 * Baby shower de Benjamin: confirmaciones y lista de regalos sin repetidos.
 *
 * Cómo usarlo (resumen; detalles en README.md):
 *  1. Crea una Google Sheet nueva.
 *  2. Extensiones > Apps Script. Borra lo que haya y pega este archivo.
 *  3. Elige la función "setup" y dale Ejecutar (acepta los permisos).
 *  4. Implementar > Nueva implementación > Aplicación web
 *       Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier persona
 *  5. Copia la URL que termina en /exec y pégala en index.html (API_URL).
 *
 * Hojas que se crean:
 *  - Confirmaciones: cada respuesta del paso 1.
 *  - Regalos: el catálogo. Puedes editar nombres, tallas y cantidades.
 *  - Apartados: quién apartó qué. Para liberar uno a mano, cambia "activa" por "liberada".
 */

const HOJA_RSVP = 'Confirmaciones';
const HOJA_REGALOS = 'Regalos';
const HOJA_APARTADOS = 'Apartados';
const HOJA_PANALES = 'Pañales';

// Pañales sugeridos: proporción deseada de cada etapa.
// Cada invitado recibe como sugerencia la etapa que va más atrasada frente a esta meta.
const ETAPAS_PANAL = { 'Etapa 2': 0.3, 'Etapa 3': 0.4, 'Etapa 4': 0.3 };

// ID de la Google Sheet (lo que va entre /d/ y /edit en su URL).
// Si el script se crea desde la hoja (Extensiones > Apps Script) puede quedar vacío.
const SHEET_ID = '1lVepYKvbsp3mgVOQmewN6aAjZGzEYK1tUTHMhTShfcc';

function libro_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function hoja_(nombre, encabezados) {
  const ss = libro_();
  let h = ss.getSheetByName(nombre);
  if (!h) {
    h = ss.insertSheet(nombre);
    h.appendRow(encabezados);
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, encabezados.length).setFontWeight('bold').setBackground('#e6f1df');
  }
  return h;
}

/** Ejecútala una vez para crear las hojas y el catálogo inicial. */
function setup() {
  hoja_(HOJA_RSVP, ['Fecha', 'Nombre', 'Asiste', 'Adultos', 'Niños', 'Mensaje']);
  hoja_(HOJA_APARTADOS, ['Fecha', 'ID regalo', 'Regalo', 'Talla', 'Invitado', 'Código', 'Estado']);
  hojaPanales_();
  columnaEligio_();
  const reg = hoja_(HOJA_REGALOS, ['ID', 'Categoría', 'Regalo', 'Detalle', 'Talla', 'Cantidad']);
  if (reg.getLastRow() > 1) return; // ya tiene catálogo: no lo pisa

  const filas = [];
  const add = (cat, regalo, detalle, tallas) => {
    Object.keys(tallas).forEach(t => filas.push([slug_(regalo + '-' + t), cat, regalo, detalle, t, tallas[t]]));
  };
  add('Ropa', 'Pijama enteriza', 'Con cremallera o broches, algodón suave', { '12-18 m': 2, '18-24 m': 2, '2 años': 1 });
  add('Ropa', 'Bodies manga larga', 'Paquete de 3 o más', { '12-18 m': 2, '18-24 m': 1 });
  add('Ropa', 'Conjunto de diario', 'Pantalón + camiseta o buzo', { '12-18 m': 2, '18-24 m': 2, '2 años': 1 });
  add('Ropa', 'Chaqueta o buzo abrigado', 'Para el frío bogotano', { '12-18 m': 1, '18-24 m': 1 });
  add('Ropa', 'Medias antideslizantes', 'Paquete', { '12-24 m': 2 });
  add('Pañales y aseo', 'Pañitos húmedos', 'Paquete x3, sin fragancia', { 'Única': 4 });
  add('Pañales y aseo', 'Kit de baño', 'Shampoo, jabón y crema antipañalitis', { 'Única': 2 });
  add('Pañales y aseo', 'Toalla con capota', '', { 'Única': 2 });
  add('Comida', 'Set de baberos', 'Impermeables o de silicona', { 'Única': 2 });
  add('Comida', 'Vajilla de silicona', 'Plato, vaso y cucharas', { 'Única': 1 });
  add('Comida', 'Silla de comer', '', { 'Única': 1 });
  add('Paseo y descanso', 'Portabebé ergonómico', '', { 'Única': 1 });
  add('Paseo y descanso', 'Monitor de bebé', '', { 'Única': 1 });
  add('Paseo y descanso', 'Juego de sábanas para cuna', '', { 'Única': 2 });
  add('Paseo y descanso', 'Cobija suave', '', { 'Única': 2 });
  add('Juego', 'Libros de tela o cartón', '', { 'Única': 3 });
  add('Juego', 'Gimnasio de actividades', '', { 'Única': 1 });
  add('Juego', 'Mordedores y sonajeros', '', { 'Única': 2 });
  reg.getRange(2, 1, filas.length, 6).setValues(filas);
  reg.getRange(2, 5, filas.length, 1).setNumberFormat('@'); // que "3-6 m" no se vuelva fecha
}

/* ---------------- API web ---------------- */

function doGet(e) {
  const accion = (e && e.parameter && e.parameter.action) || 'gifts';
  if (accion === 'gifts') return json_({ ok: true, gifts: listarRegalos_(), panales: estadoPanales_() });
  return json_({ ok: false, error: 'accion' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // una operación a la vez: evita que dos personas aparten el último
    const d = JSON.parse(e.postData.contents || '{}');
    const acciones = { rsvp: guardarRsvp_, reserve: apartar_, cancel: liberar_, panal: anotarPanal_, cancelPanal: quitarPanal_ };
    const fn = acciones[d.action];
    if (!fn) return json_({ ok: false, error: 'accion' });
    const res = fn(d);
    if (res.ok && d.action !== 'rsvp') columnaEligio_();
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: 'servidor' });
  } finally {
    lock.releaseLock();
  }
}

function listarRegalos_() {
  const reg = libro_().getSheetByName(HOJA_REGALOS).getDataRange().getValues().slice(1);
  const usados = {};
  libro_().getSheetByName(HOJA_APARTADOS).getDataRange().getValues().slice(1).forEach(r => {
    if (r[6] === 'activa') usados[r[1]] = (usados[r[1]] || 0) + 1;
  });
  return reg.filter(r => r[0] && r[2]).map(r => {
    const cantidad = Number(r[5]) || 0;
    return {
      id: String(r[0]), categoria: String(r[1]), regalo: String(r[2]), detalle: String(r[3]),
      talla: String(r[4]), cantidad: cantidad, quedan: Math.max(0, cantidad - (usados[r[0]] || 0))
    };
  });
}

// Si el nombre ya confirmó (sin importar mayúsculas, tildes o espacios), se actualiza su fila
// en lugar de crear otra. Así "Cambiar mi respuesta" corrige y no se duplican los conteos.
function guardarRsvp_(d) {
  const nombre = limpio_(d.nombre, 80);
  if (nombre.length < 2) return { ok: false, error: 'nombre' };
  const h = libro_().getSheetByName(HOJA_RSVP);
  const fila = [
    new Date(), nombre, d.asiste === 'No' ? 'No' : 'Sí',
    entero_(d.adultos), entero_(d.ninos), limpio_(d.mensaje, 400)
  ];
  const clave = claveNombre_(nombre);
  const nombres = h.getLastRow() > 1 ? h.getRange(2, 2, h.getLastRow() - 1, 1).getValues() : [];
  let r = nombres.findIndex(x => claveNombre_(x[0]) === clave);
  let actualizada = r >= 0;
  r = actualizada ? r + 2 : h.getLastRow() + 1;
  h.getRange(r, 1, 1, fila.length).setValues([fila]);
  columnaEligio_(h);
  return { ok: true, actualizada: actualizada };
}

// Columna G "¿Ya eligió?": Sí si ese nombre tiene un regalo apartado o pañales anotados.
// Se recalcula en cada confirmación, apartado o cambio (valores, no fórmulas: no depende del idioma de la hoja).
function columnaEligio_(h) {
  h = h || libro_().getSheetByName(HOJA_RSVP);
  h.getRange(1, 7).setValue('¿Ya eligió?').setFontWeight('bold').setBackground('#e6f1df');
  const ultima = h.getLastRow();
  if (ultima < 2) return;
  const conRegalo = {};
  libro_().getSheetByName(HOJA_APARTADOS).getDataRange().getValues().slice(1).forEach(r => {
    if (r[6] === 'activa') conRegalo[claveNombre_(r[4])] = true;
  });
  hojaPanales_().getDataRange().getValues().slice(1).forEach(r => {
    if (r[4] === 'activa') conRegalo[claveNombre_(r[1])] = true;
  });
  const valores = h.getRange(2, 2, ultima - 1, 1).getValues().map(x =>
    [x[0] === '' ? '' : (conRegalo[claveNombre_(x[0])] ? 'Sí' : 'Aún no')]);
  h.getRange(2, 7, valores.length, 1).setValues(valores);
}

function claveNombre_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function apartar_(d) {
  const g = listarRegalos_().find(x => x.id === String(d.id));
  if (!g) return { ok: false, error: 'no_existe' };
  if (g.quedan <= 0) return { ok: false, error: 'agotado' };
  const codigo = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  libro_().getSheetByName(HOJA_APARTADOS).appendRow([
    new Date(), g.id, g.regalo, "'" + g.talla, limpio_(d.invitado, 80), codigo, 'activa'
  ]);
  return { ok: true, codigo: codigo, quedan: g.quedan - 1 };
}

function liberar_(d) {
  const h = libro_().getSheetByName(HOJA_APARTADOS);
  const datos = h.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][5] === String(d.codigo) && datos[i][6] === 'activa') {
      h.getRange(i + 1, 7).setValue('liberada');
      return { ok: true };
    }
  }
  return { ok: false, error: 'no_existe' };
}

/* ---------------- pañales (sugerencia opcional) ---------------- */

function hojaPanales_() {
  return hoja_(HOJA_PANALES, ['Fecha', 'Invitado', 'Etapa', 'Código', 'Estado']);
}

function estadoPanales_() {
  const conteo = {};
  Object.keys(ETAPAS_PANAL).forEach(e => conteo[e] = 0);
  hojaPanales_().getDataRange().getValues().slice(1).forEach(r => {
    if (r[4] === 'activa' && conteo[r[2]] !== undefined) conteo[r[2]]++;
  });
  // Sugerida: la etapa más lejos de su proporción meta (empate: la de mayor proporción).
  let sugerida = null, mejor = Infinity;
  Object.keys(ETAPAS_PANAL).forEach(e => {
    const puntaje = (conteo[e] + 1) / ETAPAS_PANAL[e];
    if (puntaje < mejor - 1e-9 || (Math.abs(puntaje - mejor) < 1e-9 && ETAPAS_PANAL[e] > ETAPAS_PANAL[sugerida])) {
      mejor = puntaje; sugerida = e;
    }
  });
  return { conteo: conteo, sugerida: sugerida };
}

function anotarPanal_(d) {
  const etapa = String(d.etapa);
  if (!ETAPAS_PANAL[etapa]) return { ok: false, error: 'etapa' };
  const invitado = limpio_(d.invitado, 80);
  if (invitado.length < 2) return { ok: false, error: 'nombre' };
  const codigo = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  hojaPanales_().appendRow([new Date(), invitado, etapa, codigo, 'activa']);
  return { ok: true, codigo: codigo, panales: estadoPanales_() };
}

function quitarPanal_(d) {
  const h = hojaPanales_();
  const datos = h.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][3] === String(d.codigo) && datos[i][4] === 'activa') {
      h.getRange(i + 1, 5).setValue('liberada');
      return { ok: true };
    }
  }
  return { ok: false, error: 'no_existe' };
}

/* ---------------- utilidades ---------------- */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function limpio_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // evita que un texto se interprete como fórmula
  return s;
}
function entero_(v) { const n = parseInt(v, 10); return isNaN(n) ? 0 : Math.max(0, Math.min(30, n)); }
function slug_(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
