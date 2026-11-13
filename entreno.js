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

  function kcalDe(p, x) { return A.ok(p.peso) ? C.kcalActividad(x.met, p.peso, x.minutos) : NaN; }

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
    $('act-title').textContent = 'Ejercicio del ' + LARGO[dia] + (dia === HOY ? ' (hoy)' : '');
    $('act-lista').innerHTML = l.map(function (x) {
      var meta = x.codigo
        ? '<span class="act-meta">' + A.fmtUp(x.met, 1) + ' MET · código ' + esc(x.codigo) + '</span>'
        : '<label class="act-meta">Intensidad <select class="act-int" aria-label="Intensidad de ' + esc(x.nombre) + '">' + intensidades(x.met) + '</select></label>';
      return '<li class="act-item" data-id="' + esc(x.id) + '">' +
        '<span class="act-nombre"><b>' + esc(x.nombre) + '</b>' + meta +
          '<input class="act-nota" type="text" data-k="nota" maxlength="80" value="' + esc(x.nota || '') + '" placeholder="Detalle (opcional): rounds, series, ritmo…" aria-label="Detalle de ' + esc(x.nombre) + '">' +
        '</span>' +
        '<span class="gramos"><input type="text" inputmode="decimal" data-k="minutos" value="' + A.fmtIn(x.minutos, 1) + '" aria-label="Minutos de ' + esc(x.nombre) + '"> min</span>' +
        '<span class="act-kcal" data-l="kcal">' + A.fmt(kcalDe(p, x), 0) + '</span>' +
        '<button type="button" class="quitar" aria-label="Quitar ' + esc(x.nombre) + '">×</button>' +
        '</li>';
    }).join('');
    $('act-vacio').hidden = l.length > 0;
    document.querySelector('.act-head').hidden = l.length === 0;
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
    var minutos = l.reduce(function (s, x) { return s + x.minutos; }, 0);
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
    renderSemana(p, e);
    renderGasto(p, e);
  }

  $('act-lista').addEventListener('input', function (ev) {
    var k = ev.target.dataset.k;
    var li = ev.target.closest('.act-item');
    if (!k || !li) return;
    var x = actividadDe(li);
    if (!x) return;
    if (k === 'nota') {
      x.nota = ev.target.value.trim().slice(0, 80);
      A.persist();
      return;
    }
    var lim = D.LIMITES_ACT[k];
    var v = D.num(ev.target.value);
    if (!isFinite(v) || v < lim[0] || v > lim[1]) { ev.target.setAttribute('aria-invalid', 'true'); return; }
    ev.target.removeAttribute('aria-invalid');
    x[k] = v;
    A.persist();
    refrescarParcial(li, x);
  });

  $('act-lista').addEventListener('change', function (ev) {
    if (!ev.target.classList.contains('act-int')) return;
    var li = ev.target.closest('.act-item');
    var x = actividadDe(li);
    if (!x) return;
    x.met = parseFloat(ev.target.value);
    A.persist();
    refrescarParcial(li, x);
  });

  $('act-lista').addEventListener('click', function (ev) {
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
