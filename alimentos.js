/* Macros Lobo — Paso 2: lista de alimentos (buscar, agregar, editar, borrar, importar, exportar). */
(function () {
  'use strict';
  var A = window.App;
  var C = window.Calc;
  var D = window.Datos;
  function $(id) { return document.getElementById(id); }
  var esc = A.esc;

  var editando = null; // id del alimento abierto, 'nuevo', o null

  function alimentos() { return A.getState().alimentos; }
  function normal(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  // ---------- Lista ----------
  function render() {
    var lista = alimentos();
    var hay = lista.length > 0;
    $('alim-empty').hidden = hay || editando !== null;
    $('alim-grid').hidden = !hay && editando === null;
    $('alim-count').textContent = hay ? String(lista.length) : '';
    $('btn-alim-export').disabled = !hay;

    var q = normal($('alim-buscar').value);
    var visibles = lista
      .filter(function (a) { return !q || normal(a.nombre).indexOf(q) >= 0; })
      .sort(function (a, b) { return normal(a.nombre).localeCompare(normal(b.nombre), 'es'); });
    $('alim-lista').innerHTML = visibles.map(item).join('');
    $('alim-nada').hidden = !(hay && visibles.length === 0);
  }

  function item(a) {
    var r = C.revisarAlimento(a);
    var p = r.por100;
    var meta = [];
    if (a.base !== 100) meta.push('Etiqueta: ' + A.fmtUp(a.base, 1) + ' g = ' + A.fmtUp(a.kcal, 1) + ' kcal');
    if (a.fuente) meta.push(esc(a.fuente));
    if (r.problemas.length) meta.push('<span class="tag-warn">Revisar kcal</span>');
    return '<li><button type="button" class="alim-item" data-id="' + esc(a.id) + '" aria-current="' + (a.id === editando) + '">' +
      '<span class="alim-nombre"><b>' + esc(a.nombre) + '</b>' +
        (meta.length ? '<span class="alim-meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</span>' : '') +
      '</span>' +
      '<span class="alim-num" data-l="kcal">' + A.fmt(p.kcal, 0) + '</span>' +
      '<span class="alim-num n-prot" data-l="P">' + A.fmtUp(p.prot, 1) + '</span>' +
      '<span class="alim-num n-grasa" data-l="G">' + A.fmtUp(p.grasa, 1) + '</span>' +
      '<span class="alim-num n-carbs" data-l="C">' + A.fmtUp(p.carbs, 1) + '</span>' +
      '</button></li>';
  }

  $('alim-lista').addEventListener('click', function (e) {
    var b = e.target.closest('.alim-item');
    if (b) abrir(b.dataset.id);
  });
  $('alim-buscar').addEventListener('input', render);

  // ---------- Formulario ----------
  var form = $('alim-form');
  var CAMPOS = ['nombre', 'base', 'kcal', 'prot', 'grasa', 'carbs', 'fuente', 'nota'];

  function abrir(id) {
    editando = id;
    var a = id === 'nuevo' ? null : alimentos().find(function (x) { return x.id === id; });
    if (id !== 'nuevo' && !a) return;
    $('alim-form-title').textContent = a ? 'Editar alimento' : 'Nuevo alimento';
    CAMPOS.forEach(function (k) {
      var el = $('a-' + k);
      if (!a) el.value = k === 'base' ? '100' : '';
      else if (typeof a[k] === 'number') el.value = A.fmtIn(a[k], 4);
      else el.value = a[k] || '';
    });
    $('a-error').hidden = true;
    resetBorrar();
    form.hidden = false;
    render();
    actualizarVista();
    if (window.matchMedia('(max-width: 899px)').matches) form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    $('a-nombre').focus({ preventScroll: true });
  }

  function cerrar() {
    editando = null;
    form.hidden = true;
    render();
  }

  function leer() {
    var raw = {};
    CAMPOS.forEach(function (k) { raw[k] = $('a-' + k).value; });
    if (editando && editando !== 'nuevo') raw.id = editando;
    return raw;
  }

  /** Vista previa en vivo: valores por 100 g y chequeo de kcal. */
  function actualizarVista() {
    var raw = leer();
    renderEnlaces(raw.nombre.trim());
    var caja = $('a-preview');
    if (!raw.kcal.trim()) { caja.innerHTML = ''; return; }
    var v = D.validarAlimento(Object.assign({}, raw, { nombre: raw.nombre.trim() || 'x' }));
    if (!v.ok) { caja.innerHTML = ''; return; }
    var r = C.revisarAlimento(v.alimento);
    var p = r.por100;
    var html = '<div class="preview-box">' +
      '<span><b>Por 100 g:</b> ' + A.fmt(p.kcal, 0) + ' kcal · P ' + A.fmtUp(p.prot, 1) + ' · G ' + A.fmtUp(p.grasa, 1) + ' · C ' + A.fmtUp(p.carbs, 1) + '</span>' +
      '<span>Con los macros: 4 × ' + A.fmtUp(p.prot, 1) + ' + 4 × ' + A.fmtUp(p.carbs, 1) + ' + 9 × ' + A.fmtUp(p.grasa, 1) +
        ' = <b>' + A.fmt(r.kcalCalc, 0) + ' kcal</b>' +
        (r.problemas.length ? '' : ' <span class="preview-ok">· cuadra</span>') + '</span>' +
      '</div>';
    html += r.problemas.map(function (x) {
      return '<p class="aviso aviso-' + x.nivel + '">' + esc(x.texto) + '</p>';
    }).join('');
    caja.innerHTML = html;
  }

  function renderEnlaces(nombre) {
    if (!nombre) { $('a-links').innerHTML = ''; return; }
    var q = encodeURIComponent(nombre);
    $('a-links').innerHTML =
      '<a href="https://www.fatsecret.es/calor%C3%ADas-nutrici%C3%B3n/search?q=' + q + '" target="_blank" rel="noopener">Buscar en FatSecret</a>' +
      '<a href="https://www.google.com/search?q=' + encodeURIComponent('site:fitia.app ' + nombre) + '" target="_blank" rel="noopener">Buscar en Fitia</a>';
  }

  form.addEventListener('input', actualizarVista);
  form.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
  $('btn-alim-cancel').addEventListener('click', cerrar);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var raw = leer();
    var v = D.validarAlimento(raw);
    var err = $('a-error');
    if (!v.ok) {
      err.textContent = v.error;
      err.hidden = false;
      return;
    }
    var a = v.alimento;
    var lista = alimentos();
    var repetido = lista.find(function (x) { return x.id !== a.id && normal(x.nombre) === normal(a.nombre); });
    if (repetido) {
      err.textContent = 'Ya existe un alimento llamado «' + repetido.nombre + '». Cambia el nombre o edita ese.';
      err.hidden = false;
      return;
    }
    var idx = lista.findIndex(function (x) { return x.id === a.id; });
    if (idx >= 0) lista[idx] = a; else lista.push(a);
    A.persist();
    cerrar();
    A.avisar('ok', (idx >= 0 ? 'Actualizado' : 'Agregado') + ' «' + a.nombre + '».');
  });

  /** Dónde se usa un alimento: recetas y días de los perfiles. Texto vacío si en ningún lado. */
  function usosDe(id) {
    var s = A.getState();
    var recs = s.recetas.filter(function (r) { return r.ingredientes.some(function (i) { return i.ref === id; }); })
      .map(function (r) { return 'la receta «' + r.nombre + '»'; });
    var dias = 0;
    Object.keys(s.dias).forEach(function (pid) {
      Object.keys(s.dias[pid]).forEach(function (d) {
        if (s.dias[pid][d].some(function (it) { return it.tipo === 'alimento' && it.ref === id; })) dias += 1;
      });
    });
    if (dias) recs.push(dias === 1 ? '1 día' : dias + ' días');
    return recs.join(' y ');
  }

  // Borrar en dos pasos (confirm() no funciona en la app publicada).
  var borrarTimer = null;
  function resetBorrar() {
    clearTimeout(borrarTimer);
    $('alim-danger').innerHTML = editando && editando !== 'nuevo'
      ? '<button type="button" class="btn btn-text" id="btn-alim-del">Eliminar</button>' : '';
  }
  $('alim-danger').addEventListener('click', function (e) {
    var id = e.target.id;
    var a = alimentos().find(function (x) { return x.id === editando; });
    if (!a) return;
    if (id === 'btn-alim-del') {
      var usos = usosDe(a.id);
      $('alim-danger').innerHTML =
        (usos ? '<span class="hint is-off">Se usa en ' + esc(usos) + '; ahí quedará como «no encontrado».</span>' : '') +
        '<button type="button" class="btn btn-danger" id="btn-alim-del-ok">Eliminar «' + esc(a.nombre) + '»</button>' +
        '<button type="button" class="btn" id="btn-alim-del-no">No</button>';
      $('btn-alim-del-no').focus();
      borrarTimer = setTimeout(resetBorrar, 6000);
    } else if (id === 'btn-alim-del-no') {
      resetBorrar();
    } else if (id === 'btn-alim-del-ok') {
      A.getState().alimentos = alimentos().filter(function (x) { return x.id !== a.id; });
      A.persist();
      cerrar();
      A.avisar('ok', 'Eliminado «' + a.nombre + '».');
    }
  });

  // ---------- Botones de la barra ----------
  function nuevo() { A.limpiarAviso(); abrir('nuevo'); }
  $('btn-alim-add').addEventListener('click', nuevo);
  $('btn-alim-empty-add').addEventListener('click', nuevo);
  $('btn-alim-import').addEventListener('click', A.pedirArchivo);
  $('btn-alim-empty-import').addEventListener('click', A.pedirArchivo);
  $('btn-alim-export').addEventListener('click', function () {
    var lista = alimentos();
    if (!lista.length) return;
    var archivo = 'alimentos-y-recetas-' + A.hoy() + '.json';
    var nr = A.getState().recetas.length;
    A.descargar(archivo, D.exportar(A.getState(), null, ['alimentos', 'recetas'])).then(function (ok) {
      if (ok) A.avisar('ok', 'Exportados ' + lista.length + ' alimentos y ' + nr + ' recetas en «' + archivo + '».');
    });
  });

  A.alImportar(function () { if (editando && editando !== 'nuevo') cerrar(); else render(); });
  A.alMostrar('alimentos', render);
})();
