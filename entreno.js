/* Macros Lobo — Entreno: el ejercicio de cada día de la semana, lo que suma y el objetivo de ese día. */
(function () {
  'use strict';
  var A = window.App;
  var C = window.Calc;
  var D = window.Datos;
  var ACT = window.Actividades;
  function $(id) { return document.getElementById(id); }
  var esc = A.esc;
  var CORTO = A.DIAS_INFO.corto;
  var LARGO = A.DIAS_INFO.largo;
  var HOY = A.DIAS_INFO.hoy;

  // Intensidad para actividades que no están en el catálogo (MET de referencia del Compendio).
  var INTENSIDAD = [
    [3.0, 'Suave: puedes cantar'],
    [5.0, 'Moderada: puedes hablar'],
    [7.5, 'Vigorosa: hablas a medias'],
    [10.0, 'Muy intensa: no puedes hablar']
  ];

  var dia = HOY;        // día que se edita
  var destinos = {};    // días a los que se copia
  var confirmar = null; // copia pendiente de confirmar (reemplaza días con ejercicio)
  var deshacer = null;  // { tipo, pid, ... } para volver atrás

  function lista(p) {
    var e = A.entrenoDe(p);
    if (!e.dias[dia]) e.dias[dia] = [];
    return e.dias[dia];
  }

  // ---------- Render ----------
  function render() {
    var p = A.activo();
    renderPerfiles();
    $('ent-sin-perfil').hidden = !!p;
    $('ent-grid').hidden = !p;
    $('ent-semana').hidden = !p;
    if (!p) return;
    var e = A.entrenoDe(p);
    $('e-palBase').innerHTML = A.opcionesPal(e.palBase);
    renderSemana(p, e);
    renderLista(p, e);
    renderCopiar(e);
    renderGasto(p, e);
  }

  function renderPerfiles() {
    var s = A.getState();
    $('ent-perfiles').innerHTML = s.perfiles.map(function (p) {
      return '<button type="button" class="pchip" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === s.activo) + '">' +
        esc(p.nombre || 'Sin nombre') + '</button>';
    }).join('');
  }

  function detalleDe(p, x) { return A.ok(p.peso) ? C.detalleActividad(x, p.peso) : null; }
  function kcalDe(p, x) { var d = detalleDe(p, x); return d ? d.kcal : NaN; }

  function renderSemana(p, e) {
    $('ent-semana').innerHTML = D.DIAS.map(function (d) {
      var l = e.dias[d] || [];
      var kcal = A.ok(p.peso) ? C.kcalEjercicioDia(l, p.peso) : NaN;
      return '<button type="button" class="dia-chip' + (d === HOY ? ' es-hoy' : '') + '" data-dia="' + d + '" aria-pressed="' + (d === dia) + '">' +
        '<span>' + CORTO[d] + '</span><small>' +
        (l.length ? A.fmt(kcal, 0) + '<span class="ch-largo"> kcal</span>'
          : '<span class="ch-largo">descanso</span><span class="ch-corto" aria-label="descanso">—</span>') +
        '</small></button>';
    }).join('');
  }

  function renderLista(p, e) {
    var l = e.dias[dia] || [];
    var mis = misEjercicios(e);
    $('act-title').textContent = 'Ejercicio del ' + LARGO[dia] + (dia === HOY ? ' (hoy)' : '');
    $('act-lista').innerHTML = l.map(function (x) {
      var meta = x.codigo
        ? '<span class="act-meta">' + A.fmtUp(x.met, 1) + ' MET · código ' + esc(x.codigo) + '</span>'
        : '<label class="act-meta">Intensidad <select class="act-int" aria-label="Intensidad de ' + esc(x.nombre) + '">' + intensidades(x.met) + '</select></label>';
      var minutos = x.rounds
        ? '<input type="text" value="' + A.fmtIn(x.rounds.n * x.rounds.min, 1) + '" disabled aria-label="Minutos de ' + esc(x.nombre) + ' (salen de los rounds)">'
        : '<input type="text" inputmode="decimal" data-k="minutos" value="' + A.fmtIn(x.minutos, 1) + '" aria-label="Minutos de ' + esc(x.nombre) + '">';
      return '<li class="act-item" data-id="' + esc(x.id) + '">' +
        '<span class="act-nombre"><b>' + esc(x.nombre) + '</b>' + meta +
          '<input class="act-nota" type="text" data-k="nota" maxlength="80" value="' + esc(x.nota || '') + '" placeholder="Detalle (opcional): lugar, ritmo…" aria-label="Detalle de ' + esc(x.nombre) + '">' +
          (x.rounds ? '' : '<button type="button" class="link-btn act-a-rounds" data-accion="por-rounds">Hacerlo por rounds, con ejercicios en los descansos</button>') +
        '</span>' +
        '<span class="gramos">' + minutos + ' min</span>' +
        '<span class="act-kcal" data-l="kcal">' + A.fmt(kcalDe(p, x), 0) + '</span>' +
        '<button type="button" class="quitar" aria-label="Quitar ' + esc(x.nombre) + '">×</button>' +
        (x.rounds ? panelRounds(p, x, mis) : '') +
        '</li>';
    }).join('');
    $('act-vacio').hidden = l.length > 0;
    document.querySelector('.act-head').hidden = l.length === 0;
  }

  // ---------- Por rounds: el ejercicio de cada descanso ----------
  /** Los ejercicios que el perfil ya usó en algún descanso (cualquier día), para elegirlos rápido. */
  function misEjercicios(e) {
    var vistos = {};
    var out = [];
    D.DIAS.forEach(function (d) {
      (e.dias[d] || []).forEach(function (x) {
        ((x.rounds && x.rounds.ejercicios) || []).forEach(function (s) {
          if (!s) return;
          var k = s.nombre + '|' + s.met;
          if (Object.prototype.hasOwnProperty.call(vistos, k)) return;
          vistos[k] = true;
          out.push(s);
        });
      });
    });
    return out.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  }

  // value de cada opción: «u:nombre|met» para los tuyos (no cambia si la lista crece), «c:índice» para el catálogo.
  function opcionesEjercicio(s, mis) {
    var html = '<option value="">Descanso (sin ejercicio)</option>';
    if (mis.length) {
      html += '<optgroup label="Tus ejercicios">' + mis.map(function (m) {
        var sel = s && s.nombre === m.nombre && s.met === m.met;
        return '<option value="u:' + esc(m.nombre + '|' + m.met) + '"' + (sel ? ' selected' : '') + '>' + esc(m.nombre) + '</option>';
      }).join('') + '</optgroup>';
    }
    var grupo = null;
    ACT.EJERCICIOS.forEach(function (c, i) {
      if (c.grupo !== grupo) {
        html += (grupo ? '</optgroup>' : '') + '<optgroup label="' + esc(c.grupo) + '">';
        grupo = c.grupo;
      }
      html += '<option value="c:' + i + '">' + esc(c.nombre) + '</option>';
    });
    return html + '</optgroup><option value="otro">Otro ejercicio…</option>';
  }

  function filaSlot(x, i, mis) {
    var s = x.rounds.ejercicios[i] || null;
    var n = i + 1;
    return '<li class="slot" data-i="' + i + '"><span class="slot-n">' + n + '</span>' +
      '<select class="slot-ej" aria-label="Ejercicio del descanso ' + n + '">' + opcionesEjercicio(s, mis) + '</select>' +
      '<span class="gramos slot-reps"><input type="text" inputmode="numeric" maxlength="3" value="' + (s && s.reps != null ? s.reps : '') + '"' +
        (s ? '' : ' disabled') + ' placeholder="reps" aria-label="Repeticiones en el descanso ' + n + '"><span class="u-reps"> reps</span></span></li>';
  }

  function filaOtro(i) {
    var n = i + 1;
    return '<span class="slot-n">' + n + '</span><div class="slot-otro">' +
      '<input type="text" class="slot-otro-nombre" maxlength="60" placeholder="Nombre del ejercicio" aria-label="Nombre del ejercicio del descanso ' + n + '">' +
      '<select class="slot-otro-tipo" aria-label="Tipo de ejercicio">' + ACT.TIPOS_EJERCICIO.map(function (t) {
        return '<option value="' + t.codigo + '">' + esc(t.nombre) + ' (' + A.fmtUp(t.met, 1) + ' MET)</option>';
      }).join('') + '</select>' +
      '<span class="foot-actions"><button type="button" class="btn" data-accion="otro-ok">Usar</button>' +
      '<button type="button" class="link-btn" data-accion="otro-no">Cancelar</button></span></div>';
  }

  function resumenRounds(p, x) {
    var d = detalleDe(p, x);
    var r = x.rounds;
    var html = '<p class="rounds-total">' + r.n + ' rounds × ' + A.fmtUp(r.min, 1) + ' min = ' + A.fmtUp(d ? d.minPrincipal : r.n * r.min, 1) + ' min' +
      (d ? ' (' + A.fmt(d.kcalPrincipal, 0) + ' kcal)' : '') +
      (r.descanso > 0 ? ' · ' + r.n + ' descansos de ' + A.fmtUp(r.descanso, 1) + ' min, ' + (d ? d.conEjercicio : 0) + ' con ejercicio' + (d ? ' (' + A.fmt(d.kcalDescansos, 0) + ' kcal)' : '') : '') + '</p>';
    if (d && d.porEjercicio.length) {
      html += '<ul class="rounds-reps">' + d.porEjercicio.map(function (t) {
        var veces = t.descansos + (t.descansos === 1 ? ' descanso' : ' descansos');
        return '<li><span>' + esc(t.nombre) + '</span><b>' + (t.reps ? A.fmt(t.reps, 0) + ' reps' : '—') + '</b>' +
          '<small>' + veces + (t.sinReps ? ', ' + t.sinReps + ' sin anotar' : '') + '</small></li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  function panelRounds(p, x, mis) {
    var r = x.rounds;
    var slots = [];
    if (r.descanso > 0) for (var i = 0; i < r.n; i++) slots.push(filaSlot(x, i, mis));
    return '<div class="act-rounds">' +
      '<div class="rounds-cfg">' +
        '<label>Rounds <input type="text" inputmode="numeric" data-r="n" value="' + r.n + '"></label>' +
        '<label>de <input type="text" inputmode="decimal" data-r="min" value="' + A.fmtIn(r.min, 1) + '"> min</label>' +
        '<label>Descanso <input type="text" inputmode="decimal" data-r="descanso" value="' + A.fmtIn(r.descanso, 1) + '"> min</label>' +
      '</div>' +
      '<div class="rounds-slots"' + (r.descanso > 0 ? '' : ' hidden') + '>' +
        '<p class="rounds-tit">Ejercicio en cada descanso <small>y cuántas repeticiones hiciste</small></p>' +
        '<ol class="slots">' + slots.join('') + '</ol>' +
      '</div>' +
      '<div class="rounds-resumen">' + resumenRounds(p, x) + '</div>' +
      '<p class="hint">Cada descanso suma según su ejercicio: el Compendio da el gasto por minuto de cada tipo de ejercicio, no por repetición. Las reps quedan anotadas para tu seguimiento, pero no cambian las kcal.</p>' +
      '<button type="button" class="link-btn" data-accion="sin-rounds">Quitar los rounds</button>' +
      '</div>';
  }

  /** Redibuja los descansos de una actividad (cuando cambia el número de rounds) sin tocar el resto. */
  function refrescarSlots(li, x) {
    var p = A.activo();
    var mis = misEjercicios(A.entrenoDe(p));
    var cont = li.querySelector('.rounds-slots');
    var slots = [];
    if (x.rounds.descanso > 0) for (var i = 0; i < x.rounds.n; i++) slots.push(filaSlot(x, i, mis));
    li.querySelector('.slots').innerHTML = slots.join('');
    cont.hidden = !(x.rounds.descanso > 0);
  }

  function intensidades(met) {
    var ops = INTENSIDAD.slice();
    if (!ops.some(function (o) { return o[0] === met; })) ops.push([met, A.fmtUp(met, 1) + ' MET']);
    return ops.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === met ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }

  function cifra(valor, etiqueta, detalle) {
    return '<div class="cifra"><span class="cifra-v">' + valor + '</span><span class="cifra-l">' + esc(etiqueta) + '</span><span class="cifra-d">' + esc(detalle) + '</span></div>';
  }

  function renderGasto(p, e) {
    $('gasto-title').textContent = 'Lo que suma el ' + LARGO[dia];
    var l = e.dias[dia] || [];
    var minutos = l.reduce(function (s, x) { return s + C.detalleActividad(x, 0).minutos; }, 0);
    var r = C.calcPerfil(p, { palBase: e.palBase, kcalEjercicio: A.ok(p.peso) ? C.kcalEjercicioDia(l, p.peso) : NaN });
    if (!r.valido) {
      $('ent-cifras').innerHTML = '<p class="hint">Completa el perfil (peso, altura, edad) para calcular el gasto. <a href="#perfil">Ir a Perfil</a></p>';
      $('ent-modo').innerHTML = '';
      return;
    }
    $('ent-cifras').innerHTML =
      cifra(A.fmt(r.kcalEjercicio, 0), 'kcal de ejercicio', A.fmt(minutos, 0) + ' min') +
      cifra(A.fmt(r.tdee, 0), 'gasto del día', 'base ' + A.fmt(r.tdee - r.kcalEjercicio, 0) + ' + ejercicio') +
      cifra(A.fmt(r.objetivo, 0), 'objetivo del día', 'P ' + A.fmt(r.macros.prot.g, 0) + ' · G ' + A.fmt(r.macros.grasa.g, 0) + ' · C ' + A.fmt(r.macros.carbs.g, 0));

    var sem = C.calcSemanaPerfil(Object.assign({}, p, { modo: 'ejercicio' }), e);
    var semanaKcal = D.DIAS.reduce(function (s, d) { return s + C.kcalEjercicioDia(e.dias[d] || [], p.peso); }, 0);
    var resumen = 'En la semana: ' + A.fmt(semanaKcal, 0) + ' kcal de ejercicio' +
      (sem.promedio ? '; objetivo promedio ' + A.fmt(sem.promedio.objetivo, 0) + ' kcal' : '') + '.';
    if (p.modo === 'ejercicio') {
      $('ent-modo').innerHTML = '<div class="comparar"><p class="preview-ok">Tu objetivo se calcula día por día con este ejercicio: Perfil, Día y Semana usan el de cada día.</p><p>' + esc(resumen) + '</p></div>';
    } else {
      var rf = C.calcPerfil(p);
      $('ent-modo').innerHTML = '<div class="comparar">' +
        '<p>Tu perfil usa un factor fijo' + (rf.valido ? ' (×' + A.fmtUp(p.factor, 3) + ', objetivo ' + A.fmt(rf.objetivo, 0) + ' kcal todos los días)' : '') + '. ' +
        'Con tu ejercicio, el ' + LARGO[dia] + ' sería de <b>' + A.fmt(r.objetivo, 0) + ' kcal</b>. ' + esc(resumen) + '</p>' +
        '<button type="button" class="btn btn-primary" id="btn-modo-ejercicio">Calcular mi objetivo día por día</button></div>';
    }
  }

  // ---------- Elegir día ----------
  $('ent-semana').addEventListener('click', function (ev) {
    var b = ev.target.closest('.dia-chip');
    if (!b) return;
    dia = b.dataset.dia;
    destinos = {};
    confirmar = null;
    A.limpiarAviso();
    render();
  });

  // ---------- Agregar ----------
  A.buscador($('act-buscar'), $('act-sug'), null, function (o) {
    var p = A.activo();
    if (!p) return;
    var x = o.tipo === 'propia'
      ? { id: D.nuevoId(), nombre: o.texto.slice(0, 80), codigo: '', met: 5.0, minutos: 30, nota: '' }
      : { id: D.nuevoId(), nombre: o.nombre, codigo: o.id, met: o.met, minutos: 30, nota: '' };
    lista(p).push(x);
    A.persist();
    A.limpiarAviso();
    render();
    var campo = $('act-lista').querySelector('[data-id="' + x.id + '"] input[data-k="minutos"]');
    if (campo) { campo.focus(); campo.select(); }
  }, {
    filtrar: function (q) {
      return ACT.buscar(q, 7).map(function (c) {
        return { id: c.codigo, tipo: 'catalogo', nombre: c.nombre, met: c.met, etiqueta: c.grupo, detalle: A.fmtUp(c.met, 1) + ' MET · código ' + c.codigo };
      });
    },
    alFinal: function (q) {
      return q ? { id: 'propia', tipo: 'propia', texto: q, nombre: 'Agregar «' + q + '» como actividad propia', detalle: 'Eliges su intensidad en la lista' } : null;
    }
  });

  // ---------- Editar, quitar ----------
  function actividadDe(li) {
    var p = A.activo();
    return lista(p).find(function (a) { return a.id === li.dataset.id; });
  }
  /** Tras editar una fila: actualiza su kcal, los días y el resultado sin redibujar la lista (no pierde el foco). */
  function refrescarParcial(li, x) {
    var p = A.activo();
    var e = A.entrenoDe(p);
    li.querySelector('.act-kcal').textContent = A.fmt(kcalDe(p, x), 0);
    if (x.rounds) {
      li.querySelector('.rounds-resumen').innerHTML = resumenRounds(p, x);
      li.querySelector('.gramos input').value = A.fmtIn(x.rounds.n * x.rounds.min, 1);
    }
    renderSemana(p, e);
    renderGasto(p, e);
  }

  function invalido(campo, malo) {
    if (malo) campo.setAttribute('aria-invalid', 'true'); else campo.removeAttribute('aria-invalid');
    return malo;
  }

  $('act-lista').addEventListener('input', function (ev) {
    var t = ev.target;
    var li = t.closest('.act-item');
    if (!li) return;
    var x = actividadDe(li);
    if (!x) return;
    var k = t.dataset.k;
    var v;
    if (k === 'nota') {
      x.nota = t.value.trim().slice(0, 80);
      A.persist();
      return;
    }
    if (k) {
      var lim = D.LIMITES_ACT[k];
      v = D.num(t.value);
      if (invalido(t, !isFinite(v) || v < lim[0] || v > lim[1])) return;
      x[k] = v;
      A.persist();
      refrescarParcial(li, x);
      return;
    }
    if (t.dataset.r && x.rounds) {
      var r = t.dataset.r;
      var limR = D.LIMITES_ROUNDS[r];
      v = D.num(t.value);
      if (invalido(t, !isFinite(v) || v < limR[0] || v > limR[1] || (r === 'n' && Math.round(v) !== v))) return;
      var antes = x.rounds.n > 0 && x.rounds.descanso > 0;
      x.rounds[r] = v;
      x.minutos = x.rounds.n * x.rounds.min;
      A.persist();
      if (r === 'n' || (r === 'descanso' && antes !== (v > 0))) refrescarSlots(li, x);
      refrescarParcial(li, x);
      return;
    }
    if (t.closest('.slot-reps') && x.rounds) {
      var i = +t.closest('.slot').dataset.i;
      var s = x.rounds.ejercicios[i];
      if (!s) return;
      var txt = t.value.trim();
      v = txt === '' ? null : D.num(txt);
      if (invalido(t, v !== null && (!isFinite(v) || v < 0 || v > D.MAX_REPS || Math.round(v) !== v))) return;
      s.reps = v;
      A.persist();
      refrescarParcial(li, x);
    }
  });

  /** Pone un ejercicio en el descanso i (o lo deja sin ejercicio con null). Conserva las reps anotadas. */
  function ponerEnDescanso(x, i, ej) {
    var lista = x.rounds.ejercicios;
    while (lista.length <= i) lista.push(null);
    var reps = lista[i] ? lista[i].reps : null;
    lista[i] = ej ? { nombre: ej.nombre, codigo: ej.codigo || '', met: ej.met, reps: reps } : null;
  }

  $('act-lista').addEventListener('change', function (ev) {
    var t = ev.target;
    var li = t.closest('.act-item');
    var x = li && actividadDe(li);
    if (!x) return;
    if (t.classList.contains('act-int')) {
      x.met = parseFloat(t.value);
      A.persist();
      refrescarParcial(li, x);
      return;
    }
    if (t.dataset.r === 'n' && x.rounds && x.rounds.ejercicios.length > x.rounds.n) {
      // Al confirmar menos rounds, los descansos que sobran se quitan.
      x.rounds.ejercicios = x.rounds.ejercicios.slice(0, x.rounds.n);
      A.persist();
      return;
    }
    if (t.classList.contains('slot-ej') && x.rounds) {
      var fila = t.closest('.slot');
      var i = +fila.dataset.i;
      if (t.value === 'otro') {
        fila.classList.add('es-otro');
        fila.innerHTML = filaOtro(i);
        fila.querySelector('.slot-otro-nombre').focus();
        return;
      }
      var e = A.entrenoDe(A.activo());
      var ej = t.value === '' ? null
        : t.value.charAt(0) === 'u' ? misEjercicios(e).find(function (m) { return m.nombre + '|' + m.met === t.value.slice(2); })
          : ACT.EJERCICIOS[+t.value.slice(2)];
      ponerEnDescanso(x, i, ej || null);
      A.persist();
      refrescarSlots(li, x);
      refrescarParcial(li, x);
      var sig = li.querySelector('.slot[data-i="' + i + '"] ' + (ej ? '.slot-reps input' : '.slot-ej'));
      if (sig) sig.focus();
    }
  });

  function usarOtro(li, x, fila) {
    var nombre = fila.querySelector('.slot-otro-nombre').value.trim().slice(0, 60);
    if (!nombre) { fila.querySelector('.slot-otro-nombre').focus(); return; }
    var tipo = ACT.TIPOS_EJERCICIO.find(function (t) { return t.codigo === fila.querySelector('.slot-otro-tipo').value; });
    var i = +fila.dataset.i;
    ponerEnDescanso(x, i, { nombre: nombre, codigo: tipo.codigo, met: tipo.met });
    A.persist();
    refrescarSlots(li, x);
    refrescarParcial(li, x);
    var campo = li.querySelector('.slot[data-i="' + i + '"] .slot-reps input');
    if (campo) campo.focus();
  }

  $('act-lista').addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || !ev.target.classList.contains('slot-otro-nombre')) return;
    ev.preventDefault();
    var li = ev.target.closest('.act-item');
    var x = actividadDe(li);
    if (x && x.rounds) usarOtro(li, x, ev.target.closest('.slot'));
  });

  $('act-lista').addEventListener('click', function (ev) {
    var acc = ev.target.closest('[data-accion]');
    if (acc) {
      var li = acc.closest('.act-item');
      var x = actividadDe(li);
      if (!x) return;
      var p = A.activo();
      var accion = acc.dataset.accion;
      if (accion === 'por-rounds') {
        // Rounds de unos 3 min que den los mismos minutos si se puede (5 min → 2 de 2,5; 33 → 11 de 3).
        var n = Math.max(1, Math.min(D.LIMITES_ROUNDS.n[1], Math.round(x.minutos / 3) || 1));
        var min = x.minutos / n;
        if (min % 0.5 !== 0 || min < D.LIMITES_ROUNDS.min[0] || min > D.LIMITES_ROUNDS.min[1]) min = 3;
        x.rounds = { n: n, min: min, descanso: 1, ejercicios: [] };
        x.minutos = n * min;
        A.persist();
        render();
        var campo = $('act-lista').querySelector('[data-id="' + x.id + '"] [data-r="n"]');
        if (campo) { campo.focus(); campo.select(); }
      } else if (accion === 'sin-rounds') {
        deshacer = { tipo: 'semana', pid: p.id, dias: JSON.parse(JSON.stringify(A.entrenoDe(p).dias)) };
        delete x.rounds;
        A.persist();
        render();
        avisoDeshacer('«' + x.nombre + '» ya no va por rounds: quedan sus ' + A.fmtUp(x.minutos, 1) + ' min, sin los descansos.');
      } else if (accion === 'otro-ok' && x.rounds) {
        usarOtro(li, x, acc.closest('.slot'));
      } else if (accion === 'otro-no' && x.rounds) {
        refrescarSlots(li, x);
      }
      return;
    }
    var b = ev.target.closest('.quitar');
    if (!b) return;
    var p = A.activo();
    var l = lista(p);
    var idx = l.findIndex(function (a) { return a.id === b.closest('.act-item').dataset.id; });
    if (idx < 0) return;
    var x = l.splice(idx, 1)[0];
    deshacer = { tipo: 'actividad', pid: p.id, dia: dia, act: x, index: idx };
    A.persist();
    render();
    avisoDeshacer('Quitado «' + x.nombre + '» del ' + LARGO[dia] + '.');
  });

  function avisoDeshacer(texto) {
    var caja = $('ent-status');
    caja.className = 'bar-status is-ok';
    caja.innerHTML = '<span>' + esc(texto) + ' <button type="button" class="link-btn" id="btn-ent-deshacer">Deshacer</button></span>';
  }

  // ---------- Copiar el día ----------
  function renderCopiar(e) {
    $('ent-destinos').innerHTML = D.DIAS.map(function (d) {
      var es = d === dia;
      return '<button type="button" class="dia-toggle" data-dia="' + d + '" aria-pressed="' + (!es && !!destinos[d]) + '"' + (es ? ' disabled' : '') + '>' + CORTO[d] + '</button>';
    }).join('');
    var pie = $('ent-copiar-pie');
    if (confirmar) {
      var cuales = confirmar.reemplazados.map(function (d) { return LARGO[d] + ' (' + (e.dias[d] || []).length + ')'; }).join(', ');
      var vacio = !(e.dias[dia] || []).length;
      pie.innerHTML = '<p class="hint is-off">' + (vacio ? 'El ' + LARGO[dia] + ' no tiene ejercicio: estos días quedarán de descanso: ' : 'Se reemplazará el ejercicio que ya tienen: ') + esc(cuales) + '.</p>' +
        '<span class="foot-actions"><button type="button" class="btn btn-danger" id="btn-ent-copiar-ok">Sí, reemplazar</button>' +
        '<button type="button" class="btn" id="btn-ent-copiar-no">Cancelar</button></span>';
    } else {
      var hay = D.DIAS.some(function (d) { return d !== dia && destinos[d]; });
      pie.innerHTML = '<button type="button" class="btn" id="btn-ent-copiar"' + (hay ? '' : ' disabled') + '>Copiar el ' + LARGO[dia] + '</button>';
    }
  }

  function aplicarCopia(p, res) {
    var e = A.entrenoDe(p);
    deshacer = { tipo: 'semana', pid: p.id, dias: JSON.parse(JSON.stringify(e.dias)) };
    var cuales = D.DIAS.filter(function (d) { return d !== dia && destinos[d]; });
    e.dias = res.semana;
    confirmar = null;
    destinos = {};
    A.persist();
    render();
    avisoDeshacer('Copiado el ejercicio del ' + LARGO[dia] + ' a ' + cuales.map(function (d) { return LARGO[d]; }).join(', ') + '.');
  }

  $('ent-destinos').addEventListener('click', function (ev) {
    var b = ev.target.closest('.dia-toggle');
    if (!b || b.disabled) return;
    destinos[b.dataset.dia] = !destinos[b.dataset.dia];
    confirmar = null;
    renderCopiar(A.entrenoDe(A.activo()));
  });
  $('ent-presets').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-sel]');
    if (!b) return;
    var sel = b.dataset.sel === 'lab' ? ['lun', 'mar', 'mie', 'jue', 'vie'] : b.dataset.sel === 'todos' ? D.DIAS : [];
    destinos = {};
    sel.forEach(function (d) { if (d !== dia) destinos[d] = true; });
    confirmar = null;
    renderCopiar(A.entrenoDe(A.activo()));
  });
  $('ent-copiar-pie').addEventListener('click', function (ev) {
    var p = A.activo();
    if (!p) return;
    var e = A.entrenoDe(p);
    if (ev.target.id === 'btn-ent-copiar') {
      var res = D.copiarDia(e.dias, dia, Object.keys(destinos).filter(function (d) { return destinos[d]; }));
      if (res.error) { A.avisar('bad', res.error); return; }
      if (res.reemplazados.length) { confirmar = res; renderCopiar(e); $('btn-ent-copiar-no').focus(); return; }
      aplicarCopia(p, res);
    } else if (ev.target.id === 'btn-ent-copiar-ok' && confirmar) {
      aplicarCopia(p, confirmar);
    } else if (ev.target.id === 'btn-ent-copiar-no') {
      confirmar = null;
      renderCopiar(e);
    }
  });

  // ---------- Resto del día, modo del perfil ----------
  $('e-palBase').addEventListener('change', function () {
    var p = A.activo();
    A.entrenoDe(p).palBase = parseFloat($('e-palBase').value);
    A.persist();
    render();
  });

  $('ent-modo').addEventListener('click', function (ev) {
    if (ev.target.id !== 'btn-modo-ejercicio') return;
    var p = A.activo();
    deshacer = { tipo: 'perfil', pid: p.id, antes: A.cambiarPerfil(p.id, { modo: 'ejercicio' }) };
    render();
    avisoDeshacer('El perfil «' + p.nombre + '» ahora calcula su objetivo día por día con este ejercicio.');
  });

  $('ent-status').addEventListener('click', function (ev) {
    if (ev.target.id !== 'btn-ent-deshacer' || !deshacer) return;
    var s = A.getState();
    if (deshacer.tipo === 'perfil') {
      A.cambiarPerfil(deshacer.pid, deshacer.antes);
    } else if (deshacer.tipo === 'semana') {
      if (s.entreno[deshacer.pid]) s.entreno[deshacer.pid].dias = deshacer.dias;
      A.persist();
    } else {
      var e = s.entreno[deshacer.pid];
      if (e) {
        if (!e.dias[deshacer.dia]) e.dias[deshacer.dia] = [];
        e.dias[deshacer.dia].splice(Math.min(deshacer.index, e.dias[deshacer.dia].length), 0, deshacer.act);
      }
      A.persist();
    }
    deshacer = null;
    A.limpiarAviso();
    render();
  });

  // ---------- Perfil, importar, exportar ----------
  $('ent-perfiles').addEventListener('click', function (ev) {
    var b = ev.target.closest('.pchip');
    if (!b || b.dataset.id === A.getState().activo) return;
    A.setActivo(b.dataset.id);
    deshacer = null;
    destinos = {};
    confirmar = null;
    A.limpiarAviso();
    render();
  });

  $('btn-ent-import').addEventListener('click', A.pedirArchivo);
  $('btn-ent-export').addEventListener('click', function () {
    var p = A.activo();
    var s = A.getState();
    var archivo = 'ejercicio-' + (A.normal(p.nombre).replace(/[^a-z0-9]+/g, '-') || 'perfil') + '.json';
    var out = D.exportar({ entreno: s.entreno }, null, ['entreno']);
    var solo = {};
    solo[p.id] = out.entreno[p.id] || A.entrenoDe(p);
    out.entreno = solo;
    A.descargar(archivo, out).then(function (ok) {
      if (ok) A.avisar('ok', 'Ejercicio de «' + p.nombre + '» exportado en «' + archivo + '». Para importarlo, el perfil debe existir.');
    });
  });

  A.alImportar(function () { confirmar = null; render(); });
  A.alMostrar('entreno', function () { confirmar = null; render(); });
})();
