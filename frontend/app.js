
/* ── Estado global del juego ── */
const state = {
  preguntas:    [],   // Array de preguntas del JSON
  indice:       0,    // Pregunta actual
  puntos:       0,    // Puntos acumulados
  correctas:    0,    // Respuestas correctas
  timer:        null, // Referencia al intervalo del timer
  tiempoRestante: 20, // Segundos por pregunta
  respondida:   false // Evita doble click
};

/* ── Referencias al DOM ── */
const dom = {
  qType:        document.getElementById('q-type'),
  qText:        document.getElementById('q-text'),
  qCode:        document.getElementById('q-code'),
  optionsGrid:  document.getElementById('options-grid'),
  feedbackBox:  document.getElementById('feedback-box'),
  btnNext:      document.getElementById('btn-next'),
  scoreVal:     document.getElementById('score-val'),
  timerText:    document.getElementById('timer-text'),
  timerCircle:  document.getElementById('timer-circle'),
  qCounter:     document.getElementById('q-counter'),
  progressFill: document.getElementById('progress-fill'),
  questionCard: document.getElementById('question-card'),
  resultsScreen:document.getElementById('results-screen'),
  hud:          document.getElementById('hud'),
  progressWrap: document.getElementById('progress-wrap'),
};

/* ── Etiquetas legibles para cada tipo ── */
const TIPO_LABELS = {
  opcion_multiple: '⬡  Opción múltiple',
  completar:       '✦  Completar el código',
  verdadero_falso: '◈  Verdadero / Falso',
  ordenar:         '⟳  Ordenar pasos',
  encuentra_error: '⚠  Encuentra el error',
};

/* ════════════════════════════════════════════
   INICIO — carga el JSON y arranca el juego
════════════════════════════════════════════ */
async function iniciarJuego() {
  try {
    // Fetch al backend (ruta relativa funciona si sirves con Live Server o similar)
    const res = await fetch('../backend/data/nivel1.json');
    if (!res.ok) throw new Error('No se pudo cargar nivel1.json');

    const data = await res.json();
    state.preguntas = data.preguntas;

    mostrarPregunta();
  } catch (err) {
    console.error('Error al cargar preguntas:', err);
    dom.qText.textContent = '❌ Error cargando preguntas. Asegúrate de usar Live Server.';
    dom.qType.textContent = 'ERROR';
  }
}

/* ════════════════════════════════════════════
   MOSTRAR PREGUNTA
════════════════════════════════════════════ */
function mostrarPregunta() {
  const pregunta = state.preguntas[state.indice];
  state.respondida = false;

  // Reinicia animación de la tarjeta
  dom.questionCard.style.animation = 'none';
  dom.questionCard.offsetHeight; // reflow
  dom.questionCard.style.animation = 'scaleIn 0.4s cubic-bezier(.16,1,.3,1) both';

  // Tipo de pregunta
  dom.qType.textContent = TIPO_LABELS[pregunta.tipo] || pregunta.tipo;

  // Enunciado
  dom.qText.textContent = pregunta.enunciado;

  // Fragmento de código (solo si existe)
  if (pregunta.fragmento_codigo) {
    dom.qCode.textContent = pregunta.fragmento_codigo;
    dom.qCode.style.display = 'block';
  } else {
    dom.qCode.style.display = 'none';
  }

  // Contador y progreso
  const total = state.preguntas.length;
  dom.qCounter.textContent = `${state.indice + 1} / ${total}`;
  dom.progressFill.style.width = `${(state.indice / total) * 100}%`;

  // Oculta feedback y botón siguiente
  dom.feedbackBox.className = 'feedback-box';
  dom.btnNext.className = 'btn-next';

  // Renderiza opciones según el tipo
  dom.optionsGrid.innerHTML = '';
  dom.optionsGrid.className = 'options-grid';

  if (pregunta.tipo === 'ordenar') {
    renderizarOrdenar(pregunta);
  } else {
    renderizarOpciones(pregunta);
  }

  // Arranca el timer
  iniciarTimer();
}

/* ════════════════════════════════════════════
   RENDERIZAR — Opciones estándar
   (opcion_multiple, completar, verdadero_falso, encuentra_error)
════════════════════════════════════════════ */
function renderizarOpciones(pregunta) {
  const letras = ['A', 'B', 'C', 'D'];

  pregunta.opciones.forEach((opcion, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `
      <span class="opt-letter">${letras[i]}</span>
      <span>${opcion.texto}</span>
    `;
    btn.onclick = () => seleccionarOpcion(btn, opcion, pregunta);
    dom.optionsGrid.appendChild(btn);
  });
}

