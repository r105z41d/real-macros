/* Macros Lobo — Paso 3: el día. Gramos reales de cada alimento o receta contra el objetivo del perfil. */
(function () {
  'use strict';
  var A = window.App;
  var C = window.Calc;
  var D = window.Datos;
  function $(id) { return document.getElementById(id); }
  var esc = A.esc;

  var CORTO = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' };
  var LARGO = { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' };
  var HOY = D.DIAS[(new Date().getDay() + 6) % 7]; // getDay(): 0 = domingo
  var dia = HOY;
  var quitado = null; // { pid, dia, item, index } para deshacer

  function indices() {
    var s = A.getState();
    return { al: C.indexar(s.alimentos), rec: C.indexar(s.recetas) };
  }
  function plan(p, d) {
    var s = A.getState();
    return (s.dias[p.id] && s.dias[p.id][d || dia]) || [];
  }
  function planEditable(p) {
    var s = A.getState();
    if (!s.dias[p.id]) s.dias[p.id] = {};
    if (!s.dias[p.id][dia]) s.dias[p.id][dia] = [];
    return s.dias[p.id][dia];
  }

  // ---------- Render ----------
  function render() {
    var p = A.activo();
    renderPerfiles();
    $('dia-sin-perfil').hidden = !!p;
    $('dia-grid').hidden = !p;
    $('dia-semana').hidden = !p;
    if (!p) return;
    var ix = indices();
    renderSemana(p, ix);
    renderLista(p, ix);
    renderResumen(p, ix);
  }

  function renderPerfiles() {
    var s = A.getState();
    $('dia-perfiles').innerHTML = s.perfiles.map(function (p) {
      return '<button type="button" class="pchip" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === s.activo) + '">' +
        esc(p.nombre || 'Sin nombre') + '</button>';
    }).join('');
  }

  function renderSemana(p, ix) {
    $('dia-semana').innerHTML = D.DIAS.map(function (d) {
      var items = plan(p, d);
      var kcal = C.totalDia(items, ix.al, ix.rec).total.kcal;
      return '<button type="button" class="dia-chip' + (d === HOY ? ' es-hoy' : '') + '" data-dia="' + d + '" aria-pressed="' + (d === dia) + '"' +
        (d === HOY ? ' title="Hoy"' : '') + '>' +
        '<span>' + CORTO[d] + '</span><small>' + (items.length ? A.fmt(kcal, 0) : '—') + '</small></button>';
    }).join('');
  }

  function nombreDe(it, ix) {
    var x = it.tipo === 'receta' ? ix.rec[it.ref] : ix.al[it.ref];
    return x ? x.nombre : null;
  }

  function numeros(m) {
    if (!m) return '<span class="alim-num" data-l="kcal">—</span><span class="alim-num">—</span><span class="alim-num">—</span><span class="alim-num">—</span>';
    return '<span class="alim-num" data-l="kcal">' + A.fmt(m.kcal, 0) + '</span>' +
      '<span class="alim-num n-prot" data-l="P">' + A.fmtUp(m.prot, 1) + '</span>' +
      '<span class="alim-num n-grasa" data-l="G">' + A.fmtUp(m.grasa, 1) + '</span>' +
      '<span class="alim-num n-carbs" data-l="C">' + A.fmtUp(m.carbs, 1) + '</span>';
  }

  function renderLista(p, ix) {
    var items = plan(p);
    var t = C.totalDia(items, ix.al, ix.rec);
    $('dia-lista').innerHTML = items.map(function (it, i) {
      var nombre = nombreDe(it, ix);
      var etiqueta = nombre || 'línea';
      return '<li class="dia-item" data-id="' + esc(it.id) + '">' +
        '<span class="di-nombre">' +
          (nombre ? '<b>' + esc(nombre) + '</b>' : '<span class="tag-warn">' + (it.tipo === 'receta' ? 'Receta no encontrada' : 'Alimento no encontrado') + '</span>') +
          (it.tipo === 'receta' && nombre ? ' <span class="sug-tag">receta</span>' : '') +
        '</span>' +
        '<span class="gramos"><input type="text" inputmode="decimal" value="' + A.fmtIn(it.gramos, 1) + '" aria-label="Gramos de ' + esc(etiqueta) + '"> g</span>' +
        '<span class="di-nums">' + numeros(t.porItem[i]) + '</span>' +
        '<button type="button" class="quitar" aria-label="Quitar ' + esc(etiqueta) + '">×</button>' +
        '</li>';
    }).join('');
    $('dia-vacio').hidden = items.length > 0;
    document.querySelector('.dia-head').hidden = items.length === 0;
  }

  function renderResumen(p, ix) {
    var obj = C.objetivoDia(C.calcPerfil(p));
    var t = C.totalDia(plan(p), ix.al, ix.rec);
    $('dia-resumen-title').textContent = LARGO[dia] + (dia === HOY ? ' (hoy)' : '') + ' · ' + (p.nombre || 'Sin nombre');
    if (!obj) {
      $('dia-medidores').innerHTML = '<p class="hint">Completa el perfil (peso, altura, edad) para ver su objetivo. <a href="#perfil">Ir a Perfil</a></p>';
      $('dia-resumen-nota').textContent = '';
      return;
    }
    var filas = [
      ['kcal', 'Calorías', 'kcal', 0],
      ['prot', 'Proteína', 'g', 1],
      ['grasa', 'Grasa', 'g', 1],
      ['carbs', 'Carbohidratos', 'g', 1]
    ];
    $('dia-medidores').innerHTML = filas.map(function (f) {
      var k = f[0];
      var o = obj[k];
      var tot = t.total[k];
      var dif = o - tot;
      var pct = o > 0 ? tot / o : 0;
      var estado = Math.abs(dif) <= o * 0.05 ? 'ok' : dif > 0 ? 'falta' : 'pasa';
      var texto = dif >= 0 ? 'Faltan ' + A.fmtUp(dif, f[3]) + ' ' + f[2] : 'Te pasas ' + A.fmtUp(-dif, f[3]) + ' ' + f[2];
      if (estado === 'ok') texto = 'En el objetivo · ' + texto.charAt(0).toLowerCase() + texto.slice(1);
      return '<div class="medidor m-' + k + ' est-' + estado + '">' +
        '<div class="m-top"><span class="m-label">' + f[1] + '</span>' +
        '<span class="m-val"><b>' + A.fmt(tot, f[3]) + '</b> de ' + A.fmt(o, f[3]) + ' ' + f[2] + '</span></div>' +
        '<div class="m-bar" role="img" aria-label="' + Math.round(pct * 100) + ' % del objetivo"><span style="width:' + Math.min(100, pct * 100).toFixed(1) + '%"></span></div>' +
        '<p class="m-dif">' + texto + '</p></div>';
    }).join('');
    $('dia-resumen-nota').textContent = t.faltan.length
      ? t.faltan.length + ' línea(s) ya no tienen alimento o receta y suman 0.'
      : 'Diferencia = objetivo − total, como en tu hoja «Objetivo».';
  }

  /** Tras cambiar gramos: actualiza esa fila, el resumen y la semana sin redibujar la lista (no pierde el foco). */
  function refrescarParcial(li, it) {
    var p = A.activo();
    var ix = indices();
    var m = C.itemDia(it, ix.al, ix.rec);
    li.querySelector('.di-nums').innerHTML = numeros(m);
    renderResumen(p, ix);
    renderSemana(p, ix);
  }

  // ---------- Eventos ----------
  $('dia-perfiles').addEventListener('click', function (e) {
    var b = e.target.closest('.pchip');
    if (!b || b.dataset.id === A.getState().activo) return;
    A.setActivo(b.dataset.id);
    quitado = null;
    A.limpiarAviso();
    render();
  });

  $('dia-semana').addEventListener('click', function (e) {
    var b = e.target.closest('.dia-chip');
    if (!b) return;
    dia = b.dataset.dia;
    quitado = null;
    A.limpiarAviso();
    render();
  });

  $('dia-lista').addEventListener('input', function (e) {
    var li = e.target.closest('.dia-item');
    if (!li) return;
    var p = A.activo();
    var it = plan(p).find(function (x) { return x.id === li.dataset.id; });
    if (!it) return;
    var v = D.num(e.target.value);
    var valido = isFinite(v) && v >= 0 && v <= 5000;
    if (!valido) { e.target.setAttribute('aria-invalid', 'true'); return; }
    e.target.removeAttribute('aria-invalid');
    it.gramos = v;
    A.persist();
    refrescarParcial(li, it);
  });

  $('dia-lista').addEventListener('click', function (e) {
    var b = e.target.closest('.quitar');
    if (!b) return;
    var p = A.activo();
    var items = planEditable(p);
    var idx = items.findIndex(function (x) { return x.id === b.closest('.dia-item').dataset.id; });
    if (idx < 0) return;
    var it = items.splice(idx, 1)[0];
    quitado = { pid: p.id, dia: dia, item: it, index: idx };
    A.persist();
    render();
    var nombre = nombreDe(it, indices()) || 'la línea';
    var caja = $('dia-status');
    caja.className = 'bar-status is-ok';
    caja.innerHTML = '<span>Quitado «' + esc(nombre) + '» del ' + LARGO[dia].toLowerCase() + '. ' +
      '<button type="button" class="link-btn" id="btn-deshacer">Deshacer</button></span>';
  });

  $('dia-status').addEventListener('click', function (e) {
    if (e.target.id !== 'btn-deshacer' || !quitado) return;
    var s = A.getState();
    var items = (s.dias[quitado.pid] = s.dias[quitado.pid] || {})[quitado.dia] = (s.dias[quitado.pid][quitado.dia] || []);
    items.splice(Math.min(quitado.index, items.length), 0, quitado.item);
    quitado = null;
    A.persist();
    A.limpiarAviso();
    render();
  });

  A.buscador($('dia-buscar'), $('dia-sug'), function () { return A.opcionesBiblioteca(true); }, function (o) {
    var p = A.activo();
    if (!p) return;
    var ix = indices();
    var gramos = 100;
    if (o.tipo === 'receta' && ix.rec[o.id]) {
      // Por defecto, la receta completa (como la Ensalada del Excel); se corrige con lo que pesaste.
      gramos = Math.round(C.totalReceta(ix.rec[o.id], ix.al).peso * 10) / 10 || 100;
    }
    planEditable(p).push({ id: D.nuevoId(), tipo: o.tipo, ref: o.id, gramos: gramos });
    A.persist();
    A.limpiarAviso();
    render();
    var inputs = $('dia-lista').querySelectorAll('input');
    var ultimo = inputs[inputs.length - 1];
    if (ultimo) { ultimo.focus(); ultimo.select(); }
  });

  /** Abrir la vista Día en un día concreto (desde la Semana). */
  A.abrirDia = function (d) {
    if (D.DIAS.indexOf(d) < 0) return;
    dia = d;
    quitado = null;
    if (location.hash === '#dia') render(); else location.hash = 'dia';
  };

  A.alImportar(render);
  A.alMostrar('dia', render);
})();
