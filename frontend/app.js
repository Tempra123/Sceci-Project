/* ═══════════════════════════════════════════════════════
   GITCHALLENGE — app.js
   Lógica completa del juego con soporte multi-nivel:
     · Lee el parámetro ?nivel=N de la URL
     · Carga el archivo nivel{N}.json correspondiente
     · Al terminar muestra opción de ir al siguiente nivel
   ═══════════════════════════════════════════════════════ */

/* ── Configuración de niveles ── */
const CONFIG = {
  totalNiveles:         8,
  segundosPorPregunta:  20,
  rutaBase:             '../backend/data/nivel',
};

/* ── Lee el nivel actual desde la URL (?nivel=1) ── */
function getNivelActual() {
  const params = new URLSearchParams(window.location.search);
  const n = parseInt(params.get('nivel')) || 1;
  return Math.max(1, Math.min(n, CONFIG.totalNiveles));
}

/* ── Estado global del juego ── */
const state = {
  nivelActual:    getNivelActual(),
  preguntas:      [],
  indice:         0,
  puntos:         0,
  correctas:      0,
  timer:          null,
  tiempoRestante: CONFIG.segundosPorPregunta,
  respondida:     false,
};

/* ── Referencias al DOM ── */
const dom = {
  qType:          document.getElementById('q-type'),
  qText:          document.getElementById('q-text'),
  qCode:          document.getElementById('q-code'),
  optionsGrid:    document.getElementById('options-grid'),
  feedbackBox:    document.getElementById('feedback-box'),
  btnNext:        document.getElementById('btn-next'),
  scoreVal:       document.getElementById('score-val'),
  timerText:      document.getElementById('timer-text'),
  timerWrapper:   document.getElementById('timer-wrapper'),
  timerSvg:       document.getElementById('timer-svg'),
  timerProgress:  document.querySelector('.timer-progress'),
  qCounter:       document.getElementById('q-counter'),
  progressFill:   document.getElementById('progress-fill'),
  questionCard:   document.getElementById('question-card'),
  resultsScreen:  document.getElementById('results-screen'),
  hud:            document.getElementById('hud'),
  progressWrap:   document.getElementById('progress-wrap'),
  nivelLabel:     document.getElementById('nivel-label'),
};

const TIPO_LABELS = {
  opcion_multiple: '⬡  Opción múltiple',
  completar:       '✦  Completar el código',
  verdadero_falso: '◈  Verdadero / Falso',
  ordenar:         '⟳  Ordenar pasos',
  encuentra_error: '⚠  Encuentra el error',
};

/* ════════════════════════════════════════════
   INICIO
════════════════════════════════════════════ */
async function iniciarJuego() {
  if (dom.nivelLabel) dom.nivelLabel.textContent = `NIVEL ${state.nivelActual}`;

  try {
    const url = `${CONFIG.rutaBase}${state.nivelActual}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No se encontró ${url}`);
    const data = await res.json();
    state.preguntas = data.preguntas;
    mostrarPregunta();
  } catch (err) {
    console.error('Error:', err);
    dom.qType.textContent = 'ERROR';
    dom.qText.textContent = `❌ No se pudo cargar el nivel ${state.nivelActual}. Usa Live Server.`;
  }
}

/* ════════════════════════════════════════════
   MOSTRAR PREGUNTA
════════════════════════════════════════════ */
function mostrarPregunta() {
  const pregunta = state.preguntas[state.indice];
  state.respondida = false;

  dom.questionCard.style.animation = 'none';
  dom.questionCard.offsetHeight;
  dom.questionCard.style.animation = 'scaleIn 0.4s cubic-bezier(.16,1,.3,1) both';

  dom.qType.textContent = TIPO_LABELS[pregunta.tipo] || pregunta.tipo;
  dom.qText.textContent = pregunta.enunciado;

  if (pregunta.fragmento_codigo) {
    dom.qCode.textContent    = pregunta.fragmento_codigo;
    dom.qCode.style.display  = 'block';
  } else {
    dom.qCode.style.display  = 'none';
  }

  const total = state.preguntas.length;
  dom.qCounter.textContent    = `${state.indice + 1} / ${total}`;
  dom.progressFill.style.width = `${(state.indice / total) * 100}%`;

  dom.feedbackBox.className = 'feedback-box';
  dom.btnNext.className     = 'btn-next';
  dom.optionsGrid.innerHTML = '';
  dom.optionsGrid.className = 'options-grid';

  if (pregunta.tipo === 'ordenar') {
    renderizarOrdenar(pregunta);
  } else {
    renderizarOpciones(pregunta);
  }

  iniciarTimer();
}