/* ════════════════════════════════════════════
   RENDERIZAR — Preguntas de ordenar
   (drag simplificado: botones de orden)
════════════════════════════════════════════ */
function renderizarOrdenar(pregunta) {
  dom.optionsGrid.classList.add('single-col');

  // Mezcla los pasos
  const pasos = [...pregunta.orden_correcto].sort(() => Math.random() - 0.5);
  let seleccionados = [];

  pasos.forEach((paso, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.dataset.paso = paso;
    btn.innerHTML = `
      <span class="opt-letter" id="order-num-${i}">·</span>
      <span style="font-family:'JetBrains Mono',monospace;font-size:0.9rem">${paso}</span>
    `;
    btn.onclick = () => {
      if (state.respondida) return;

      // Alternar selección de orden
      const idx = seleccionados.indexOf(paso);
      if (idx === -1) {
        seleccionados.push(paso);
        btn.querySelector('.opt-letter').textContent = seleccionados.length;
        btn.style.borderColor = 'var(--purple-core)';
        btn.style.background = 'rgba(124,58,237,0.2)';
      } else {
        seleccionados.splice(idx, 1);
        btn.querySelector('.opt-letter').textContent = '·';
        btn.style.borderColor = '';
        btn.style.background = '';
        // Recalcula números
        const todos = dom.optionsGrid.querySelectorAll('.option-btn');
        let n = 1;
        todos.forEach(b => {
          const p = b.dataset.paso;
          if (seleccionados.includes(p)) {
            b.querySelector('.opt-letter').textContent = seleccionados.indexOf(p) + 1;
          }
        });
      }

      // Cuando seleccionó todos los pasos, valida
      if (seleccionados.length === pregunta.orden_correcto.length) {
        const correcto = JSON.stringify(seleccionados) === JSON.stringify(pregunta.orden_correcto);
        detenerTimer();
        state.respondida = true;

        // Colorea botones
        const todos = dom.optionsGrid.querySelectorAll('.option-btn');
        todos.forEach(b => {
          b.disabled = true;
          const posUsuario = seleccionados.indexOf(b.dataset.paso);
          const posCorrecta = pregunta.orden_correcto.indexOf(b.dataset.paso);
          if (posUsuario === posCorrecta) {
            b.classList.add('correct');
          } else {
            b.classList.add('wrong');
          }
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
   SELECCIONAR OPCIÓN (respuesta)
════════════════════════════════════════════ */
function seleccionarOpcion(btnSeleccionado, opcionSeleccionada, pregunta) {
  if (state.respondida) return;
  state.respondida = true;
  detenerTimer();

  const esCorrecto = opcionSeleccionada.es_correcta;
  const puntosGanados = esCorrecto ? pregunta.puntos : 0;

  // Colorea opciones
  const botonesOpc = dom.optionsGrid.querySelectorAll('.option-btn');
  botonesOpc.forEach(btn => {
    btn.disabled = true;
    // Encuentra la opción que corresponde a este botón por texto
    const textoBTN = btn.querySelector('span:last-child').textContent;
    const opcionBTN = pregunta.opciones.find(o => o.texto === textoBTN);
    if (opcionBTN?.es_correcta) {
      btn.classList.add('correct');
    } else if (btn === btnSeleccionado && !esCorrecto) {
      btn.classList.add('wrong');
    }
  });

  mostrarFeedback(esCorrecto, opcionSeleccionada.feedback, puntosGanados, pregunta);
}

/* ════════════════════════════════════════════
   MOSTRAR FEEDBACK y actualizar puntos
════════════════════════════════════════════ */
function mostrarFeedback(correcto, mensaje, puntosGanados, pregunta) {
  // Feedback box
  dom.feedbackBox.textContent = (correcto ? '✓ ' : '✗ ') + mensaje;
  dom.feedbackBox.className = `feedback-box show ${correcto ? 'ok' : 'fail'}`;

  // Actualiza puntos
  if (correcto) {
    state.puntos += puntosGanados;
    state.correctas++;
    // Animación bump en el score
    dom.scoreVal.textContent = state.puntos;
    dom.scoreVal.classList.add('bump');
    setTimeout(() => dom.scoreVal.classList.remove('bump'), 400);
  }

  // Muestra botón siguiente
  const esUltima = state.indice === state.preguntas.length - 1;
  dom.btnNext.textContent = esUltima ? 'VER RESULTADOS →' : 'SIGUIENTE PREGUNTA →';
  dom.btnNext.classList.add('show');
}

/* ════════════════════════════════════════════
   SIGUIENTE PREGUNTA
════════════════════════════════════════════ */
function nextQuestion() {
  state.indice++;

  if (state.indice >= state.preguntas.length) {
    mostrarResultados();
  } else {
    mostrarPregunta();
  }
}

/* ════════════════════════════════════════════
   TEMPORIZADOR
════════════════════════════════════════════ */
function iniciarTimer() {
  state.tiempoRestante = 20;
  dom.timerText.textContent = state.tiempoRestante;
  dom.timerCircle.className = 'timer-circle';

  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.tiempoRestante--;
    dom.timerText.textContent = state.tiempoRestante;

    // Colores de alerta
    if (state.tiempoRestante <= 5) {
      dom.timerCircle.className = 'timer-circle danger';
    } else if (state.tiempoRestante <= 10) {
      dom.timerCircle.className = 'timer-circle warning';
    }

    // Tiempo agotado
    if (state.tiempoRestante <= 0) {
      detenerTimer();
      if (!state.respondida) {
        state.respondida = true;
        // Deshabilita botones y muestra feedback de tiempo
        dom.optionsGrid.querySelectorAll('.option-btn').forEach(btn => {
          btn.disabled = true;
          // Revela la correcta
          const textoBTN = btn.querySelector('span:last-child')?.textContent;
          const pregunta = state.preguntas[state.indice];
          if (pregunta?.opciones) {
            const op = pregunta.opciones.find(o => o.texto === textoBTN);
            if (op?.es_correcta) btn.classList.add('correct');
          }
        });
        dom.feedbackBox.textContent = '⏱ ¡Tiempo agotado! Sin puntos esta ronda.';
        dom.feedbackBox.className = 'feedback-box show fail';
        const esUltima = state.indice === state.preguntas.length - 1;
        dom.btnNext.textContent = esUltima ? 'VER RESULTADOS →' : 'SIGUIENTE PREGUNTA →';
        dom.btnNext.classList.add('show');
      }
    }
  }, 1000);
}

function detenerTimer() {
  clearInterval(state.timer);
}

/* ════════════════════════════════════════════
   PANTALLA DE RESULTADOS
════════════════════════════════════════════ */
function mostrarResultados() {
  detenerTimer();

  // Actualiza barra al 100%
  dom.progressFill.style.width = '100%';

  // Oculta juego, muestra resultados
  dom.questionCard.style.display = 'none';
  dom.hud.style.display = 'none';
  dom.progressWrap.style.display = 'none';
  dom.resultsScreen.classList.add('show');

  const total = state.preguntas.length;
  const puntajeMax = state.preguntas.reduce((acc, p) => acc + p.puntos, 0);
  const porcentaje = Math.round((state.puntos / puntajeMax) * 100);

  // Trofeo y título según desempeño
  let trofeo, titulo, mensaje;
  if (porcentaje >= 90) {
    trofeo = '🏆'; titulo = '¡Maestro del Git!';
    mensaje = 'Dominas Git como un profesional. ¡Impresionante!';
  } else if (porcentaje >= 70) {
    trofeo = '⭐'; titulo = '¡Muy Buen Trabajo!';
    mensaje = 'Tienes una base sólida en Git. Sigue practicando.';
  } else if (porcentaje >= 50) {
    trofeo = '📈'; titulo = '¡Buen Intento!';
    mensaje = 'Vas por buen camino. Repasa los conceptos y vuelve a intentarlo.';
  } else {
    trofeo = '💪'; titulo = '¡Sigue Practicando!';
    mensaje = 'Git tiene muchos conceptos. Estudia y vuelve a intentarlo.';
  }

  document.getElementById('result-trophy').textContent   = trofeo;
  document.getElementById('result-title').textContent    = titulo;
  document.getElementById('result-score').innerHTML      = `${state.puntos} <span>/ ${puntajeMax} pts</span>`;
  document.getElementById('result-message').textContent  = mensaje;

  // Stats
  document.getElementById('result-stats').innerHTML = `
    <div class="badge"><strong>${state.correctas}</strong> / ${total} correctas</div>
    <div class="badge"><strong>${porcentaje}%</strong> precisión</div>
  `;
}

/* ════════════════════════════════════════════
   ARRANQUE
════════════════════════════════════════════ */
iniciarJuego();