/* Macros Lobo — Paso 3: recetas (como la hoja «Ensalada»), con peso de la preparación lista opcional. */
(function () {
  'use strict';
  var A = window.App;
  var C = window.Calc;
  var D = window.Datos;
  function $(id) { return document.getElementById(id); }
  var esc = A.esc;

  var editando = null;   // id de la receta abierta, 'nuevo', o null
  var ingredientes = []; // borrador de ingredientes mientras se edita: [{ ref, gramos }]

  function recetas() { return A.getState().recetas; }
  function alimentosPorId() { return C.indexar(A.getState().alimentos); }

  // ---------- Lista ----------
  function render() {
    var lista = recetas();
    var hay = lista.length > 0;
    $('rec-empty').hidden = hay || editando !== null;
    $('rec-grid').hidden = !hay && editando === null;
    $('rec-count').textContent = hay ? String(lista.length) : '';
    $('btn-rec-export').disabled = !hay && A.getState().alimentos.length === 0;

    var al = alimentosPorId();
    var q = A.normal($('rec-buscar').value);
    var visibles = lista
      .filter(function (r) { return !q || A.normal(r.nombre).indexOf(q) >= 0; })
      .sort(function (a, b) { return A.normal(a.nombre).localeCompare(A.normal(b.nombre), 'es'); });
    $('rec-lista').innerHTML = visibles.map(function (r) { return item(r, al); }).join('');
    $('rec-nada').hidden = !(hay && visibles.length === 0);
  }

  function item(r, al) {
    var t = C.totalReceta(r, al);
    var p = t.por100;
    var meta = [
      r.ingredientes.length + (r.ingredientes.length === 1 ? ' ingrediente' : ' ingredientes'),
      (r.pesoTotal ? 'olla lista ' : '') + A.fmt(t.peso, 0) + ' g = ' + A.fmt(t.total.kcal, 0) + ' kcal'
    ].map(esc);
    if (t.faltan.length) meta.push('<span class="tag-warn">' + t.faltan.length + ' ingrediente(s) no encontrado(s)</span>');
    return '<li><button type="button" class="alim-item" data-id="' + esc(r.id) + '" aria-current="' + (r.id === editando) + '">' +
      '<span class="alim-nombre"><b>' + esc(r.nombre) + '</b><span class="alim-meta">' +
        meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</span></span>' +
      '<span class="alim-num" data-l="kcal">' + A.fmt(p.kcal, 0) + '</span>' +
      '<span class="alim-num n-prot" data-l="P">' + A.fmtUp(p.prot, 1) + '</span>' +
      '<span class="alim-num n-grasa" data-l="G">' + A.fmtUp(p.grasa, 1) + '</span>' +
      '<span class="alim-num n-carbs" data-l="C">' + A.fmtUp(p.carbs, 1) + '</span>' +
      '</button></li>';
  }

  $('rec-lista').addEventListener('click', function (e) {
    var b = e.target.closest('.alim-item');
    if (b) abrir(b.dataset.id);
  });
  $('rec-buscar').addEventListener('input', render);

  // ---------- Formulario ----------
  var form = $('rec-form');

  function abrir(id) {
    var r = id === 'nuevo' ? null : recetas().find(function (x) { return x.id === id; });
    if (id !== 'nuevo' && !r) return;
    editando = id;
    $('rec-form-title').textContent = r ? 'Editar receta' : 'Nueva receta';
    $('r-nombre').value = r ? r.nombre : '';
    $('r-peso').value = r && r.pesoTotal ? A.fmtIn(r.pesoTotal, 1) : '';
    $('r-nota').value = r ? r.nota || '' : '';
    ingredientes = r ? r.ingredientes.map(function (i) { return { ref: i.ref, gramos: i.gramos }; }) : [];
    $('r-error').hidden = true;
    resetBorrar();
    form.hidden = false;
    renderIngredientes();
    render();
    if (window.matchMedia('(max-width: 899px)').matches) form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    $('r-nombre').focus({ preventScroll: true });
  }

  function cerrar() {
    editando = null;
    form.hidden = true;
    render();
  }

  function renderIngredientes() {
    var al = alimentosPorId();
    $('r-ings').innerHTML = ingredientes.map(function (ing, i) {
      var a = al[ing.ref];
      var m = a ? C.porcion(a, ing.gramos) : null;
      return '<li class="ing" data-i="' + i + '">' +
        '<span class="ing-nombre">' + (a ? esc(a.nombre) : '<span class="tag-warn">Alimento no encontrado</span>') + '</span>' +
        '<span class="gramos"><input type="text" inputmode="decimal" value="' + A.fmtIn(ing.gramos, 1) + '" aria-label="Gramos de ' + esc(a ? a.nombre : 'ingrediente') + '"> g</span>' +
        '<span class="ing-kcal">' + (m ? A.fmt(m.kcal, 0) + ' kcal' : '—') + '</span>' +
        '<button type="button" class="quitar" aria-label="Quitar ' + esc(a ? a.nombre : 'ingrediente') + '">×</button>' +
        '</li>';
    }).join('');
    actualizarVista();
  }

  $('r-ings').addEventListener('input', function (e) {
    var li = e.target.closest('.ing');
    if (!li) return;
    var i = Number(li.dataset.i);
    var v = D.num(e.target.value);
    var valido = isFinite(v) && v >= 0 && v <= 5000;
    if (valido) e.target.removeAttribute('aria-invalid'); else e.target.setAttribute('aria-invalid', 'true');
    if (!valido) return;
    ingredientes[i].gramos = v;
    var a = alimentosPorId()[ingredientes[i].ref];
    li.querySelector('.ing-kcal').textContent = a ? A.fmt(C.porcion(a, v).kcal, 0) + ' kcal' : '—';
    actualizarVista();
  });
  $('r-ings').addEventListener('click', function (e) {
    var b = e.target.closest('.quitar');
    if (!b) return;
    ingredientes.splice(Number(b.closest('.ing').dataset.i), 1);
    renderIngredientes();
    $('r-buscar').focus();
  });

  A.buscador($('r-buscar'), $('r-sug'), function () { return A.opcionesBiblioteca(false); }, function (o) {
    ingredientes.push({ ref: o.id, gramos: 100 });
    renderIngredientes();
    var inputs = $('r-ings').querySelectorAll('input');
    var ultimo = inputs[inputs.length - 1];
    if (ultimo) { ultimo.focus(); ultimo.select(); }
  });

  function borrador() {
    return {
      id: editando && editando !== 'nuevo' ? editando : undefined,
      nombre: $('r-nombre').value,
      ingredientes: ingredientes,
      pesoTotal: $('r-peso').value.trim(),
      nota: $('r-nota').value
    };
  }

  /** Totales en vivo: receta completa y por 100 g de la preparación. */
  function actualizarVista() {
    var caja = $('r-preview');
    if (!ingredientes.length) { caja.innerHTML = ''; return; }
    var pesoTxt = $('r-peso').value.trim();
    var peso = pesoTxt ? D.num(pesoTxt) : null;
    $('r-peso').toggleAttribute('aria-invalid', pesoTxt !== '' && !(peso > 0));
    var t = C.totalReceta({ ingredientes: ingredientes, pesoTotal: peso > 0 ? peso : null }, alimentosPorId());
    var p = t.por100;
    caja.innerHTML = '<div class="preview-box">' +
      '<span><b>Receta completa:</b> ' + A.fmt(t.total.kcal, 0) + ' kcal · P ' + A.fmtUp(t.total.prot, 1) + ' · G ' + A.fmtUp(t.total.grasa, 1) + ' · C ' + A.fmtUp(t.total.carbs, 1) + '</span>' +
      '<span>Ingredientes: ' + A.fmt(t.pesoIngredientes, 0) + ' g' + (peso > 0 ? ' · lista: ' + A.fmt(peso, 0) + ' g' : '') + '</span>' +
      '<span><b>Por 100 g' + (peso > 0 ? ' de la preparación lista' : '') + ':</b> ' + A.fmt(p.kcal, 0) + ' kcal · P ' + A.fmtUp(p.prot, 1) + ' · G ' + A.fmtUp(p.grasa, 1) + ' · C ' + A.fmtUp(p.carbs, 1) + '</span>' +
      '</div>' +
      (t.faltan.length ? '<p class="aviso aviso-warn">Hay ingredientes que ya no están en tu lista de alimentos; suman 0.</p>' : '');
  }
  $('r-peso').addEventListener('input', actualizarVista);
  form.addEventListener('keydown', function (e) { if (e.key === 'Escape' && e.target.id !== 'r-buscar') cerrar(); });
  $('btn-rec-cancel').addEventListener('click', cerrar);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('r-error');
    var v = D.validarReceta(borrador());
    if (!v.ok) { err.textContent = v.error; err.hidden = false; return; }
    var r = v.receta;
    var lista = recetas();
    var repetida = lista.find(function (x) { return x.id !== r.id && A.normal(x.nombre) === A.normal(r.nombre); });
    if (repetida) {
      err.textContent = 'Ya existe una receta llamada «' + repetida.nombre + '». Cambia el nombre o edita esa.';
      err.hidden = false;
      return;
    }
    var idx = lista.findIndex(function (x) { return x.id === r.id; });
    if (idx >= 0) lista[idx] = r; else lista.push(r);
    A.persist();
    cerrar();
    A.avisar('ok', (idx >= 0 ? 'Actualizada' : 'Guardada') + ' la receta «' + r.nombre + '».');
  });

  // ---------- Eliminar (dos pasos) ----------
  var borrarTimer = null;
  function resetBorrar() {
    clearTimeout(borrarTimer);
    $('rec-danger').innerHTML = editando && editando !== 'nuevo'
      ? '<button type="button" class="btn btn-text" id="btn-rec-del">Eliminar</button>' : '';
  }
  function diasQueUsan(id) {
    var s = A.getState();
    var n = 0;
    Object.keys(s.dias).forEach(function (pid) {
      Object.keys(s.dias[pid]).forEach(function (d) {
        if (s.dias[pid][d].some(function (it) { return it.tipo === 'receta' && it.ref === id; })) n += 1;
      });
    });
    return n;
  }
  $('rec-danger').addEventListener('click', function (e) {
    var id = e.target.id;
    var r = recetas().find(function (x) { return x.id === editando; });
    if (!r) return;
    if (id === 'btn-rec-del') {
      var n = diasQueUsan(r.id);
      $('rec-danger').innerHTML =
        (n ? '<span class="hint is-off">Se usa en ' + n + (n === 1 ? ' día' : ' días') + '; ahí quedará como «no encontrada».</span>' : '') +
        '<button type="button" class="btn btn-danger" id="btn-rec-del-ok">Eliminar «' + esc(r.nombre) + '»</button>' +
        '<button type="button" class="btn" id="btn-rec-del-no">No</button>';
      $('btn-rec-del-no').focus();
      borrarTimer = setTimeout(resetBorrar, 6000);
    } else if (id === 'btn-rec-del-no') {
      resetBorrar();
    } else if (id === 'btn-rec-del-ok') {
      A.getState().recetas = recetas().filter(function (x) { return x.id !== r.id; });
      A.persist();
      cerrar();
      A.avisar('ok', 'Eliminada la receta «' + r.nombre + '».');
    }
  });

  // ---------- Barra ----------
  function nueva() {
    A.limpiarAviso();
    if (!A.getState().alimentos.length) {
      A.avisar('bad', 'Primero agrega alimentos: una receta se arma con alimentos de tu lista.');
      return;
    }
    abrir('nuevo');
  }
  $('btn-rec-add').addEventListener('click', nueva);
  $('btn-rec-empty-add').addEventListener('click', nueva);
  $('btn-rec-import').addEventListener('click', A.pedirArchivo);
  $('btn-rec-empty-import').addEventListener('click', A.pedirArchivo);
  $('btn-rec-export').addEventListener('click', function () {
    var s = A.getState();
    var archivo = 'alimentos-y-recetas-' + A.hoy() + '.json';
    A.descargar(archivo, D.exportar(s, null, ['alimentos', 'recetas'])).then(function (ok) {
      if (ok) A.avisar('ok', 'Exportados ' + s.alimentos.length + ' alimentos y ' + s.recetas.length + ' recetas en «' + archivo + '».');
    });
  });

  A.alImportar(function () { if (editando && editando !== 'nuevo') cerrar(); else render(); });
  A.alMostrar('recetas', render);
})();
