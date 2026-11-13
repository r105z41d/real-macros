/* Macros Lobo — Paso 5: registro de peso, tendencia y mantenimiento real (calibrar el factor). */
(function () {
  'use strict';
  var A = window.App;
  var C = window.Calc;
  var D = window.Datos;
  function $(id) { return document.getElementById(id); }
  var esc = A.esc;

  var deshacer = null; // { pid, antes } tras usar un valor en el perfil

  var fmtFecha = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  var fmtSemana = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  function aFecha(iso) { return new Date(C.diaNum(iso) * 86400000); }
  function hoyLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function pesosDe(p) {
    var s = A.getState();
    return s.pesos[p.id] || [];
  }

  // ---------- Render ----------
  function render() {
    var p = A.activo();
    renderPerfiles();
    $('peso-sin-perfil').hidden = !!p;
    $('peso-grid').hidden = !p;
    if (!p) return;
    if (!$('p-fecha').value) $('p-fecha').value = hoyLocal();
    var lista = pesosDe(p);
    renderTendencia(p, lista);
    renderSemanas(lista);
    renderLista(lista);
  }

  function renderPerfiles() {
    var s = A.getState();
    $('peso-perfiles').innerHTML = s.perfiles.map(function (p) {
      return '<button type="button" class="pchip" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === s.activo) + '">' +
        esc(p.nombre || 'Sin nombre') + '</button>';
    }).join('');
  }

  function cifra(valor, etiqueta, detalle) {
    return '<div class="cifra"><span class="cifra-v">' + valor + '</span><span class="cifra-l">' + esc(etiqueta) + '</span><span class="cifra-d">' + esc(detalle || '') + '</span></div>';
  }

  function renderTendencia(p, lista) {
    var t = C.tendenciaPeso(lista, 28);
    if (!t) {
      $('peso-cifras').innerHTML = '';
      $('peso-calib').innerHTML = '<p class="hint">Anota tu primer peso para empezar. Con 4 pesajes en 2 semanas o más, aquí verás tu tendencia y tu mantenimiento real.</p>';
      return;
    }
    var pct = t.kgSemana !== null && A.ok(p.peso) ? (t.kgSemana / t.ultimo) * 100 : null;
    $('peso-cifras').innerHTML =
      cifra(A.fmtUp(t.ultimo, 1) + ' kg', 'último pesaje', fmtFecha.format(aFecha(t.hasta))) +
      cifra(t.kgSemana === null ? '—' : (t.kgSemana > 0 ? '+' : t.kgSemana < 0 ? '−' : '') + A.fmtUp(Math.abs(t.kgSemana), 2) + ' kg',
        'por semana', pct === null ? 'faltan pesajes' : A.fmtUp(Math.abs(pct), 2) + ' % de tu peso') +
      cifra(String(t.n), t.n === 1 ? 'pesaje' : 'pesajes', 'en ' + t.spanDias + ' días (últimas 4 semanas)');

    var html = '';
    // Actualizar el peso del perfil
    if (A.ok(p.peso) && Math.abs(t.ultimo - p.peso) >= 0.1) {
      html += '<div class="comparar"><p>El perfil dice ' + A.fmtUp(p.peso, 1) + ' kg y tu último pesaje es ' + A.fmtUp(t.ultimo, 1) + ' kg. ' +
        'Al cambiar el peso cambian la TMB y la proteína.</p>' +
        '<button type="button" class="btn" id="btn-usar-peso" data-kg="' + t.ultimo + '">Usar ' + A.fmtUp(t.ultimo, 1) + ' kg en el perfil</button></div>';
    }
    // Mantenimiento real
    if (!t.suficiente) {
      var faltan = [];
      if (t.n < 4) faltan.push((4 - t.n) + ' pesaje(s) más');
      if (t.spanDias < 14) faltan.push((14 - t.spanDias) + ' día(s) más de registro');
      html += '<p class="hint">Para estimar tu mantenimiento real faltan ' + esc(faltan.join(' y ')) + ' (mínimo 4 pesajes en 14 días).</p>';
    } else {
      html += calibracion(p, t);
    }
    $('peso-calib').innerHTML = html;
  }

  /** Mantenimiento real = lo que comes en promedio − el cambio de peso convertido a kcal. */
  function calibracion(p, t) {
    var s = A.getState();
    var semana = C.totalesSemana(s.dias[p.id] || {}, C.indexar(s.alimentos), C.indexar(s.recetas));
    if (!semana.promedio) {
      return '<p class="hint">Planea tus días en la pestaña Semana: el mantenimiento real se calcula con lo que comes en promedio.</p>';
    }
    // Con «según mi ejercicio» el gasto cambia cada día: se compara con el promedio de la semana.
    var porDia = p.modo === 'ejercicio';
    var sem = A.calcSemana(p);
    var r = sem.porDia.lun;
    if (!r.valido || !sem.promedio) return '<p class="hint">Completa el perfil para comparar con su gasto.</p>';
    var gasto = porDia ? sem.promedio.tdee : r.tdee;
    var real = C.tdeeReal(semana.promedio.kcal, t.kgSemana);
    var factor = real / r.tmb;
    // El ejercicio anotado se deja igual: lo que se ajusta es la base del resto del día.
    var pal = (real - (porDia ? sem.promedio.kcalEjercicio : 0)) / r.tmb;
    var dif = Math.abs(real - gasto) >= 50;
    var html = '<div class="comparar">' +
      '<p>Comiendo en promedio <b>' + A.fmt(semana.promedio.kcal, 0) + ' kcal</b> (tu plan de la semana, ' + semana.diasConPlan +
      (semana.diasConPlan === 1 ? ' día' : ' días') + ') y con una tendencia de <b>' + (t.kgSemana < 0 ? '−' : '+') + A.fmtUp(Math.abs(t.kgSemana), 2) +
      ' kg por semana</b>, tu mantenimiento real es de unas <b>' + A.fmt(real, 0) + ' kcal</b>' +
      (porDia ? '.</p>' : ', o sea un factor de <b>×' + A.fmtUp(factor, 3) + '</b>.</p>') +
      '<p>' + (porDia
        ? 'Tu perfil calcula en promedio ' + A.fmt(gasto, 0) + ' kcal al día (base ×' + A.fmtUp(A.entrenoDe(p).palBase, 2) + ' + tu ejercicio): '
        : 'Tu perfil usa ×' + A.fmtUp(p.factor, 3) + ' (' + A.fmt(gasto, 0) + ' kcal): ') +
      (!dif ? 'coinciden.' : real < gasto ? 'gastas unas ' + A.fmt(gasto - real, 0) + ' kcal menos de lo que dice el perfil.' : 'gastas unas ' + A.fmt(real - gasto, 0) + ' kcal más de lo que dice el perfil.') + '</p>';
    if (dif && !porDia && factor >= 1 && factor <= 2.5) {
      html += '<button type="button" class="btn" id="btn-usar-real" data-factor="' + (Math.round(factor * 1000) / 1000) + '">Usar ×' + A.fmtUp(factor, 3) + ' en el perfil</button>';
    } else if (dif && porDia && pal >= 1.2 && pal <= 2.2) {
      html += '<button type="button" class="btn" id="btn-usar-pal" data-pal="' + (Math.round(pal * 100) / 100) + '">Usar base ×' + A.fmtUp(pal, 2) + ' para el resto del día</button>';
    } else if (dif && porDia) {
      html += '<p class="hint">La diferencia es más grande de lo que explica el resto del día: revisa los minutos del ejercicio en Entreno o si comiste distinto a lo planeado.</p>';
    }
    return html + '<p class="hint">Supone que comiste lo planeado. Si comiste distinto, el resultado cambia. Con más semanas de datos, más confiable.</p></div>';
  }

  function renderSemanas(lista) {
    var w = C.promediosSemanales(lista);
    if (!w.length) { $('peso-semanas').innerHTML = ''; return; }
    $('peso-semanas').innerHTML = '<thead><tr><th scope="col">Semana del</th><th scope="col">Promedio</th><th scope="col">Pesajes</th><th scope="col">Cambio</th></tr></thead><tbody>' +
      w.map(function (x) {
        var c = x.cambio;
        return '<tr><th scope="row">' + fmtSemana.format(aFecha(x.semana)) + '</th><td>' + A.fmtUp(x.promedio, 2) + ' kg</td><td>' + x.n + '</td>' +
          '<td class="' + (c === null ? '' : c < 0 ? 'baja' : c > 0 ? 'sube' : '') + '">' + (c === null ? '—' : (c > 0 ? '+' : c < 0 ? '−' : '') + A.fmtUp(Math.abs(c), 2)) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  function renderLista(lista) {
    $('peso-lista').innerHTML = lista.slice().reverse().map(function (r) {
      return '<li data-fecha="' + r.fecha + '"><span class="pl-fecha">' + fmtFecha.format(aFecha(r.fecha)) + '</span>' +
        '<span class="pl-kg">' + A.fmtUp(r.kg, 2) + ' kg</span>' +
        '<button type="button" class="quitar" aria-label="Borrar el pesaje del ' + fmtFecha.format(aFecha(r.fecha)) + '">×</button></li>';
    }).join('') || '<li class="hint">Todavía no hay pesajes.</li>';
    $('btn-peso-export').disabled = lista.length === 0;
  }

  // ---------- Eventos ----------
  $('peso-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = A.activo();
    var v = D.validarPeso({ fecha: $('p-fecha').value, kg: $('p-kg').value });
    var err = $('p-error');
    if (!v.ok) { err.textContent = v.error; err.hidden = false; return; }
    err.hidden = true;
    var s = A.getState();
    var habia = pesosDe(p).some(function (r) { return r.fecha === v.registro.fecha; });
    s.pesos[p.id] = D.ponerPeso(pesosDe(p), v.registro);
    A.persist();
    $('p-kg').value = '';
    render();
    A.avisar('ok', (habia ? 'Reemplazado' : 'Guardado') + ' el pesaje del ' + fmtFecha.format(aFecha(v.registro.fecha)) + ': ' + A.fmtUp(v.registro.kg, 2) + ' kg.');
  });

  $('peso-lista').addEventListener('click', function (e) {
    var b = e.target.closest('.quitar');
    if (!b) return;
    var p = A.activo();
    var fecha = b.closest('li').dataset.fecha;
    var antes = pesosDe(p);
    var quitado = antes.find(function (r) { return r.fecha === fecha; });
    A.getState().pesos[p.id] = antes.filter(function (r) { return r.fecha !== fecha; });
    A.persist();
    render();
    deshacer = { tipo: 'peso', pid: p.id, registro: quitado };
    var caja = $('peso-status');
    caja.className = 'bar-status is-ok';
    caja.innerHTML = '<span>Borrado el pesaje del ' + esc(fmtFecha.format(aFecha(fecha))) + '. <button type="button" class="link-btn" id="btn-peso-deshacer">Deshacer</button></span>';
  });

  $('peso-calib').addEventListener('click', function (e) {
    var p = A.activo();
    var cambios = null;
    var texto = '';
    if (e.target.id === 'btn-usar-real') {
      cambios = { factor: parseFloat(e.target.dataset.factor) };
      texto = 'El perfil «' + p.nombre + '» ahora usa ×' + A.fmtUp(cambios.factor, 3) + '.';
    } else if (e.target.id === 'btn-usar-pal') {
      var ent = A.entrenoDe(p);
      deshacer = { tipo: 'pal', pid: p.id, antes: ent.palBase };
      ent.palBase = parseFloat(e.target.dataset.pal);
      A.persist();
      render();
      var aviso = $('peso-status');
      aviso.className = 'bar-status is-ok';
      aviso.innerHTML = '<span>' + esc('El perfil «' + p.nombre + '» ahora usa base ×' + A.fmtUp(ent.palBase, 2) + ' para el resto del día.') +
        ' <button type="button" class="link-btn" id="btn-peso-deshacer">Deshacer</button></span>';
      return;
    } else if (e.target.id === 'btn-usar-peso') {
      cambios = { peso: parseFloat(e.target.dataset.kg) };
      texto = 'El perfil «' + p.nombre + '» ahora pesa ' + A.fmtUp(cambios.peso, 1) + ' kg.';
    }
    if (!cambios) return;
    deshacer = { tipo: 'perfil', pid: p.id, antes: A.cambiarPerfil(p.id, cambios) };
    render();
    var caja = $('peso-status');
    caja.className = 'bar-status is-ok';
    caja.innerHTML = '<span>' + esc(texto) + ' <button type="button" class="link-btn" id="btn-peso-deshacer">Deshacer</button></span>';
  });

  $('peso-status').addEventListener('click', function (e) {
    if (e.target.id !== 'btn-peso-deshacer' || !deshacer) return;
    if (deshacer.tipo === 'perfil') A.cambiarPerfil(deshacer.pid, deshacer.antes);
    else if (deshacer.tipo === 'pal') A.getState().entreno[deshacer.pid].palBase = deshacer.antes;
    else A.getState().pesos[deshacer.pid] = D.ponerPeso(A.getState().pesos[deshacer.pid] || [], deshacer.registro);
    A.persist();
    deshacer = null;
    A.limpiarAviso();
    render();
  });

  $('peso-perfiles').addEventListener('click', function (e) {
    var b = e.target.closest('.pchip');
    if (!b || b.dataset.id === A.getState().activo) return;
    A.setActivo(b.dataset.id);
    deshacer = null;
    A.limpiarAviso();
    render();
  });

  $('btn-peso-import').addEventListener('click', A.pedirArchivo);
  $('btn-peso-export').addEventListener('click', function () {
    var p = A.activo();
    var out = { app: D.APP, formato: D.FORMATO, exportado: new Date().toISOString(), pesos: {} };
    out.pesos[p.id] = pesosDe(p);
    var archivo = 'pesos-' + (A.normal(p.nombre).replace(/[^a-z0-9]+/g, '-') || 'perfil') + '-' + A.hoy() + '.json';
    A.descargar(archivo, out).then(function (ok) {
      if (ok) A.avisar('ok', 'Exportados ' + out.pesos[p.id].length + ' pesajes de «' + p.nombre + '» en «' + archivo + '».');
    });
  });

  A.alImportar(render);
  A.alMostrar('peso', render);
})();
