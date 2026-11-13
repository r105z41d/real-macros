/* Macros Lobo — Paso 1: perfiles (crear, editar, importar, exportar) y objetivo diario. */
(function () {
  'use strict';
  var C = window.Calc;
  var D = window.Datos;
  var S = window.Store;

  // ---------- Formato (es-CO: 2.384,53) ----------
  var nfCache = {};
  function nf(min, max) {
    var k = min + ':' + max;
    if (!nfCache[k]) nfCache[k] = new Intl.NumberFormat('es-CO', { minimumFractionDigits: min, maximumFractionDigits: max });
    return nfCache[k];
  }
  function ok(n) { return typeof n === 'number' && isFinite(n); }
  /** Número con exactamente `dec` decimales. */
  function fmt(n, dec) { return ok(n) ? nf(dec || 0, dec || 0).format(n) : '—'; }
  /** Número con hasta `max` decimales (sin ceros sobrantes). */
  function fmtUp(n, max) { return ok(n) ? nf(0, max == null ? 2 : max).format(n) : '—'; }
  /** Para rellenar campos: coma decimal y sin separador de miles ("1000", no "1.000"). */
  var nfIn = {};
  function fmtIn(n, max) {
    if (!ok(n)) return '';
    if (!nfIn[max]) nfIn[max] = new Intl.NumberFormat('es-CO', { maximumFractionDigits: max, useGrouping: false });
    return nfIn[max].format(n);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- Estado ----------
  // La app arranca sin perfiles: cada quien crea el suyo o importa un archivo de perfil.
  var VACIO = { version: 1, activo: null, perfiles: [], alimentos: [], recetas: [], dias: {}, entreno: {}, pesos: {} };
  function normalizar(s) {
    if (!s || !Array.isArray(s.perfiles)) s = clone(VACIO);
    if (!Array.isArray(s.alimentos)) s.alimentos = [];
    if (!Array.isArray(s.recetas)) s.recetas = [];
    ['dias', 'entreno', 'pesos'].forEach(function (k) {
      if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {};
    });
    // Entreno guardado en un formato anterior (sesión fija o semanal) → ejercicio por día con el mismo gasto.
    Object.keys(s.entreno).forEach(function (pid) {
      if (!(s.entreno[pid] && s.entreno[pid].dias)) s.entreno[pid] = D.migrarEntreno(s.entreno[pid]);
    });
    if (!s.perfiles.some(function (p) { return p.id === s.activo; })) {
      s.activo = s.perfiles.length ? s.perfiles[0].id : null;
    }
    return s;
  }
  var state = normalizar(S.load());

  function activo() {
    return state.perfiles.find(function (p) { return p.id === state.activo; }) || null;
  }
  // Variante de la app: 'pwa' (REAL MACROS instalable, config.js la define), o la de siempre (claude.ai o archivo local).
  var CONFIG = window.APP_CONFIG || {};
  var ES_PWA = CONFIG.plataforma === 'pwa';

  // ---------- Cálculo de cada día ----------
  var DIAS = D.DIAS;
  var CORTO = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' };
  var LARGO = { lun: 'lunes', mar: 'martes', mie: 'miércoles', jue: 'jueves', vie: 'viernes', sab: 'sábado', dom: 'domingo' };
  var HOY = DIAS[(new Date().getDay() + 6) % 7]; // getDay(): 0 = domingo
  // Cómo es el resto del día sin contar el ejercicio (FAO: un oficinista ronda 1,55).
  var PAL = [
    [1.4, 'Casi todo el día sentado, pocos pasos (≈1,40)'],
    [1.55, 'Normal: oficina o estudio, caminas algo (≈1,55)'],
    [1.7, 'De pie o caminando gran parte del día (≈1,70)']
  ];
  var diaPerfil = HOY; // día que muestra Perfil en modo «según mi ejercicio»

  /** El ejercicio del perfil, siempre en el formato por días. */
  function entrenoDe(p) {
    if (!state.entreno[p.id] || !state.entreno[p.id].dias) state.entreno[p.id] = D.migrarEntreno(state.entreno[p.id]);
    return state.entreno[p.id];
  }
  /** El perfil calculado para un día: con su ejercicio en modo «ejercicio», o el de siempre con factor fijo. */
  function calcDia(p, d) { return C.calcPerfilDia(p, entrenoDe(p), d); }
  function calcSemana(p) { return C.calcSemanaPerfil(p, entrenoDe(p)); }
  function opcionesPal(actual) {
    var ops = PAL.slice();
    if (!ops.some(function (o) { return o[0] === actual; })) ops.push([actual, 'Otro: ≈' + fmtUp(actual, 2)]);
    return ops.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === actual ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }

  var localOk = true;
  function persist() {
    localOk = S.save(state);
    pintarSync(S.estado());
    return localOk;
  }

  /** Texto del estado del guardado: en la cabecera, en el formulario del perfil y en «Tus datos». */
  function pintarSync(e) {
    var tipo = 'ok';
    var texto;
    if (!localOk) { tipo = 'bad'; texto = 'No se pudo guardar: el navegador bloquea el almacenamiento'; }
    else if (e.fase === 'local' && ES_PWA) { tipo = 'ok'; texto = 'Guardado en este dispositivo'; }
    else if (e.fase === 'local') { tipo = 'local'; texto = 'Guardado en este navegador'; }
    else if (e.fase === 'conectando') { tipo = 'wait'; texto = 'Conectando con tu nube…'; }
    else if (e.fase === 'guardando') { tipo = 'wait'; texto = 'Guardando en tu nube…'; }
    else if (e.fase === 'listo') { tipo = 'ok'; texto = 'Sincronizado'; }
    else { tipo = 'bad'; texto = e.mensaje || 'Sin conexión con la nube'; }
    var pill = $('sync-estado');
    pill.className = 'sync sync-' + tipo;
    pill.textContent = ES_PWA && e.fase === 'local' && localOk ? 'En este dispositivo'
      : tipo === 'ok' ? 'Sincronizado' : tipo === 'wait' ? 'Guardando…' : tipo === 'local' ? 'Solo este navegador' : 'Sin sincronizar';
    pill.title = texto;
    var el = $('save-status');
    el.textContent = texto;
    el.classList.toggle('is-bad', tipo === 'bad');
    $('datos-donde').textContent = e.modo === 'nube'
      ? 'Tus datos se guardan en tu cuenta de claude.ai y se sincronizan entre tus dispositivos: abre este mismo enlace en el teléfono y verás lo mismo. Solo tú los ves. Estado: ' + texto.charAt(0).toLowerCase() + texto.slice(1) + '.'
      : ES_PWA
        ? 'Tus datos se guardan en este dispositivo, sin cuenta y sin internet; nadie más los ve. Para pasarlos a otro teléfono o computador, o para tener un respaldo, descarga una copia completa e impórtala allá.'
        : 'Tus datos se guardan solo en este navegador. Para usarlos en el teléfono, abre la app publicada en claude.ai, o descarga una copia aquí e impórtala allá.';
  }

  /** Mensaje bajo la barra de la vista abierta. tipo: 'ok' | 'bad'. */
  var avisoTimer = null;
  var CAJAS = { perfil: 'bar-status', alimentos: 'alim-status', recetas: 'rec-status', dia: 'dia-status', semana: 'sem-status', entreno: 'ent-status', peso: 'peso-status' };
  function cajaAviso() { return $(CAJAS[vistaActual] || 'bar-status'); }
  function avisar(tipo, titulo, lista) {
    limpiarAviso();
    var el = cajaAviso();
    clearTimeout(avisoTimer);
    el.className = 'bar-status is-' + tipo;
    el.innerHTML = '<span>' + esc(titulo) + '</span>' +
      (lista && lista.length ? '<ul>' + lista.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '');
    if (tipo === 'ok') avisoTimer = setTimeout(limpiarAviso, 8000);
  }
  function limpiarAviso() {
    Object.keys(CAJAS).forEach(function (k) {
      var id = CAJAS[k];
      var el = $(id);
      el.className = 'bar-status';
      el.innerHTML = '';
    });
  }

  // ---------- Vista general ----------
  function renderTodo() {
    var hay = state.perfiles.length > 0;
    $('empty-state').hidden = hay;
    $('perfil-grid').hidden = !hay;
    $('btn-export-all').disabled = !hay;
    renderPerfiles();
    resetBorrado();
    if (hay) {
      llenarForm(activo());
      actualizar();
    }
  }

  function renderPerfiles() {
    $('profile-chips').innerHTML = state.perfiles.map(function (p) {
      return '<button type="button" class="pchip" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === state.activo) + '">' +
        esc(p.nombre || 'Sin nombre') + '</button>';
    }).join('');
  }

  $('profile-chips').addEventListener('click', function (e) {
    var b = e.target.closest('.pchip');
    if (!b || b.dataset.id === state.activo) return;
    state.activo = b.dataset.id;
    persist();
    renderTodo();
  });

  function crearPerfil() {
    var p = D.perfilNuevo();
    state.perfiles.push(p);
    state.activo = p.id;
    persist();
    limpiarAviso();
    renderTodo();
    $('f-nombre').focus();
  }
  $('btn-add-profile').addEventListener('click', crearPerfil);
  $('btn-empty-add').addEventListener('click', crearPerfil);

  // ---------- Exportar ----------
  function slug(s) {
    return String(s || 'perfil').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'perfil';
  }
  function hoy() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  /**
   * Ofrece un archivo .json para guardar. Publicada en claude.ai usa la capacidad `downloads`
   * (el navegador pide confirmación). Instalada en un teléfono abre el menú de compartir
   * (WhatsApp, Drive, Archivos…). En los demás casos, una descarga normal.
   * Resuelve true si se guardó.
   */
  function descargar(nombreArchivo, obj) {
    var texto = JSON.stringify(obj, null, 2) + '\n';
    var c = window.claude;
    var tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (ES_PWA && tactil && navigator.canShare && typeof File === 'function') {
      try {
        var archivo = new File([texto], nombreArchivo, { type: 'application/json' });
        if (navigator.canShare({ files: [archivo] })) {
          return navigator.share({ files: [archivo], title: nombreArchivo }).then(function () { return true; }, function (err) {
            if (err && err.name === 'AbortError') { avisar('bad', 'Copia cancelada.'); return false; }
            return descargaNormal(nombreArchivo, texto);
          });
        }
      } catch (e) { /* sin compartir archivos: descarga normal */ }
    }
    if (c && typeof c.use === 'function') {
      return c.use('downloads').then(function (dl) {
        if (!dl) { avisar('bad', 'Aquí no se pueden descargar archivos.'); return false; }
        return dl.save({ filename: nombreArchivo, data: texto }).then(function () { return true; }, function (err) {
          var code = err && err.code;
          if (code === 'declined') avisar('bad', 'Descarga cancelada.');
          else if (code === 'rate_limited') avisar('bad', 'Ya hay una descarga esperando tu confirmación.');
          else avisar('bad', 'No se pudo descargar el archivo (' + (code || 'error') + ').');
          return false;
        });
      }, function () { avisar('bad', 'No se pudo descargar el archivo.'); return false; });
    }
    return descargaNormal(nombreArchivo, texto);
  }
  function descargaNormal(nombreArchivo, texto) {
    var blob = new Blob([texto], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return Promise.resolve(true);
  }

  $('btn-export-all').addEventListener('click', function () {
    if (!state.perfiles.length) return;
    var archivo = 'macros-perfiles-' + hoy() + '.json';
    var n = state.perfiles.length;
    descargar(archivo, D.exportar(state, null, ['perfiles', 'dias', 'entreno', 'pesos'])).then(function (ok) {
      if (ok) avisar('ok', 'Exportados ' + n + ' perfiles en «' + archivo + '».');
    });
  });

  $('btn-export-one').addEventListener('click', function () {
    var p = activo();
    if (!p) return;
    var archivo = 'perfil-' + slug(p.nombre) + '.json';
    descargar(archivo, D.exportar({ perfiles: [p], dias: state.dias, entreno: state.entreno, pesos: state.pesos }, null, ['perfiles', 'dias', 'entreno', 'pesos'])).then(function (ok) {
      if (ok) avisar('ok', 'Perfil «' + (p.nombre || 'Sin nombre') + '» exportado en «' + archivo + '».');
    });
  });

  // ---------- Copia de seguridad completa ----------
  $('btn-respaldo').addEventListener('click', function () {
    var archivo = 'macros-respaldo-' + hoy() + '.json';
    function n(x, uno, varios) { return x + ' ' + (x === 1 ? uno : varios); }
    var resumen = n(state.perfiles.length, 'perfil', 'perfiles') + ', ' + n(state.alimentos.length, 'alimento', 'alimentos') + ' y ' + n(state.recetas.length, 'receta', 'recetas');
    descargar(archivo, D.exportar(state)).then(function (ok) {
      if (ok) avisar('ok', 'Copia completa guardada en «' + archivo + '»: ' + resumen + ', con días, entreno y pesos.');
    });
  });
  $('btn-respaldo-importar').addEventListener('click', function () { pedirArchivo(); });

  // ---------- Importar ----------
  var inputArchivo = $('f-importar');
  function pedirArchivo() { inputArchivo.value = ''; inputArchivo.click(); }
  $('btn-import').addEventListener('click', pedirArchivo);
  $('btn-empty-import').addEventListener('click', pedirArchivo);

  inputArchivo.addEventListener('change', function () {
    var file = inputArchivo.files && inputArchivo.files[0];
    if (!file) return;
    var lector = new FileReader();
    lector.onerror = function () { avisar('bad', 'No se pudo leer «' + file.name + '».'); };
    lector.onload = function () {
      var data;
      try {
        data = JSON.parse(String(lector.result).replace(/^﻿/, ''));
      } catch (e) {
        avisar('bad', '«' + file.name + '» no es un archivo de perfil válido (no es JSON).');
        return;
      }
      importarDatos(data, file.name);
    };
    lector.readAsText(file);
  });

  function importarDatos(data, nombreArchivo) {
    var r = D.importar(state, data);
    var nPerfiles = r.agregados.length + r.reemplazados.length;
    var nAlimentos = r.alimentos.agregados.length + r.alimentos.reemplazados.length;
    var nRecetas = r.recetas.agregados.length + r.recetas.reemplazados.length;
    if (nPerfiles + nAlimentos + nRecetas + r.dias.length + r.entreno.length + r.pesos.length === 0) {
      avisar('bad', 'No se importó nada de «' + nombreArchivo + '».', r.errores);
      return;
    }
    state = r.state;
    if (nPerfiles) state.activo = r.ids[0];
    persist();
    renderTodo();
    oyentes.forEach(function (fn) { fn(); });
    var lineas = [];
    function resumen(etiqueta, sec, femenino) {
      var o = femenino ? 'as' : 'os';
      if (sec.agregados.length) lineas.push(etiqueta + ' nuev' + o + ': ' + lista(sec.agregados));
      if (sec.reemplazados.length) lineas.push(etiqueta + ' actualizad' + o + ': ' + lista(sec.reemplazados));
    }
    function lista(xs) { return xs.length > 6 ? xs.length + ' (' + xs.slice(0, 5).join(', ') + '…)' : xs.join(', '); }
    resumen('Perfiles', r);
    resumen('Alimentos', r.alimentos);
    resumen('Recetas', r.recetas, true);
    if (r.dias.length) lineas.push('Días: ' + r.dias.join('; '));
    if (r.entreno.length) lineas.push('Entreno: ' + r.entreno.join('; '));
    if (r.pesos.length) lineas.push('Pesos: ' + r.pesos.join('; '));
    r.errores.forEach(function (e) { lineas.push('Omitido: ' + e); });
    avisar(r.errores.length ? 'bad' : 'ok', 'Importado desde «' + nombreArchivo + '».', lineas);
  }

  // ---------- Eliminar (en dos pasos: los diálogos confirm() no funcionan en la app publicada) ----------
  var borradoTimer = null;
  function resetBorrado() {
    clearTimeout(borradoTimer);
    $('danger-zone').innerHTML = '<button type="button" class="btn btn-text" id="btn-del">Eliminar perfil</button>';
  }
  $('danger-zone').addEventListener('click', function (e) {
    var id = e.target.id;
    var p = activo();
    if (!p) return;
    if (id === 'btn-del') {
      $('danger-zone').innerHTML =
        '<button type="button" class="btn btn-danger" id="btn-del-ok">Eliminar «' + esc(p.nombre || 'Sin nombre') + '»</button>' +
        '<button type="button" class="btn" id="btn-del-no">Cancelar</button>';
      $('btn-del-no').focus();
      borradoTimer = setTimeout(resetBorrado, 6000);
    } else if (id === 'btn-del-no') {
      resetBorrado();
    } else if (id === 'btn-del-ok') {
      state.perfiles = state.perfiles.filter(function (x) { return x.id !== p.id; });
      delete state.dias[p.id];
      delete state.entreno[p.id];
      delete state.pesos[p.id];
      state.activo = state.perfiles.length ? state.perfiles[0].id : null;
      persist();
      renderTodo();
      avisar('ok', 'Perfil «' + (p.nombre || 'Sin nombre') + '» eliminado. Si lo exportaste antes, puedes volver a importarlo.');
    }
  });

  // ---------- Formulario ----------
  var form = $('perfil-form');
  var selFactor = $('f-factor');
  selFactor.innerHTML = C.FACTORES.map(function (f) {
    return '<option value="' + f.valor + '">' + f.nombre + ' · ' + fmtUp(f.valor, 3) + ' — ' + f.detalle + '</option>';
  }).join('') + '<option value="otro">Otro factor…</option>';

  function setRadio(name, value) {
    var r = form.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (r) r.checked = true;
  }
  function getRadio(name) {
    var r = form.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : null;
  }

  function llenarForm(p) {
    $('f-nombre').value = p.nombre || '';
    setRadio('sexo', p.sexo === 'm' ? 'm' : 'h');
    $('f-peso').value = fmtIn(p.peso, 2);
    $('f-altura').value = fmtIn(p.altura, 1);
    $('f-edad').value = fmtIn(p.edad, 0);

    var enLista = C.FACTORES.some(function (f) { return f.valor === p.factor; });
    selFactor.value = enLista ? String(p.factor) : 'otro';
    $('f-factor-custom').value = enLista ? '' : fmtIn(p.factor, 3);
    $('factor-custom-wrap').hidden = enLista;
    setRadio('modoGasto', p.modo === 'ejercicio' ? 'ejercicio' : 'factor');
    $('f-pal').innerHTML = opcionesPal(entrenoDe(p).palBase);
    mostrarCamposGasto();

    var modo = p.ajuste < 0 ? 'deficit' : p.ajuste > 0 ? 'superavit' : 'mantener';
    setRadio('modo', modo);
    $('f-ajuste').value = p.ajuste === 0 ? '' : fmtIn(Math.abs(p.ajuste), 0);
    $('f-ajuste').disabled = modo === 'mantener';

    $('f-prot').value = fmtIn(p.protGkg, 2);
    $('f-grasa').value = fmtIn(p.grasaPct, 1);
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }

  /**
   * Lee el formulario. Un campo vacío queda en NaN sin marcarse;
   * uno con un valor que no sirve queda en NaN y se marca en rojo.
   */
  function leerForm() {
    function num(id, cond) {
      var el = $(id);
      var vacio = el.value.trim() === '';
      var v = D.num(el.value);
      var valido = ok(v) && (!cond || cond(v));
      if (valido || vacio) el.removeAttribute('aria-invalid'); else el.setAttribute('aria-invalid', 'true');
      return valido ? v : NaN;
    }
    function enRango(k) {
      var lim = D.LIMITES[k];
      return function (v) { return v >= lim.min && v <= lim.max; };
    }
    var factor;
    if (selFactor.value === 'otro') {
      factor = num('f-factor-custom', enRango('factor'));
    } else {
      $('f-factor-custom').removeAttribute('aria-invalid');
      factor = parseFloat(selFactor.value);
    }
    var modo = getRadio('modo');
    var ajuste = 0;
    if (modo !== 'mantener') {
      var cant = num('f-ajuste', function (v) { return v >= 0 && v <= D.LIMITES.ajuste.max; });
      ajuste = modo === 'deficit' ? -cant : cant;
    } else {
      $('f-ajuste').removeAttribute('aria-invalid');
    }
    return {
      nombre: $('f-nombre').value.trim(),
      sexo: getRadio('sexo') === 'm' ? 'm' : 'h',
      modo: getRadio('modoGasto') === 'ejercicio' ? 'ejercicio' : 'factor',
      peso: num('f-peso', enRango('peso')),
      altura: num('f-altura', enRango('altura')),
      edad: num('f-edad', enRango('edad')),
      factor: factor,
      ajuste: ajuste,
      protGkg: num('f-prot', enRango('protGkg')),
      grasaPct: num('f-grasa', enRango('grasaPct'))
    };
  }

  /** Copia al perfil los campos válidos; un campo que se vacía queda vacío. Luego guarda. */
  function guardarBorrador(b) {
    var p = activo();
    if (!p) return;
    var nombreCambio = p.nombre !== b.nombre;
    var vacios = { peso: 'f-peso', altura: 'f-altura', edad: 'f-edad' };
    Object.keys(b).forEach(function (k) {
      if (typeof b[k] === 'number' && !ok(b[k])) {
        if (vacios[k] && $(vacios[k]).value.trim() === '') p[k] = null;
        return;
      }
      p[k] = b[k];
    });
    persist();
    if (nombreCambio) renderPerfiles();
  }

  function actualizar() {
    var b = leerForm();
    renderResultados(b);
    return b;
  }

  form.addEventListener('input', function () { guardarBorrador(actualizar()); });
  form.addEventListener('change', function (e) {
    if (e.target === selFactor) {
      var otro = selFactor.value === 'otro';
      $('factor-custom-wrap').hidden = !otro;
      if (otro) {
        if (!$('f-factor-custom').value) $('f-factor-custom').value = fmtIn(activo().factor, 3);
        $('f-factor-custom').focus();
      }
    }
    if (e.target.name === 'modoGasto') mostrarCamposGasto();
    if (e.target.id === 'f-pal' && activo()) {
      entrenoDe(activo()).palBase = parseFloat($('f-pal').value);
    }
    if (e.target.name === 'modo') {
      var mant = getRadio('modo') === 'mantener';
      $('f-ajuste').disabled = mant;
      if (!mant && !$('f-ajuste').value) $('f-ajuste').value = '300';
    }
    guardarBorrador(actualizar());
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  function mostrarCamposGasto() {
    var ejercicio = getRadio('modoGasto') === 'ejercicio';
    $('campo-factor').hidden = ejercicio;
    $('campo-pal').hidden = !ejercicio;
  }

  $('res-semana').addEventListener('click', function (e) {
    var b = e.target.closest('.dia-chip');
    if (!b) return;
    diaPerfil = b.dataset.dia;
    actualizar();
  });

  form.querySelector('.presets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-preset]');
    if (!b) return;
    setRadio('modo', 'deficit');
    $('f-ajuste').disabled = false;
    $('f-ajuste').value = b.dataset.preset;
    guardarBorrador(actualizar());
  });

  // ---------- Resultados ----------
  var NOMBRE_CAMPO = { peso: 'peso', altura: 'altura', edad: 'edad', factor: 'factor de actividad', ajuste: 'kcal del objetivo', protGkg: 'proteína', grasaPct: 'grasa', palBase: 'resto del día' };

  function renderResultados(p) {
    // p es el borrador del formulario (sin id): el ejercicio sale del perfil activo.
    var real = activo();
    var ent = real ? entrenoDe(real) : null;
    var r = C.calcPerfilDia(p, ent, diaPerfil);
    var porDia = p.modo === 'ejercicio';
    $('res-nombre').textContent = p.nombre || 'Sin nombre';
    $('res-cuando').textContent = porDia ? 'Objetivo del ' + LARGO[diaPerfil] + (diaPerfil === HOY ? ' (hoy)' : '') : 'Objetivo diario';
    var semana = $('res-semana');
    semana.hidden = !porDia;
    if (porDia && real) {
      semana.innerHTML = DIAS.map(function (d) {
        var rd = C.calcPerfilDia(p, ent, d);
        return '<button type="button" class="dia-chip' + (d === HOY ? ' es-hoy' : '') + '" data-dia="' + d + '" aria-pressed="' + (d === diaPerfil) + '">' +
          '<span>' + CORTO[d] + '</span><small>' + (rd.valido ? fmt(rd.objetivo, 0) : '—') + '</small></button>';
      }).join('');
    }

    var hintProt = $('hint-prot');
    hintProt.textContent = ok(p.protGkg) && ok(p.peso)
      ? fmtUp(p.protGkg * p.peso, 1) + ' g al día · rango 1,6–2,2'
      : 'Rango 1,6–2,2';
    hintProt.classList.toggle('is-off', ok(p.protGkg) && (p.protGkg < C.RANGOS.protGkg.min || p.protGkg > C.RANGOS.protGkg.max));
    $('hint-grasa').classList.toggle('is-off', ok(p.grasaPct) && (p.grasaPct < C.RANGOS.grasaPct.min || p.grasaPct > C.RANGOS.grasaPct.max));

    if (!r.valido) {
      ['objetivo', 'tmb', 'tdee', 'imc', 'prot-g', 'prot-kcal', 'prot-pct', 'grasa-g', 'grasa-kcal', 'grasa-pct', 'carbs-g', 'carbs-kcal', 'carbs-pct']
        .forEach(function (k) { $('res-' + k).textContent = '—'; });
      $('res-imc-cat').textContent = '';
      $('res-sub').textContent = 'Falta: ' + r.faltan.map(function (k) { return NOMBRE_CAMPO[k]; }).join(', ') + '.';
      $('res-avisos').innerHTML = '';
      $('res-guias').innerHTML = '<li class="guia-vacia">Completa el perfil para revisarlo.</li>';
      $('res-formula').innerHTML = '';
      setSplit(0, 0, 0);
      return;
    }
    var m = r.macros;
    $('res-objetivo').textContent = fmt(r.objetivo, 0);
    var aj = p.ajuste;
    var gasto = r.modo === 'ejercicio'
      ? 'Gasto ' + fmt(r.tdee, 0) + (r.kcalEjercicio > 0 ? ' (base ' + fmt(r.tdee - r.kcalEjercicio, 0) + ' + ejercicio ' + fmt(r.kcalEjercicio, 0) + ')' : ' (sin ejercicio)')
      : 'TDEE ' + fmt(r.tdee, 0);
    $('res-sub').textContent = gasto + (aj < 0 ? ' − ' + fmt(-aj, 0) + ' de déficit' : aj > 0 ? ' + ' + fmt(aj, 0) + ' de superávit' : ' · mantenimiento');

    ['prot', 'grasa', 'carbs'].forEach(function (k) {
      $('res-' + k + '-g').textContent = fmt(m[k].g, 0);
      $('res-' + k + '-kcal').textContent = fmt(m[k].kcal, 0);
      $('res-' + k + '-pct').textContent = fmtUp(m[k].pct, 1) + ' %';
    });
    setSplit(m.prot.kcal, m.grasa.kcal, m.carbs.kcal);

    $('res-tmb').textContent = fmt(r.tmb, 0);
    $('res-tdee').textContent = fmt(r.tdee, 0);
    $('res-imc').textContent = fmtUp(r.imc, 1);
    $('res-imc-cat').textContent = r.imcCat;

    $('res-avisos').innerHTML = r.avisos.map(function (a) {
      return '<li class="aviso aviso-' + a.nivel + '">' + esc(a.texto) + '</li>';
    }).join('');

    renderGuias(p, r);
    renderFormula(p, r);
  }

  var ETIQUETA_ESTADO = { ok: 'Bien', warn: 'Revisar', info: 'Ojo' };
  function renderGuias(p, r) {
    $('res-guias').innerHTML = C.chequeoGuias(p, r).map(function (g) {
      return '<li class="guia guia-' + g.estado + '">' +
        '<span class="pill pill-' + g.estado + '">' + ETIQUETA_ESTADO[g.estado] + '</span>' +
        '<div class="guia-body">' +
          '<p class="guia-head"><b>' + esc(g.titulo) + '</b> <span class="guia-valor">' + esc(g.valor) + '</span></p>' +
          '<p class="guia-ref">Guía: ' + esc(g.guia) + '</p>' +
          '<p class="guia-nota">' + esc(g.nota) + '</p>' +
          '<p class="guia-fuente">' + esc(g.fuente) + '</p>' +
        '</div></li>';
    }).join('');
  }

  function setSplit(a, b, c) {
    var segs = $('res-split').children;
    [a, b, c].forEach(function (v, i) {
      segs[i].style.flex = '0 0 auto';
      segs[i].style.flexBasis = '0';
      segs[i].style.flexGrow = String(Math.max(0, v));
    });
  }

  function renderFormula(p, r) {
    var m = r.macros;
    var cte = p.sexo === 'm' ? '− 161' : '+ 5';
    var aj = p.ajuste;
    var ajTxt = aj < 0 ? '− ' + fmtUp(-aj, 2) : '+ ' + fmtUp(aj, 2);
    var filas = [
      ['TMB · Mifflin-St Jeor (' + (p.sexo === 'm' ? 'mujer' : 'hombre') + ')',
        '10 × ' + fmtUp(p.peso) + ' + 6,25 × ' + fmtUp(p.altura) + ' − 5 × ' + fmtUp(p.edad) + ' ' + cte + ' = <b>' + fmtUp(r.tmb, 2) + '</b>'],
      r.modo === 'ejercicio'
        ? ['Gasto del ' + LARGO[diaPerfil],
          fmtUp(r.tmb, 2) + ' × ' + fmtUp(r.palBase, 3) + ' + ' + fmtUp(r.kcalEjercicio, 2) + ' de ejercicio = <b>' + fmtUp(r.tdee, 2) + '</b>']
        : ['TDEE',
          fmtUp(r.tmb, 2) + ' × ' + fmtUp(p.factor, 3) + ' = <b>' + fmtUp(r.tdee, 2) + '</b>'],
      ['Objetivo',
        fmtUp(r.tdee, 2) + ' ' + ajTxt + ' = <b>' + fmtUp(r.objetivo, 2) + ' kcal</b>'],
      ['Proteína',
        fmtUp(p.protGkg) + ' g/kg × ' + fmtUp(p.peso) + ' kg = <b>' + fmtUp(m.prot.g, 2) + ' g</b> × 4 = ' + fmtUp(m.prot.kcal, 2) + ' kcal'],
      ['Grasa',
        fmtUp(r.objetivo, 2) + ' × ' + fmtUp(p.grasaPct, 1) + ' % = ' + fmtUp(m.grasa.kcal, 2) + ' kcal ÷ 9 = <b>' + fmtUp(m.grasa.g, 2) + ' g</b>'],
      ['Carbohidratos',
        '(' + fmtUp(r.objetivo, 2) + ' − ' + fmtUp(m.prot.kcal, 2) + ' − ' + fmtUp(m.grasa.kcal, 2) + ') = ' + fmtUp(m.carbs.kcal, 2) + ' kcal ÷ 4 = <b>' + fmtUp(m.carbs.g, 2) + ' g</b>'],
      ['IMC',
        fmtUp(p.peso) + ' ÷ ' + fmtUp(p.altura / 100, 2) + '² = <b>' + fmtUp(r.imc, 1) + '</b>']
    ];
    $('res-formula').innerHTML = filas.map(function (f) {
      return '<li><span class="f-label">' + esc(f[0]) + '</span><code>' + f[1] + '</code></li>';
    }).join('');
  }

  // ---------- Navegación entre vistas (#perfil, #alimentos) ----------
  var VISTAS = ['perfil', 'alimentos', 'recetas', 'dia', 'semana', 'entreno', 'peso'];
  var PESTANA = { perfil: 'perfil', alimentos: 'alimentos', recetas: 'alimentos', dia: 'dia', semana: 'semana', entreno: 'entreno', peso: 'peso' };
  var vistaActual = 'perfil';
  var oyentes = [];   // otras pantallas que se redibujan tras importar
  var alMostrar = { perfil: function () { renderTodo(); } }; // vista → función que se llama al abrirla
  function mostrarVista() {
    var v = (location.hash || '').replace('#', '');
    if (VISTAS.indexOf(v) < 0) v = 'perfil';
    vistaActual = v;
    VISTAS.forEach(function (n) { $('vista-' + n).hidden = n !== v; });
    document.querySelectorAll('.tab[data-vista]').forEach(function (t) {
      if (t.dataset.vista === PESTANA[v]) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    limpiarAviso();
    if (alMostrar[v]) alMostrar[v]();
  }
  window.addEventListener('hashchange', mostrarVista);

  function normal(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  /**
   * Campo de búsqueda con sugerencias (alimentos, recetas, actividades).
   * opciones() → [{ id, tipo, nombre, etiqueta, detalle }]; alElegir(opcion).
   * conf (opcional): filtrar(q) → opciones ya filtradas y ordenadas (en vez de buscar por nombre);
   * alFinal(q) → una opción extra al final de la lista (por ejemplo, «agregar como propia»).
   * Flechas para moverse, Enter elige, Escape cierra.
   */
  function buscador(input, lista, opciones, alElegir, conf) {
    conf = conf || {};
    var actuales = [];
    var marcada = 0;
    function cerrar() {
      actuales = [];
      lista.innerHTML = '';
      lista.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }
    function pintar() {
      lista.innerHTML = actuales.map(function (o, i) {
        return '<li role="option" id="' + lista.id + '-' + i + '" aria-selected="' + (i === marcada) + '">' +
          '<button type="button" tabindex="-1" data-i="' + i + '">' +
          '<span class="sug-nombre">' + esc(o.nombre) + (o.etiqueta ? ' <span class="sug-tag">' + esc(o.etiqueta) + '</span>' : '') + '</span>' +
          '<span class="sug-detalle">' + esc(o.detalle || '') + '</span></button></li>';
      }).join('');
      lista.hidden = actuales.length === 0;
      input.setAttribute('aria-expanded', String(!lista.hidden));
      if (actuales.length) input.setAttribute('aria-activedescendant', lista.id + '-' + marcada);
      else input.removeAttribute('aria-activedescendant');
    }
    function buscar() {
      var q = normal(input.value);
      if (!q) { cerrar(); return; }
      actuales = conf.filtrar ? conf.filtrar(input.value.trim()) : opciones()
        .filter(function (o) { return normal(o.nombre).indexOf(q) >= 0; })
        .sort(function (a, b) {
          return normal(a.nombre).indexOf(q) - normal(b.nombre).indexOf(q) || normal(a.nombre).localeCompare(normal(b.nombre), 'es');
        })
        .slice(0, 8);
      var extra = conf.alFinal ? conf.alFinal(input.value.trim()) : null;
      if (extra) actuales = actuales.concat([extra]);
      marcada = 0;
      pintar();
    }
    function elegir(i) {
      var o = actuales[i];
      if (!o) return;
      input.value = '';
      cerrar();
      alElegir(o);
    }
    input.addEventListener('input', buscar);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' && actuales.length) { e.preventDefault(); marcada = (marcada + 1) % actuales.length; pintar(); }
      else if (e.key === 'ArrowUp' && actuales.length) { e.preventDefault(); marcada = (marcada - 1 + actuales.length) % actuales.length; pintar(); }
      else if (e.key === 'Enter') { e.preventDefault(); elegir(marcada); }
      else if (e.key === 'Escape') { cerrar(); }
    });
    lista.addEventListener('mousedown', function (e) { e.preventDefault(); }); // no quitar el foco del campo
    lista.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-i]');
      if (b) elegir(Number(b.dataset.i));
    });
    input.addEventListener('blur', function () { setTimeout(cerrar, 150); });
    return { cerrar: cerrar };
  }

  /** Opciones para el buscador: alimentos (y recetas si se pide). */
  function opcionesBiblioteca(conRecetas) {
    var al = C.indexar(state.alimentos);
    var out = state.alimentos.map(function (a) {
      var p = C.revisarAlimento(a).por100;
      return { id: a.id, tipo: 'alimento', nombre: a.nombre, detalle: fmt(p.kcal, 0) + ' kcal/100 g · P ' + fmtUp(p.prot, 1) };
    });
    if (conRecetas) {
      state.recetas.forEach(function (r) {
        var t = C.totalReceta(r, al);
        out.push({ id: r.id, tipo: 'receta', nombre: r.nombre, etiqueta: 'receta', detalle: fmt(t.peso, 0) + ' g · ' + fmt(t.total.kcal, 0) + ' kcal en total' });
      });
    }
    return out;
  }

  // Lo que comparten las demás pantallas (alimentos.js, recetas.js, dia.js).
  window.App = {
    getState: function () { return state; },
    entrenoDe: entrenoDe,
    calcDia: calcDia,
    calcSemana: calcSemana,
    opcionesPal: opcionesPal,
    DIAS_INFO: { corto: CORTO, largo: LARGO, hoy: HOY },
    activo: activo,
    setActivo: function (id) { state.activo = id; persist(); },
    /** Cambia campos de un perfil (p. ej. factor o peso) y guarda. Devuelve los valores anteriores para deshacer. */
    cambiarPerfil: function (id, cambios) {
      var p = state.perfiles.find(function (x) { return x.id === id; });
      if (!p) return null;
      var antes = {};
      Object.keys(cambios).forEach(function (k) { antes[k] = p[k]; p[k] = cambios[k]; });
      persist();
      return antes;
    },
    normal: normal,
    buscador: buscador,
    opcionesBiblioteca: opcionesBiblioteca,
    persist: persist,
    avisar: avisar,
    limpiarAviso: limpiarAviso,
    descargar: descargar,
    hoy: hoy,
    pedirArchivo: pedirArchivo,
    fmt: fmt, fmtUp: fmtUp, fmtIn: fmtIn, esc: esc, ok: ok,
    alImportar: function (fn) { oyentes.push(fn); },
    alMostrar: function (vista, fn) { alMostrar[vista] = fn; },
    arrancar: function () {
      mostrarVista();
      S.alCambiarEstado(pintarSync);
      S.conectar({
        obtener: function () { return state; },
        aplicar: function (secciones) {
          Object.keys(secciones).forEach(function (sec) { S.aplicarSeccion(state, sec, secciones[sec]); });
          state = normalizar(state);
          persist();
          renderTodo();
          oyentes.forEach(function (fn) { fn(); });
          if (alMostrar[vistaActual]) alMostrar[vistaActual]();
        }
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') S.vaciar();
      });
    }
  };

  // ---------- Inicio ----------
  renderTodo();
  if (state.perfiles.length) persist(); else pintarSync(S.estado());
})();
