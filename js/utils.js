// ============================================================
// FAMILIA FEITOZA — UTILS
// Funções utilitárias puras (sem side-effects de DOM/DB).
// ============================================================

'use strict';

// ---------- Sanitização (XSS prevention) ----------
/**
 * Escapa string para inserção segura em innerHTML.
 * @param {*} val - qualquer valor
 * @returns {string} string escapada
 */
function esc(val) {
  if (val == null) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- Formatação de moeda ----------
/**
 * Formata valor como R$ BRL.
 * @param {number} val
 * @returns {string}
 */
function fmt(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ---------- Formatação de data ----------
/**
 * Formata data (YYYY-MM-DD) para DD/MM/AAAA.
 * @param {string} date
 * @returns {string}
 */
function fmtDate(date) {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  if (!y || !m || !d) return date;
  return `${d}/${m}/${y}`;
}

/**
 * Retorna label "Mês AAAA" para navegação do calendário.
 * @param {number} m - 0..11
 * @param {number} y - 4 digits
 * @returns {string}
 */
function fmtMonth(m, y) {
  return `${MONTHS_PT[m]} ${y}`;
}

// ---------- Geração de ID ----------
/**
 * Gera ID único baseado em timestamp + random.
 * @returns {number}
 */
function uid() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

// ---------- Debounce ----------
/**
 * Retorna versão debounced de fn.
 * @param {Function} fn
 * @param {number} delay - ms
 * @returns {Function}
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ---------- Throttle ----------
/**
 * Retorna versão throttled de fn.
 * @param {Function} fn
 * @param {number} limit - ms
 * @returns {Function}
 */
function throttle(fn, limit) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= limit) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// ---------- Clamp ----------
/**
 * Limita val entre min e max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// ---------- Percentual seguro ----------
/**
 * Calcula percentual sem divisão por zero.
 * @param {number} part
 * @param {number} total
 * @returns {number} 0..100
 */
function pct(part, total) {
  if (!total) return 0;
  return clamp((part / total) * 100, 0, 100);
}

// ---------- Datas helpers ----------
/**
 * Retorna string YYYY-MM-DD da data atual.
 * @returns {string}
 */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Verifica se data (YYYY-MM-DD) é hoje.
 * @param {string} date
 * @returns {boolean}
 */
function isToday(date) {
  return date === todayStr();
}

/**
 * Verifica se data (YYYY-MM-DD) está no passado.
 * @param {string} date
 * @returns {boolean}
 */
function isPast(date) {
  return date < todayStr();
}

/**
 * Verifica se data está nos próximos N dias.
 * @param {string} date
 * @param {number} days
 * @returns {boolean}
 */
function isWithinDays(date, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + 'T00:00:00');
  const diff = (target - today) / 86400000;
  return diff >= 0 && diff <= days;
}

/**
 * Verifica se data está na semana atual.
 * @param {string} date
 * @returns {boolean}
 */
function isThisWeek(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay(); // 0=Dom
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const d = new Date(date + 'T00:00:00');
  return d >= monday && d <= sunday;
}

// ---------- Destroy chart seguro ----------
/**
 * Destrói instância Chart.js se existir.
 * @param {HTMLCanvasElement} canvas
 */
function destroyChart(canvas) {
  if (!canvas) return;
  if (canvas._chartInstance) {
    try { canvas._chartInstance.destroy(); } catch (_) {}
    canvas._chartInstance = null;
  }
  // fallback para instâncias registradas por Chart.js
  const existing = Chart.getChart(canvas);
  if (existing) {
    try { existing.destroy(); } catch (_) {}
  }
}

// ---------- Cor de categoria ----------
/**
 * Retorna cor hex da categoria.
 * @param {string} cat
 * @returns {string}
 */
function catColor(cat) {
  const found = CATEGORIES.find(c => c.value === cat);
  return found ? found.color : '#6b7280';
}

/**
 * Retorna ícone da categoria.
 * @param {string} cat
 * @returns {string}
 */
function catIcon(cat) {
  const found = CATEGORIES.find(c => c.value === cat);
  return found ? found.icon : '📦';
}

// ---------- Validação de entrada ----------
/**
 * Valida e retorna objeto com erros de formulário de evento.
 * @param {object} fields - { title, date, amount, type }
 * @returns {string[]} lista de erros
 */
function validateEvent(fields) {
  const errors = [];
  if (!fields.title?.trim()) errors.push('Título obrigatório');
  if (!fields.date) errors.push('Data obrigatória');
  if (!fields.amount || isNaN(Number(fields.amount)) || Number(fields.amount) < 0)
    errors.push('Valor inválido');
  if (!fields.type) errors.push('Tipo obrigatório');
  return errors;
}

/**
 * Deep clone seguro via JSON.
 * @param {*} obj
 * @returns {*}
 */
function deepClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch (_) { return obj; }
}

// ---------- Memoize ----------
/**
 * Memoiza função de um argumento (string/number key).
 * Cache é limpo quando cleanMemo() for chamado.
 * @param {Function} fn
 * @returns {Function}
 */
function memoize(fn) {
  const cache = new Map();
  const memoized = function (key) {
    if (cache.has(key)) return cache.get(key);
    const result = fn(key);
    cache.set(key, result);
    return result;
  };
  memoized.clear = () => cache.clear();
  return memoized;
}
