/* ═══════════════════════════════════════════════════════
   GITCHALLENGE — app2.js
   Juego del Ahorcado basado en los enunciados de nivel{N}.json
   ═══════════════════════════════════════════════════════ */

const CONFIG2 = {
  totalNiveles:    8,
  maxErrores:      6,
  rutaBase:        '../backend/data/nivel',
};

function getNivelActual() {
  const params = new URLSearchParams(window.location.search);
  const n = parseInt(params.get('nivel')) || 1;
  return Math.max(1, Math.min(n, CONFIG2.totalNiveles));
}

const state = {
  nivelActual:   getNivelActual(),
  preguntas:     [],
  indice:        0,
  puntos:        0,
  correctas:     0,
  errores:       0,
  letrasUsadas:  new Set(),
  palabraActual: '',
  terminado:     false,
};

const dom = {
  nivelLabel:    document.getElementById('nivel-label'),
  scoreVal:      document.getElementById('score-val'),
  qCounter:      document.getElementById('q-counter'),
  progressFill:  document.getElementById('progress-fill'),
  horca:         document.getElementById('horca-svg'),
  wordDisplay:   document.getElementById('word-display'),
  letrasUsadas:  document.getElementById('letras-usadas'),
  teclado:       document.getElementById('teclado'),
  feedbackBox:   document.getElementById('feedback-box'),
  btnNext:       document.getElementById('btn-next'),
  hintText:      document.getElementById('hint-text'),
  erroresCount:  document.getElementById('errores-count'),
  questionCard:  document.getElementById('question-card'),
  resultsScreen: document.getElementById('results-screen'),
  hud:           document.getElementById('hud'),
  progressWrap:  document.getElementById('progress-wrap'),
};

/* ── Partes del ahorcado (SVG paths que se muestran progresivamente) ── */
const HORCA_PARTES = [
  'parte-base',
  'parte-poste',
  'parte-viga',
  'parte-soga',
  'parte-cabeza',
  'parte-cuerpo',
  'parte-brazos',
  'parte-piernas',
];

/* ── Normaliza texto para el juego (mayúsculas, sin tildes) ── */
function normalizar(str) {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* ── Extrae la "palabra clave" del enunciado ── */
function extraerPalabra(pregunta) {
  // Preferir fragmento_codigo si existe (suele ser corto y técnico)
  if (pregunta.fragmento_codigo) {
    const codigo = pregunta.fragmento_codigo.replace(/\[.*?\]/g, '').trim();
    if (codigo.length >= 3) return normalizar(codigo);
  }
  // Si es verdadero_falso, usar la opción correcta
  if (pregunta.tipo === 'verdadero_falso') {
    const correcta = pregunta.opciones.find(o => o.es_correcta);
    if (correcta) return normalizar(correcta.texto);
  }
  // Para opcion_multiple, usar texto de la opción correcta
  const correcta = pregunta.opciones ? pregunta.opciones.find(o => o.es_correcta) : null;
  if (correcta && correcta.texto.length >= 3 && correcta.texto.length <= 40) {
    return normalizar(correcta.texto);
  }
  // Fallback: usar últimas 2-3 palabras del enunciado
  const palabras = normalizar(pregunta.enunciado).split(' ');
  return palabras.slice(-2).join(' ');
}

/* ════════════════════════════════════════════
   INICIO
════════════════════════════════════════════ */
async function iniciarJuego() {
  if (dom.nivelLabel) dom.nivelLabel.textContent = `NIVEL ${state.nivelActual}`;
  try {
    const url = `${CONFIG2.rutaBase}${state.nivelActual}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se encontró ${url}`);
    const data = await res.json();
    state.preguntas = data.preguntas;
    mostrarPregunta();
  } catch (err) {
    console.error('Error:', err);
    dom.hintText.textContent = `❌ No se pudo cargar el nivel ${state.nivelActual}. Usa Live Server.`;
  }
}