/* ════════════════════════════════════════════
   RENDERIZAR OPCIONES
════════════════════════════════════════════ */
function renderizarOpciones(pregunta) {
  const letras = ['A', 'B', 'C', 'D'];
  pregunta.opciones.forEach((opcion, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="opt-letter">${letras[i]}</span><span>${opcion.texto}</span>`;
    btn.onclick   = () => seleccionarOpcion(btn, opcion, pregunta);
    dom.optionsGrid.appendChild(btn);
  });
}

function renderizarOrdenar(pregunta) {
  dom.optionsGrid.classList.add('single-col');
  const pasos = [...pregunta.orden_correcto].sort(() => Math.random() - 0.5);
  let seleccionados = [];

  pasos.forEach((paso) => {
    const btn = document.createElement('button');
    btn.className   = 'option-btn';
    btn.dataset.paso = paso;
    btn.innerHTML   = `
      <span class="opt-letter">·</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:0.9rem">${paso}</span>
    `;
    btn.onclick = () => {
      if (state.respondida) return;
      const idx = seleccionados.indexOf(paso);
      if (idx === -1) {
        seleccionados.push(paso);
        btn.querySelector('.opt-letter').textContent = seleccionados.length;
        btn.style.borderColor = 'var(--purple-core)';
        btn.style.background  = 'rgba(124,58,237,0.2)';
      } else {
        seleccionados.splice(idx, 1);
        btn.querySelector('.opt-letter').textContent = '·';
        btn.style.borderColor = '';
        btn.style.background  = '';
        dom.optionsGrid.querySelectorAll('.option-btn').forEach(b => {
          if (seleccionados.includes(b.dataset.paso))
            b.querySelector('.opt-letter').textContent = seleccionados.indexOf(b.dataset.paso) + 1;
        });
      }

      if (seleccionados.length === pregunta.orden_correcto.length) {
        const correcto = JSON.stringify(seleccionados) === JSON.stringify(pregunta.orden_correcto);
        detenerTimer();
        state.respondida = true;
        dom.optionsGrid.querySelectorAll('.option-btn').forEach(b => {
          b.disabled = true;
          const pu = seleccionados.indexOf(b.dataset.paso);
          const pc = pregunta.orden_correcto.indexOf(b.dataset.paso);
          b.classList.add(pu === pc ? 'correct' : 'wrong');
        });
        mostrarFeedback(
          correcto,
          correcto ? pregunta.feedback_correcto : pregunta.feedback_incorrecto,
          correcto ? pregunta.puntos : 0,
          pregunta
        );
      }
    };
    dom.optionsGrid.appendChild(btn);
  });
}

/* ════════════════════════════════════════════
   SELECCIONAR OPCIÓN
════════════════════════════════════════════ */
function seleccionarOpcion(btnSeleccionado, opcionSeleccionada, pregunta) {
  if (state.respondida) return;
  state.respondida = true;
  detenerTimer();

  const esCorrecto    = opcionSeleccionada.es_correcta;
  const puntosGanados = esCorrecto ? pregunta.puntos : 0;

  dom.optionsGrid.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    const texto  = btn.querySelector('span:last-child').textContent;
    const opcion = pregunta.opciones.find(o => o.texto === texto);
    if (opcion?.es_correcta)          btn.classList.add('correct');
    else if (btn === btnSeleccionado) btn.classList.add('wrong');
  });

  mostrarFeedback(esCorrecto, opcionSeleccionada.feedback, puntosGanados, pregunta);
}

/* ════════════════════════════════════════════
   FEEDBACK
════════════════════════════════════════════ */
function mostrarFeedback(correcto, mensaje, puntosGanados) {
  dom.feedbackBox.textContent = (correcto ? '✓ ' : '✗ ') + mensaje;
  dom.feedbackBox.className   = `feedback-box show ${correcto ? 'ok' : 'fail'}`;

  if (correcto) {
    state.puntos += puntosGanados;
    state.correctas++;
    dom.scoreVal.textContent = state.puntos;
    dom.scoreVal.classList.add('bump');
    setTimeout(() => dom.scoreVal.classList.remove('bump'), 400);
  }

  const esUltima = state.indice === state.preguntas.length - 1;
  dom.btnNext.textContent = esUltima ? 'VER RESULTADOS →' : 'SIGUIENTE PREGUNTA →';
  dom.btnNext.classList.add('show');
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
   TEMPORIZADOR CON SVG CIRCULAR
════════════════════════════════════════════ */
function iniciarTimer() {
  state.tiempoRestante   = CONFIG.segundosPorPregunta;
  dom.timerText.textContent = state.tiempoRestante;
  
  // Reinicia SVG
  dom.timerWrapper.className = 'timer-wrapper safe';
  dom.timerProgress.style.strokeDashoffset = 0;
  
  clearInterval(state.timer);

  state.timer = setInterval(() => {
    state.tiempoRestante--;
    dom.timerText.textContent = state.tiempoRestante;

    // Calcula el progreso (0 a 1)
    const progreso = state.tiempoRestante / CONFIG.segundosPorPregunta;
    const circumferencia = 282.7; // 2*π*45
    const offset = circumferencia * (1 - progreso);
    dom.timerProgress.style.strokeDashoffset = offset;

    // Cambia estado visual según tiempo
    if      (state.tiempoRestante <= 5) {
      dom.timerWrapper.className = 'timer-wrapper danger';
    }
    else if (state.tiempoRestante <= 10) {
      dom.timerWrapper.className = 'timer-wrapper warning';
    }
    else {
      dom.timerWrapper.className = 'timer-wrapper safe';
    }

    if (state.tiempoRestante <= 0) {
      detenerTimer();
      if (!state.respondida) {
        state.respondida = true;
        const pregunta = state.preguntas[state.indice];
        dom.optionsGrid.querySelectorAll('.option-btn').forEach(btn => {
          btn.disabled = true;
          const texto  = btn.querySelector('span:last-child')?.textContent;
          const opcion = pregunta?.opciones?.find(o => o.texto === texto);
          if (opcion?.es_correcta) btn.classList.add('correct');
        });
        dom.feedbackBox.textContent = '⏱ ¡Tiempo agotado! Sin puntos esta ronda.';
        dom.feedbackBox.className   = 'feedback-box show fail';
        const esUltima = state.indice === state.preguntas.length - 1;
        dom.btnNext.textContent = esUltima ? 'VER RESULTADOS →' : 'SIGUIENTE PREGUNTA →';
        dom.btnNext.classList.add('show');
      }
    }
  }, 1000);
}

function detenerTimer() { clearInterval(state.timer); }

/* ════════════════════════════════════════════
   PANTALLA DE RESULTADOS
════════════════════════════════════════════ */
async function mostrarResultados() {
  detenerTimer();
  dom.progressFill.style.width  = '100%';
  dom.questionCard.style.display = 'none';
  dom.hud.style.display          = 'none';
  dom.progressWrap.style.display = 'none';
  dom.resultsScreen.classList.add('show');

  const puntajeMax = state.preguntas.reduce((acc, p) => acc + p.puntos, 0);
  const porcentaje = Math.round((state.puntos / puntajeMax) * 100);
  const total      = state.preguntas.length;

  let trofeo, titulo, mensaje;
  if      (porcentaje >= 90) { trofeo = '🏆'; titulo = '¡Maestro del Git!';      mensaje = 'Dominas Git como un profesional. ¡Impresionante!'; }
  else if (porcentaje >= 70) { trofeo = '⭐'; titulo = '¡Muy Buen Trabajo!';     mensaje = 'Tienes una base sólida. ¡Sigue así!'; }
  else if (porcentaje >= 50) { trofeo = '📈'; titulo = '¡Buen Intento!';         mensaje = 'Vas por buen camino. Repasa los conceptos.'; }
  else                       { trofeo = '💪'; titulo = '¡Sigue Practicando!';    mensaje = 'Git tiene muchos conceptos. ¡Vuelve a intentarlo!'; }

  document.getElementById('result-trophy').textContent  = trofeo;
  document.getElementById('result-title').textContent   = titulo;
  document.getElementById('result-score').innerHTML     = `${state.puntos} <span>/ ${puntajeMax} pts</span>`;
  document.getElementById('result-message').textContent = mensaje;
  document.getElementById('result-stats').innerHTML     = `
    <div class="badge"><strong>${state.correctas}</strong> / ${total} correctas</div>
    <div class="badge"><strong>${porcentaje}%</strong> precisión</div>
    <div class="badge">NIVEL <strong>${state.nivelActual}</strong></div>
  `;

  /* ── Botón "Siguiente nivel" ── */
  const siguienteNivel  = state.nivelActual + 1;
  const hayMasNiveles   = siguienteNivel <= CONFIG.totalNiveles;
  const btnSiguiente    = document.getElementById('btn-siguiente-nivel');

  let existeSiguiente = false;
  if (hayMasNiveles) {
    try {
      const check = await fetch(`${CONFIG.rutaBase}${siguienteNivel}.json`, { method: 'HEAD' });
      existeSiguiente = check.ok;
    } catch { existeSiguiente = false; }
  }

  if (existeSiguiente) {
    btnSiguiente.textContent = `⚔️  NIVEL ${siguienteNivel} →`;
    btnSiguiente.disabled    = false;
    btnSiguiente.onclick     = () => {
      window.location.href = `game.html?nivel=${siguienteNivel}`;
    };
  } else if (hayMasNiveles) {
    btnSiguiente.innerHTML   = `NIVEL ${siguienteNivel} — <em>Próximamente</em>`;
    btnSiguiente.disabled    = true;
    btnSiguiente.style.opacity = '0.4';
  } else {
    btnSiguiente.textContent = '🎉 ¡Completaste todos los niveles!';
    btnSiguiente.disabled    = true;
    btnSiguiente.style.opacity = '0.5';
  }
}

/* ── Arranque ── */
iniciarJuego();