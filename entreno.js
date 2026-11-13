/* Macros Lobo — Entreno: lista de ejercicios y actividades de la semana, su gasto y el factor de actividad. */
(function () {
  'use strict';
  var A = window.App;
  var C = window.Calc;
  var D = window.Datos;
  var ACT = window.Actividades;
  function $(id) { return document.getElementById(id); }
  var esc = A.esc;

  // Cómo es el resto del día sin contar el ejercicio (FAO: un oficinista ronda 1,55).
  var PAL = [
    [1.4, 'Casi todo el día sentado, pocos pasos (≈1,40)'],
    [1.55, 'Normal: oficina o estudio, caminas algo (≈1,55)'],
    [1.7, 'De pie o caminando gran parte del día (≈1,70)']
  ];
  // Intensidad para actividades que no están en el catálogo (MET de referencia del Compendio).
  var INTENSIDAD = [
    [3.0, 'Suave: puedes cantar'],
    [5.0, 'Moderada: puedes hablar'],
    [7.5, 'Vigorosa: hablas a medias'],
    [10.0, 'Muy intensa: no puedes hablar']
  ];

  var deshacer = null; // { tipo: 'perfil', pid, antes } o { tipo: 'actividad', pid, act, index }

  function entrenoDe(p) {
    var s = A.getState();
    if (!s.entreno[p.id] || !Array.isArray(s.entreno[p.id].actividades)) s.entreno[p.id] = D.migrarEntreno(s.entreno[p.id]);
    return s.entreno[p.id];
  }

  // ---------- Render ----------
  function render() {
    var p = A.activo();
    renderPerfiles();
    $('ent-sin-perfil').hidden = !!p;
    $('ent-grid').hidden = !p;
    if (!p) return;
    var e = entrenoDe(p);
    renderPal(e);
    renderLista(p, e);
    renderGasto(p, e);
  }

  function renderPerfiles() {
    var s = A.getState();
    $('ent-perfiles').innerHTML = s.perfiles.map(function (p) {
      return '<button type="button" class="pchip" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === s.activo) + '">' +
        esc(p.nombre || 'Sin nombre') + '</button>';
    }).join('');
  }

  function renderPal(e) {
    var ops = PAL.slice();
    if (!ops.some(function (o) { return o[0] === e.palBase; })) ops.push([e.palBase, 'Otro: ≈' + A.fmtUp(e.palBase, 2)]);
    $('e-palBase').innerHTML = ops.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === e.palBase ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }

  function kcalSemana(p, x) {
    return A.ok(p.peso) ? C.kcalActividad(x.met, p.peso, x.minutos) * x.veces : NaN;
  }

  function renderLista(p, e) {
    $('act-lista').innerHTML = e.actividades.map(function (x) {
      var meta = x.codigo
        ? '<span class="act-meta">' + A.fmtUp(x.met, 1) + ' MET · código ' + esc(x.codigo) + '</span>'
        : '<label class="act-meta">Intensidad <select class="act-int" aria-label="Intensidad de ' + esc(x.nombre) + '">' +
            intensidades(x.met) + '</select></label>';
      return '<li class="act-item" data-id="' + esc(x.id) + '">' +
        '<span class="act-nombre"><b>' + esc(x.nombre) + '</b>' + meta + '</span>' +
        '<span class="gramos"><input type="text" inputmode="decimal" data-k="minutos" value="' + A.fmtIn(x.minutos, 1) + '" aria-label="Minutos por vez de ' + esc(x.nombre) + '"> min</span>' +
        '<span class="gramos"><input type="text" inputmode="numeric" data-k="veces" value="' + A.fmtIn(x.veces, 1) + '" aria-label="Veces por semana de ' + esc(x.nombre) + '"> ×</span>' +
        '<span class="act-kcal" data-l="kcal/sem">' + A.fmt(kcalSemana(p, x), 0) + '</span>' +
        '<button type="button" class="quitar" aria-label="Quitar ' + esc(x.nombre) + '">×</button>' +
        '</li>';
    }).join('');
    $('act-vacio').hidden = e.actividades.length > 0;
    document.querySelector('.act-head').hidden = e.actividades.length === 0;
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
    var r = C.calcPerfil(p);
    if (!A.ok(p.peso) || !r.valido) {
      $('ent-cifras').innerHTML = '<p class="hint">Completa el perfil (peso, altura, edad) para calcular el gasto. <a href="#perfil">Ir a Perfil</a></p>';
      $('ent-factor').innerHTML = '';
      return;
    }
    var g = C.gastoActividades(e.actividades, p.peso, r.tmb, e.palBase);
    $('ent-cifras').innerHTML =
      cifra(A.fmt(g.kcalSemana, 0), 'kcal por semana', A.fmt(g.minutosSemana, 0) + ' min de ejercicio') +
      cifra(A.fmt(g.kcalDia, 0), 'kcal por día', 'promedio de la semana') +
      cifra('×' + A.fmtUp(g.factor, 3), 'factor de actividad', 'mantenimiento ' + A.fmt(g.tdee, 0) + ' kcal');

    var dif = g.factor - p.factor;
    var caja = '<div class="comparar">' +
      '<p>Tu perfil usa <b>×' + A.fmtUp(p.factor, 3) + '</b> (mantenimiento ' + A.fmt(r.tdee, 0) + ' kcal). ' +
      'Con este ejercicio y el resto de tu día sale <b>×' + A.fmtUp(g.factor, 3) + '</b> (' + A.fmt(g.tdee, 0) + ' kcal).</p>';
    if (Math.abs(dif) >= 0.005) {
      caja += '<button type="button" class="btn btn-primary" id="btn-usar-factor" data-factor="' + (Math.round(g.factor * 1000) / 1000) + '">Usar ×' + A.fmtUp(g.factor, 3) + ' en el perfil</button>';
    } else {
      caja += '<p class="preview-ok">Coinciden: el objetivo diario del perfil ya cuenta este ejercicio.</p>';
    }
    $('ent-factor').innerHTML = caja + '<p class="hint">Confírmalo con tu peso en la pestaña Peso.</p></div>';
  }

  /** Tras editar una fila: actualiza su kcal y el resultado sin redibujar la lista (no pierde el foco). */
  function refrescarParcial(li, p, e, x) {
    li.querySelector('.act-kcal').textContent = A.fmt(kcalSemana(p, x), 0);
    renderGasto(p, e);
  }

  // ---------- Agregar ----------
  A.buscador($('act-buscar'), $('act-sug'), null, function (o) {
    var p = A.activo();
    if (!p) return;
    var e = entrenoDe(p);
    var x = o.tipo === 'propia'
      ? { id: D.nuevoId(), nombre: o.texto.slice(0, 80), codigo: '', met: 5.0, minutos: 30, veces: 3 }
      : { id: D.nuevoId(), nombre: o.nombre, codigo: o.id, met: o.met, minutos: 30, veces: 3 };
    e.actividades.push(x);
    A.persist();
    A.limpiarAviso();
    renderLista(p, e);
    renderGasto(p, e);
    var fila = $('act-lista').querySelector('[data-id="' + x.id + '"] input[data-k="minutos"]');
    if (fila) { fila.focus(); fila.select(); }
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
  $('act-lista').addEventListener('input', function (ev) {
    var k = ev.target.dataset.k;
    var li = ev.target.closest('.act-item');
    if (!k || !li) return;
    var p = A.activo();
    var e = entrenoDe(p);
    var x = e.actividades.find(function (a) { return a.id === li.dataset.id; });
    if (!x) return;
    var lim = D.LIMITES_ACT[k];
    var v = D.num(ev.target.value);
    if (!isFinite(v) || v < lim[0] || v > lim[1]) { ev.target.setAttribute('aria-invalid', 'true'); return; }
    ev.target.removeAttribute('aria-invalid');
    x[k] = v;
    A.persist();
    refrescarParcial(li, p, e, x);
  });

  $('act-lista').addEventListener('change', function (ev) {
    if (!ev.target.classList.contains('act-int')) return;
    var li = ev.target.closest('.act-item');
    var p = A.activo();
    var e = entrenoDe(p);
    var x = e.actividades.find(function (a) { return a.id === li.dataset.id; });
    if (!x) return;
    x.met = parseFloat(ev.target.value);
    A.persist();
    refrescarParcial(li, p, e, x);
  });

  $('act-lista').addEventListener('click', function (ev) {
    var b = ev.target.closest('.quitar');
    if (!b) return;
    var p = A.activo();
    var e = entrenoDe(p);
    var idx = e.actividades.findIndex(function (a) { return a.id === b.closest('.act-item').dataset.id; });
    if (idx < 0) return;
    var x = e.actividades.splice(idx, 1)[0];
    deshacer = { tipo: 'actividad', pid: p.id, act: x, index: idx };
    A.persist();
    render();
    var caja = $('ent-status');
    caja.className = 'bar-status is-ok';
    caja.innerHTML = '<span>Quitado «' + esc(x.nombre) + '». <button type="button" class="link-btn" id="btn-ent-deshacer">Deshacer</button></span>';
  });

  $('e-palBase').addEventListener('change', function () {
    var p = A.activo();
    var e = entrenoDe(p);
    e.palBase = parseFloat($('e-palBase').value);
    A.persist();
    renderGasto(p, e);
  });

  // ---------- Usar el factor en el perfil ----------
  $('ent-factor').addEventListener('click', function (ev) {
    if (ev.target.id !== 'btn-usar-factor') return;
    var p = A.activo();
    var nuevo = parseFloat(ev.target.dataset.factor);
    deshacer = { tipo: 'perfil', pid: p.id, antes: A.cambiarPerfil(p.id, { factor: nuevo }) };
    render();
    var caja = $('ent-status');
    caja.className = 'bar-status is-ok';
    caja.innerHTML = '<span>El perfil «' + esc(p.nombre) + '» ahora usa ×' + A.fmtUp(nuevo, 3) + ': su objetivo diario ya cuenta este ejercicio. ' +
      '<button type="button" class="link-btn" id="btn-ent-deshacer">Deshacer</button></span>';
  });

  $('ent-status').addEventListener('click', function (ev) {
    if (ev.target.id !== 'btn-ent-deshacer' || !deshacer) return;
    if (deshacer.tipo === 'perfil') {
      A.cambiarPerfil(deshacer.pid, deshacer.antes);
    } else {
      var s = A.getState();
      var e = s.entreno[deshacer.pid];
      if (e) e.actividades.splice(Math.min(deshacer.index, e.actividades.length), 0, deshacer.act);
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
    solo[p.id] = out.entreno[p.id] || { palBase: D.PAL_BASE, actividades: [] };
    out.entreno = solo;
    A.descargar(archivo, out).then(function (ok) {
      if (ok) A.avisar('ok', 'Ejercicio de «' + p.nombre + '» exportado en «' + archivo + '». Para importarlo, el perfil debe existir.');
    });
  });

  A.alImportar(render);
  A.alMostrar('entreno', render);
})();