/* ════════════════════════════════════════════
   MOSTRAR PREGUNTA
════════════════════════════════════════════ */
function mostrarPregunta() {
  const pregunta = state.preguntas[state.indice];
  state.errores = 0;
  state.letrasUsadas = new Set();
  state.terminado = false;
  state.palabraActual = extraerPalabra(pregunta);

  const total = state.preguntas.length;
  dom.qCounter.textContent     = `${state.indice + 1} / ${total}`;
  dom.progressFill.style.width = `${(state.indice / total) * 100}%`;
  dom.erroresCount.textContent = `${state.errores} / ${CONFIG2.maxErrores}`;

  dom.feedbackBox.className = 'feedback-box';
  dom.btnNext.className     = 'btn-next';

  // Hint = enunciado completo de la pregunta
  dom.hintText.textContent = `💡 ${pregunta.enunciado}`;

  actualizarHorca();
  actualizarPalabra();
  actualizarLetrasUsadas();
  generarTeclado(pregunta);

  // Animación de entrada
  dom.questionCard.style.animation = 'none';
  dom.questionCard.offsetHeight;
  dom.questionCard.style.animation = 'scaleIn 0.4s cubic-bezier(.16,1,.3,1) both';
}

/* ════════════════════════════════════════════
   TECLADO
════════════════════════════════════════════ */
function generarTeclado(pregunta) {
  dom.teclado.innerHTML = '';
  const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  LETRAS.forEach(letra => {
    const btn = document.createElement('button');
    btn.className      = 'key-btn';
    btn.textContent    = letra;
    btn.dataset.letra  = letra;
    btn.onclick        = () => seleccionarLetra(letra, pregunta);
    dom.teclado.appendChild(btn);
  });
}

/* ════════════════════════════════════════════
   SELECCIONAR LETRA
════════════════════════════════════════════ */
function seleccionarLetra(letra, pregunta) {
  if (state.terminado || state.letrasUsadas.has(letra)) return;
  state.letrasUsadas.add(letra);

  const btn = dom.teclado.querySelector(`[data-letra="${letra}"]`);
  const enPalabra = state.palabraActual.includes(letra);

  if (enPalabra) {
    btn.classList.add('key-correct');
  } else {
    btn.classList.add('key-wrong');
    state.errores++;
    dom.erroresCount.textContent = `${state.errores} / ${CONFIG2.maxErrores}`;
    actualizarHorca();
  }

  btn.disabled = true;
  actualizarPalabra();
  actualizarLetrasUsadas();
  verificarEstado(pregunta);
}

/* ════════════════════════════════════════════
   VERIFICAR ESTADO
════════════════════════════════════════════ */
function verificarEstado(pregunta) {
  const letrasUnicas = [...new Set(state.palabraActual.replace(/[^A-Z]/g, ''))];
  const ganó = letrasUnicas.every(l => state.letrasUsadas.has(l));
  const perdió = state.errores >= CONFIG2.maxErrores;

  if (!ganó && !perdió) return;

  state.terminado = true;
  deshabilitarTeclado();

  const puntosGanados = ganó ? (pregunta.puntos || 10) : 0;
  if (ganó) {
    state.puntos += puntosGanados;
    state.correctas++;
    dom.scoreVal.textContent = state.puntos;
    dom.scoreVal.classList.add('bump');
    setTimeout(() => dom.scoreVal.classList.remove('bump'), 400);
  }

  const correcta = pregunta.opciones ? pregunta.opciones.find(o => o.es_correcta) : null;
  const feedbackMsg = ganó
    ? `✓ ¡Correcto! ${correcta?.feedback || '¡Excelente!'}`
    : `✗ Era: "${state.palabraActual}" — ${correcta?.feedback || 'Sigue practicando.'}`;

  dom.feedbackBox.textContent = feedbackMsg;
  dom.feedbackBox.className   = `feedback-box show ${ganó ? 'ok' : 'fail'}`;

  // Revelar palabra completa si perdió
  if (perdió) {
    actualizarPalabra(true);
  }

  const esUltima = state.indice === state.preguntas.length - 1;
  dom.btnNext.textContent = esUltima ? 'VER RESULTADOS →' : 'SIGUIENTE PREGUNTA →';
  dom.btnNext.classList.add('show');
}

function deshabilitarTeclado() {
  dom.teclado.querySelectorAll('.key-btn').forEach(b => b.disabled = true);
}

/* ════════════════════════════════════════════
   ACTUALIZAR DISPLAY
════════════════════════════════════════════ */
function actualizarPalabra(revelar = false) {
  dom.wordDisplay.innerHTML = '';
  [...state.palabraActual].forEach(char => {
    const span = document.createElement('span');
    if (char === ' ') {
      span.className = 'letter-space';
      span.textContent = ' ';
    } else if (/[^A-Z]/.test(char)) {
      span.className = 'letter-box revealed';
      span.textContent = char;
    } else {
      const mostrar = revelar || state.letrasUsadas.has(char);
      span.className = mostrar ? 'letter-box revealed' : 'letter-box';
      span.textContent = mostrar ? char : '';
    }
    dom.wordDisplay.appendChild(span);
  });
}

function actualizarLetrasUsadas() {
  dom.letrasUsadas.textContent = state.letrasUsadas.size > 0
    ? `Usadas: ${[...state.letrasUsadas].sort().join(' ')}`
    : '';
}

/* ════════════════════════════════════════════
   HORCA SVG
════════════════════════════════════════════ */
function actualizarHorca() {
  const partes = [
    'parte-base', 'parte-poste', 'parte-viga', 'parte-soga',
    'parte-cabeza', 'parte-cuerpo', 'parte-brazos', 'parte-piernas'
  ];
  // Las primeras 4 son siempre visibles (estructura)
  partes.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (i < 4) {
      el.style.opacity = '1';
    } else {
      // errores 1=cabeza, 2=cuerpo, 3=brazos, 4=piernas
      el.style.opacity = (state.errores >= i - 3) ? '1' : '0';
    }
  });
}

/* ════════════════════════════════════════════
   SIGUIENTE PREGUNTA
════════════════════════════════════════════ */
function nextQuestion() {
  state.indice++;
  if (state.indice >= state.preguntas.length) mostrarResultados();
  else mostrarPregunta();
}

/* ════════════════════════════════════════════
   PANTALLA DE RESULTADOS
════════════════════════════════════════════ */
async function mostrarResultados() {
  dom.progressFill.style.width   = '100%';
  dom.questionCard.style.display = 'none';
  dom.hud.style.display          = 'none';
  dom.progressWrap.style.display = 'none';
  dom.resultsScreen.classList.add('show');

  const puntajeMax = state.preguntas.reduce((acc, p) => acc + (p.puntos || 10), 0);
  const porcentaje = Math.round((state.puntos / puntajeMax) * 100);
  const total      = state.preguntas.length;

  let trofeo, titulo, mensaje;
  if      (porcentaje >= 90) { trofeo = '🏆'; titulo = '¡Maestro del Ahorcado!';   mensaje = '¡Dominas los conceptos de Git perfectamente!'; }
  else if (porcentaje >= 70) { trofeo = '⭐'; titulo = '¡Muy Buen Trabajo!';        mensaje = 'Tienes una base sólida. ¡Sigue así!'; }
  else if (porcentaje >= 50) { trofeo = '📈'; titulo = '¡Buen Intento!';            mensaje = 'Vas por buen camino. Repasa los conceptos.'; }
  else                       { trofeo = '💪'; titulo = '¡Sigue Practicando!';       mensaje = 'Git tiene muchos conceptos. ¡Vuelve a intentarlo!'; }

  document.getElementById('result-trophy').textContent  = trofeo;
  document.getElementById('result-title').textContent   = titulo;
  document.getElementById('result-score').innerHTML     = `${state.puntos} <span>/ ${puntajeMax} pts</span>`;
  document.getElementById('result-message').textContent = mensaje;
  document.getElementById('result-stats').innerHTML     = `
    <div class="badge"><strong>${state.correctas}</strong> / ${total} correctas</div>
    <div class="badge"><strong>${porcentaje}%</strong> precisión</div>
    <div class="badge">NIVEL <strong>${state.nivelActual}</strong></div>
  `;

  const siguienteNivel = state.nivelActual + 1;
  const hayMas         = siguienteNivel <= CONFIG2.totalNiveles;
  const btnSig         = document.getElementById('btn-siguiente-nivel');

  let existeSiguiente = false;
  if (hayMas) {
    try {
      const check = await fetch(`${CONFIG2.rutaBase}${siguienteNivel}.json`, { method: 'HEAD' });
      existeSiguiente = check.ok;
    } catch { existeSiguiente = false; }
  }

  if (existeSiguiente) {
    btnSig.textContent = `⚔️  NIVEL ${siguienteNivel} →`;
    btnSig.disabled    = false;
    btnSig.onclick     = () => { window.location.href = `game2.html?nivel=${siguienteNivel}`; };
  } else if (hayMas) {
    btnSig.innerHTML    = `NIVEL ${siguienteNivel} — <em>Próximamente</em>`;
    btnSig.disabled     = true;
    btnSig.style.opacity = '0.4';
  } else {
    btnSig.textContent  = '🎉 ¡Completaste todos los niveles!';
    btnSig.disabled     = true;
    btnSig.style.opacity = '0.5';
  }
}

iniciarJuego();