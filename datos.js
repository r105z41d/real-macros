/*
 * Datos de Macros Lobo: perfiles nuevos, validación, exportar e importar.
 * Funciones puras (sin DOM) para probarlas con `node --test`.
 * Se carga igual en el navegador (window.Datos) y en Node (require).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Datos = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var APP = 'macros-lobo';
  var FORMATO = 1;

  // Rangos aceptados al importar. Sirven para atrapar errores de unidad (p. ej. altura 1,69 en vez de 169).
  var LIMITES = {
    peso: { min: 20, max: 400, nombre: 'Peso (kg)' },
    altura: { min: 80, max: 250, nombre: 'Altura (cm)' },
    edad: { min: 10, max: 110, nombre: 'Edad' },
    factor: { min: 1, max: 2.5, nombre: 'Factor de actividad' },
    ajuste: { min: -2000, max: 2000, nombre: 'Ajuste (kcal)' },
    protGkg: { min: 0, max: 5, nombre: 'Proteína (g/kg)' },
    grasaPct: { min: 0, max: 100, nombre: 'Grasa (%)' }
  };
  // Medidas que un perfil recién creado puede tener vacías.
  var OPCIONALES = ['peso', 'altura', 'edad'];
  var POR_DEFECTO = { factor: 1.55, ajuste: -300, protGkg: 2, grasaPct: 30 };

  /** Acepta números y textos como "2,2" o "2.2". Cualquier otra cosa → NaN. */
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (typeof v !== 'string') return NaN;
    var s = v.trim().replace(/\s+/g, '').replace(',', '.');
    return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(s) ? parseFloat(s) : NaN;
  }

  var contador = 0;
  function nuevoId() {
    contador += 1;
    return 'p' + Date.now().toString(36) + contador.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /**
   * Un id que viene de un archivo se usa como clave de objetos (días, entreno y pesos por perfil).
   * Solo se aceptan letras, números y . _ : - (hasta 80), y nunca un nombre que los objetos de
   * JavaScript ya traen (__proto__, constructor, toString…): con esos, un archivo modificado
   * podría alterar el funcionamiento de toda la app.
   */
  function idSeguro(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(id) && !(id in Object.prototype) && id !== 'prototype';
  }
  /** El id del archivo si es seguro; si no, uno nuevo. */
  function idOGenerar(id) {
    var t = typeof id === 'string' ? id.trim() : '';
    return idSeguro(t) ? t : nuevoId();
  }
  function propio(obj, clave) { return Object.prototype.hasOwnProperty.call(obj, clave); }

  /** Perfil nuevo: medidas vacías para que la persona las llene; el resto con valores de partida. */
  function perfilNuevo() {
    return {
      id: nuevoId(), nombre: '', sexo: 'h', modo: 'factor', peso: null, altura: null, edad: null,
      factor: POR_DEFECTO.factor, ajuste: POR_DEFECTO.ajuste, protGkg: POR_DEFECTO.protGkg, grasaPct: POR_DEFECTO.grasaPct
    };
  }

  /**
   * Revisa y normaliza un perfil que viene de un archivo.
   * Devuelve { ok: true, perfil } o { ok: false, error }.
   */
  function validarPerfil(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'No es un perfil.' };
    }
    var nombre = typeof raw.nombre === 'string' ? raw.nombre.trim().slice(0, 30) : '';
    if (!nombre) return { ok: false, error: 'Un perfil no tiene nombre.' };

    var sexo = raw.sexo === 'm' || raw.sexo === 'h' ? raw.sexo : null;
    if (!sexo) return { ok: false, error: '«' + nombre + '»: el sexo debe ser "h" (hombre) o "m" (mujer).' };

    // modo: 'factor' = gasto fijo (TMB × factor); 'ejercicio' = cada día con su ejercicio (pestaña Entreno).
    var p = { id: idOGenerar(raw.id), nombre: nombre, sexo: sexo, modo: raw.modo === 'ejercicio' ? 'ejercicio' : 'factor' };
    var campos = Object.keys(LIMITES);
    for (var i = 0; i < campos.length; i++) {
      var k = campos[i];
      var lim = LIMITES[k];
      var vacio = raw[k] === undefined || raw[k] === null || raw[k] === '';
      if (vacio) {
        if (OPCIONALES.indexOf(k) >= 0) { p[k] = null; continue; }
        p[k] = POR_DEFECTO[k];
        continue;
      }
      var v = num(raw[k]);
      if (!isFinite(v)) return { ok: false, error: '«' + nombre + '»: ' + lim.nombre + ' no es un número.' };
      if (v < lim.min || v > lim.max) {
        return { ok: false, error: '«' + nombre + '»: ' + lim.nombre + ' = ' + v + ' está fuera del rango ' + lim.min + '–' + lim.max + '.' };
      }
      p[k] = v;
    }
    return { ok: true, perfil: p };
  }

  // ---------- Alimentos ----------
  var LIMITES_ALIMENTO = {
    base: { min: 0.1, max: 5000, nombre: 'Gramaje base' },
    kcal: { min: 0, max: 45000, nombre: 'kcal' },
    prot: { min: 0, max: 5000, nombre: 'Proteína' },
    carbs: { min: 0, max: 5000, nombre: 'Carbohidratos' },
    grasa: { min: 0, max: 5000, nombre: 'Grasa' }
  };

  /**
   * Revisa y normaliza un alimento. Los valores son por `base` gramos (100 g o la porción de la etiqueta).
   * Devuelve { ok: true, alimento } o { ok: false, error }.
   */
  function validarAlimento(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'No es un alimento.' };
    var nombre = typeof raw.nombre === 'string' ? raw.nombre.trim().slice(0, 60) : '';
    if (!nombre) return { ok: false, error: 'Un alimento no tiene nombre.' };
    var a = { id: idOGenerar(raw.id), nombre: nombre };
    var campos = Object.keys(LIMITES_ALIMENTO);
    for (var i = 0; i < campos.length; i++) {
      var k = campos[i];
      var lim = LIMITES_ALIMENTO[k];
      var vacio = raw[k] === undefined || raw[k] === null || raw[k] === '';
      var v = vacio ? (k === 'base' ? 100 : k === 'kcal' ? NaN : 0) : num(raw[k]);
      if (!isFinite(v)) return { ok: false, error: '«' + nombre + '»: ' + lim.nombre + (vacio ? ' es obligatorio.' : ' no es un número.') };
      if (v < lim.min || v > lim.max) return { ok: false, error: '«' + nombre + '»: ' + lim.nombre + ' está fuera de rango.' };
      a[k] = v;
    }
    var f = 100 / a.base;
    if (a.kcal * f > 950) return { ok: false, error: '«' + nombre + '»: más de 950 kcal por 100 g no es posible (el aceite puro tiene 900).' };
    var suma = (a.prot + a.carbs + a.grasa) * f;
    if (suma > 102) return { ok: false, error: '«' + nombre + '»: proteína + carbos + grasa pesan más que el alimento.' };
    a.fuente = typeof raw.fuente === 'string' ? raw.fuente.trim().slice(0, 80) : '';
    a.nota = typeof raw.nota === 'string' ? raw.nota.trim().slice(0, 200) : '';
    return { ok: true, alimento: a };
  }

  // ---------- Recetas y días (paso 3) ----------
  var DIAS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

  function gramosValidos(v) { return isFinite(v) && v >= 0 && v <= 5000; }

  /**
   * Receta: { id, nombre, ingredientes: [{ ref: id de alimento, gramos }], pesoTotal (opcional), nota }.
   * pesoTotal = lo que pesa la preparación ya lista (olla completa); si falta, vale la suma de ingredientes.
   */
  function validarReceta(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'No es una receta.' };
    var nombre = typeof raw.nombre === 'string' ? raw.nombre.trim().slice(0, 60) : '';
    if (!nombre) return { ok: false, error: 'Una receta no tiene nombre.' };
    if (!Array.isArray(raw.ingredientes) || raw.ingredientes.length === 0) {
      return { ok: false, error: 'Receta «' + nombre + '»: no tiene ingredientes.' };
    }
    var ingredientes = [];
    for (var i = 0; i < raw.ingredientes.length; i++) {
      var ing = raw.ingredientes[i] || {};
      var g = num(ing.gramos);
      if (typeof ing.ref !== 'string' || !idSeguro(ing.ref.trim())) return { ok: false, error: 'Receta «' + nombre + '»: un ingrediente no dice qué alimento es.' };
      if (!gramosValidos(g)) return { ok: false, error: 'Receta «' + nombre + '»: gramos inválidos en un ingrediente.' };
      ingredientes.push({ ref: ing.ref.trim(), gramos: g });
    }
    var pesoTotal = null;
    if (raw.pesoTotal !== undefined && raw.pesoTotal !== null && raw.pesoTotal !== '') {
      pesoTotal = num(raw.pesoTotal);
      if (!isFinite(pesoTotal) || pesoTotal <= 0 || pesoTotal > 50000) {
        return { ok: false, error: 'Receta «' + nombre + '»: el peso de la preparación lista debe ser mayor que 0 g.' };
      }
    }
    return {
      ok: true,
      receta: {
        id: idOGenerar(raw.id),
        nombre: nombre,
        ingredientes: ingredientes,
        pesoTotal: pesoTotal,
        nota: typeof raw.nota === 'string' ? raw.nota.trim().slice(0, 200) : ''
      }
    };
  }

  /** Línea del día: { id, tipo: 'alimento' | 'receta', ref, gramos }. */
  function validarItemDia(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Línea del día inválida.' };
    if (raw.tipo !== 'alimento' && raw.tipo !== 'receta') return { ok: false, error: 'Línea del día sin tipo (alimento o receta).' };
    if (typeof raw.ref !== 'string' || !idSeguro(raw.ref.trim())) return { ok: false, error: 'Línea del día sin alimento.' };
    var g = num(raw.gramos);
    if (!gramosValidos(g)) return { ok: false, error: 'Línea del día con gramos inválidos.' };
    return {
      ok: true,
      item: { id: idOGenerar(raw.id), tipo: raw.tipo, ref: raw.ref.trim(), gramos: g }
    };
  }

  // ---------- Entreno: el ejercicio de cada día ----------
  // entreno[idPerfil] = { palBase, dias: { lun: [{ id, nombre, codigo, met, minutos, nota }], ..., dom: [...] } }
  //   minutos = de ese día; nota = detalle libre («11 rounds de 3 min»); codigo = del Compendio ('' si es propia).
  //   palBase = cómo es el resto del día sin contar el ejercicio (FAO: oficina ≈ 1,55).
  var PAL_BASE = 1.55;
  var LIMITES_ACT = {
    met: [1, 25, 'MET'], minutos: [0, 600, 'Minutos']
  };

  /** Una actividad de un día. */
  function validarActividad(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Actividad inválida.' };
    var nombre = typeof raw.nombre === 'string' ? raw.nombre.trim().slice(0, 80) : '';
    if (!nombre) return { ok: false, error: 'Una actividad no tiene nombre.' };
    var act = {
      id: idOGenerar(raw.id),
      nombre: nombre,
      codigo: typeof raw.codigo === 'string' ? raw.codigo.trim().slice(0, 10) : ''
    };
    var claves = Object.keys(LIMITES_ACT);
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      var lim = LIMITES_ACT[k];
      var v = num(raw[k]);
      if (!isFinite(v) || v < lim[0] || v > lim[1]) {
        return { ok: false, error: '«' + nombre + '»: ' + lim[2] + ' debe estar entre ' + lim[0] + ' y ' + lim[1] + '.' };
      }
      act[k] = v;
    }
    act.nota = typeof raw.nota === 'string' ? raw.nota.trim().slice(0, 80) : '';
    if (raw.rounds != null) {
      var r = validarRounds(raw.rounds, nombre);
      if (!r.ok) return r;
      act.rounds = r.rounds;
      act.minutos = r.rounds.n * r.rounds.min; // los minutos de la actividad salen de los rounds
    }
    return { ok: true, actividad: act };
  }

  // Por rounds: n rounds de `min` minutos, cada uno seguido de un descanso de `descanso` minutos.
  var LIMITES_ROUNDS = {
    n: [1, 50, 'Rounds'], min: [0.5, 20, 'Minutos por round'], descanso: [0, 10, 'Minutos de descanso']
  };
  var MAX_REPS = 999;

  /** Lo que se hizo en un descanso: { nombre, codigo, met, reps } o null (descanso sin ejercicio). */
  function validarEjercicioDescanso(raw) {
    if (raw == null || raw === '') return { ok: true, ejercicio: null };
    if (typeof raw !== 'object') return { ok: false, error: 'Un descanso no es válido.' };
    var nombre = typeof raw.nombre === 'string' ? raw.nombre.trim().slice(0, 60) : '';
    if (!nombre) return { ok: true, ejercicio: null };
    var met = num(raw.met);
    if (!isFinite(met) || met < LIMITES_ACT.met[0] || met > LIMITES_ACT.met[1]) {
      return { ok: false, error: '«' + nombre + '»: MET debe estar entre ' + LIMITES_ACT.met[0] + ' y ' + LIMITES_ACT.met[1] + '.' };
    }
    var reps = null;
    if (raw.reps != null && raw.reps !== '') {
      reps = num(raw.reps);
      if (!isFinite(reps) || reps < 0 || reps > MAX_REPS || Math.round(reps) !== reps) {
        return { ok: false, error: '«' + nombre + '»: las repeticiones deben ser un número entero entre 0 y ' + MAX_REPS + '.' };
      }
    }
    return {
      ok: true,
      ejercicio: { nombre: nombre, codigo: typeof raw.codigo === 'string' ? raw.codigo.trim().slice(0, 10) : '', met: met, reps: reps }
    };
  }

  function validarRounds(raw, nombre) {
    if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: '«' + nombre + '»: los rounds no son válidos.' };
    var r = {};
    var claves = Object.keys(LIMITES_ROUNDS);
    for (var i = 0; i < claves.length; i++) {
      var k = claves[i];
      var lim = LIMITES_ROUNDS[k];
      var v = num(raw[k]);
      if (!isFinite(v) || v < lim[0] || v > lim[1]) {
        return { ok: false, error: '«' + nombre + '»: ' + lim[2] + ' debe estar entre ' + lim[0] + ' y ' + lim[1] + '.' };
      }
      r[k] = v;
    }
    if (Math.round(r.n) !== r.n) return { ok: false, error: '«' + nombre + '»: los rounds deben ser un número entero.' };
    var lista = Array.isArray(raw.ejercicios) ? raw.ejercicios.slice(0, r.n) : [];
    r.ejercicios = [];
    for (var j = 0; j < lista.length; j++) {
      var e = validarEjercicioDescanso(lista[j]);
      if (!e.ok) return e;
      r.ejercicios.push(e.ejercicio);
    }
    return { ok: true, rounds: r };
  }

  /**
   * Formato viejo (pasos 5 y 6): una sesión fija { rounds, minRound, minDescanso, metBoxeo, metDescanso,
   * minCuerda, metCuerda, minRemo, metRemo, diasSemana, palBase } y una rutina de series para el temporizador.
   * Se convierte a actividades con el mismo gasto; la rutina se descarta.
   */
  var CFG_VIEJA = {
    rounds: 11, minRound: 3, minDescanso: 1, metBoxeo: 7.3, metDescanso: 5.0,
    minCuerda: 5, metCuerda: 11.0, minRemo: 5, metRemo: 7.3, diasSemana: 5, palBase: 1.55
  };
  // Las opciones de MET de la sesión vieja eran del Compendio: se recupera su código.
  var CODIGOS_VIEJOS = {
    boxeo: { 5.8: '15110', 7: '15113', 7.3: '15457', 7.8: '15120', 8.5: '15115', 9.3: '15125', 10.3: '15430', 10.8: '15118' },
    descanso: { 3: '02056', 3.5: '02054', 3.8: '02022', 5: '02035', 6: '02050', 6.5: '02057', 7.5: '02020' },
    cuerda: { 8.3: '15552', 10: '15554', 11: '02068', 11.8: '15551', 12.3: '15550' },
    remo: { 5: '02071', 7.3: '02070', 7.5: '02072', 11: '02073' }
  };
  function cfgAActividades(cfg) {
    var c = {};
    Object.keys(CFG_VIEJA).forEach(function (k) {
      var v = num(cfg && cfg[k]);
      c[k] = isFinite(v) ? v : CFG_VIEJA[k];
    });
    var veces = Math.round(c.diasSemana);
    var lista = [
      { tipo: 'cuerda', nombre: 'Salto de cuerda', met: c.metCuerda, minutos: c.minCuerda },
      { tipo: 'remo', nombre: 'Remo', met: c.metRemo, minutos: c.minRemo },
      { tipo: 'boxeo', nombre: 'Rounds de boxeo / kickboxing', met: c.metBoxeo, minutos: Math.round(c.rounds) * c.minRound },
      { tipo: 'descanso', nombre: 'Ejercicios en los descansos', met: c.metDescanso, minutos: Math.round(c.rounds) * c.minDescanso }
    ].filter(function (x) { return x.minutos > 0; }).map(function (x) {
      return { id: nuevoId(), nombre: x.nombre, codigo: CODIGOS_VIEJOS[x.tipo][x.met] || '', met: x.met, minutos: x.minutos, veces: veces };
    });
    return { palBase: c.palBase, actividades: lista };
  }

  /**
   * Formato semanal (versión anterior): actividades con «veces por semana». Cada una se pone en los
   * primeros días de la semana según sus veces (5 veces → lunes a viernes; 2 → lunes y martes).
   */
  function semanalADias(actividades) {
    var dias = {};
    DIAS.forEach(function (d) { dias[d] = []; });
    (actividades || []).forEach(function (x) {
      var veces = Math.max(0, Math.min(7, Math.round(num(x && x.veces))));
      for (var i = 0; i < veces; i++) {
        dias[DIAS[i]].push({ id: nuevoId(), nombre: x.nombre, codigo: x.codigo, met: x.met, minutos: x.minutos, nota: x.nota });
      }
    });
    return dias;
  }

  /**
   * Revisa el entreno de un perfil en el formato actual (por día) o en uno anterior (semanal o
   * sesión fija), que convierte. Devuelve { ok: true, entreno: { palBase, dias }, errores[] } o { ok: false, error }.
   */
  function validarEntreno(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'El entreno no es válido.' };
    var palRaw = raw.palBase;
    var diasRaw;
    if (raw.dias && typeof raw.dias === 'object' && !Array.isArray(raw.dias)) {
      diasRaw = raw.dias;
    } else if (Array.isArray(raw.actividades)) {
      diasRaw = semanalADias(raw.actividades);
    } else if (raw.cfg) {
      var conv = cfgAActividades(raw.cfg);
      diasRaw = semanalADias(conv.actividades);
      if (palRaw === undefined) palRaw = conv.palBase;
    } else {
      diasRaw = {};
    }
    var pal = num(palRaw);
    if (!isFinite(pal)) pal = PAL_BASE;
    if (pal < 1.2 || pal > 2.2) return { ok: false, error: 'El nivel del resto del día debe estar entre 1,2 y 2,2.' };
    var errores = [];
    var dias = {};
    DIAS.forEach(function (d) {
      dias[d] = [];
      var lista = Object.prototype.hasOwnProperty.call(diasRaw, d) && Array.isArray(diasRaw[d]) ? diasRaw[d] : [];
      lista.forEach(function (x) {
        var v = validarActividad(x);
        if (v.ok) dias[d].push(v.actividad); else errores.push(v.error);
      });
    });
    return { ok: true, entreno: { palBase: pal, dias: dias }, errores: errores };
  }

  /** Lleva un entreno guardado al formato actual (para datos de versiones anteriores). */
  function migrarEntreno(e) {
    var v = validarEntreno(e || {});
    return v.ok ? v.entreno : validarEntreno({}).entreno;
  }

  /** Registro de peso: { fecha: 'AAAA-MM-DD', kg }. */
  function validarPeso(raw) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Registro de peso inválido.' };
    var f = String(raw.fecha || '');
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
    var real = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString().slice(0, 10) === f;
    if (!real) return { ok: false, error: 'Fecha inválida: «' + f + '».' };
    var kg = num(raw.kg);
    if (!isFinite(kg) || kg < 20 || kg > 400) return { ok: false, error: f + ': el peso debe estar entre 20 y 400 kg.' };
    return { ok: true, registro: { fecha: f, kg: kg } };
  }

  /** Agrega o reemplaza un registro (una medida por fecha) y deja la lista ordenada por fecha. */
  function ponerPeso(lista, registro) {
    var out = (lista || []).filter(function (r) { return r.fecha !== registro.fecha; });
    out.push({ fecha: registro.fecha, kg: registro.kg });
    out.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
    return out;
  }

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  /**
   * Copia las líneas de un día a otros días de la misma semana (reemplaza lo que tenían).
   * Las copias llevan ids nuevos, así que editar una no cambia la otra. No modifica `semana`.
   * Devuelve { semana, reemplazados: [días que tenían líneas] } o { error }.
   */
  function copiarDia(semana, origen, destinos) {
    if (DIAS.indexOf(origen) < 0) return { error: 'Día de origen inválido.' };
    var dest = (destinos || []).filter(function (d) { return d !== origen && DIAS.indexOf(d) >= 0; });
    if (!dest.length) return { error: 'Elige al menos un día distinto del que copias.' };
    var nueva = clonar(semana || {});
    var lineas = nueva[origen] || [];
    var reemplazados = [];
    dest.forEach(function (d) {
      if (nueva[d] && nueva[d].length) reemplazados.push(d);
      nueva[d] = lineas.map(function (it) {
        var copia = clonar(it);
        copia.id = nuevoId();
        return copia;
      });
    });
    return { semana: nueva, reemplazados: reemplazados };
  }

  /**
   * Arma un archivo para exportar. partes: lista de secciones ('perfiles', 'alimentos');
   * por defecto, todas las que tenga el estado. En los próximos pasos se suman días y entrenos.
   */
  function exportar(state, fecha, partes) {
    partes = partes || ['perfiles', 'alimentos', 'recetas', 'dias', 'entreno', 'pesos'];
    var out = { app: APP, formato: FORMATO, exportado: (fecha || new Date()).toISOString() };
    if (partes.indexOf('perfiles') >= 0 && Array.isArray(state.perfiles)) {
      out.perfiles = state.perfiles.map(function (p) {
        var copia = clonar(p);
        if (!copia.nombre) copia.nombre = 'Sin nombre'; // al importar, el nombre es obligatorio
        return copia;
      });
    }
    if (partes.indexOf('alimentos') >= 0 && Array.isArray(state.alimentos)) {
      out.alimentos = state.alimentos.map(clonar);
    }
    if (partes.indexOf('recetas') >= 0 && Array.isArray(state.recetas)) {
      out.recetas = state.recetas.map(clonar);
    }
    // Secciones por perfil: solo las de los perfiles que van en el archivo (o todas si no van perfiles).
    ['dias', 'entreno', 'pesos'].forEach(function (sec) {
      if (partes.indexOf(sec) < 0 || !state[sec] || typeof state[sec] !== 'object') return;
      var ids = out.perfiles ? out.perfiles.map(function (p) { return p.id; }) : Object.keys(state[sec]);
      out[sec] = {};
      ids.forEach(function (id) { if (state[sec][id]) out[sec][id] = clonar(state[sec][id]); });
    });
    return out;
  }

  /** Mete cada elemento válido en `destino`: mismo id (o, sin id, mismo nombre) reemplaza; si no, agrega. */
  function mezclar(destino, lista, validar, clave, sec, errores) {
    lista.forEach(function (raw) {
      var v = validar(raw);
      if (!v.ok) { errores.push(v.error); return; }
      var x = v[clave];
      var traeId = raw && typeof raw.id === 'string' && idSeguro(raw.id.trim());
      var idx = destino.findIndex(function (y) {
        return traeId ? y.id === x.id : (y.nombre || '').toLowerCase() === x.nombre.toLowerCase();
      });
      if (idx >= 0) {
        x.id = destino[idx].id;
        destino[idx] = x;
        sec.reemplazados.push(x.nombre);
      } else {
        destino.push(x);
        sec.agregados.push(x.nombre);
      }
      sec.ids.push(x.id);
    });
  }

  function esDias(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  /**
   * dias = { idPerfil: { lun: [líneas], mar: [...], ... } }. Cada día que trae el archivo reemplaza
   * al de ese perfil; los días que no trae se dejan como estaban. El perfil tiene que existir.
   */
  function importarDias(res, dias) {
    Object.keys(dias).forEach(function (pid) {
      var perfil = perfilDe(res, pid, 'un plan de días');
      if (!perfil) return;
      var semana = dias[pid];
      if (!esDias(semana)) return;
      var importados = [];
      DIAS.forEach(function (d) {
        if (!Array.isArray(semana[d])) return;
        var items = [];
        semana[d].forEach(function (raw) {
          var v = validarItemDia(raw);
          if (v.ok) items.push(v.item); else res.errores.push(perfil.nombre + ', ' + d + ': ' + v.error);
        });
        if (!propio(res.state.dias, pid)) res.state.dias[pid] = {};
        res.state.dias[pid][d] = items;
        importados.push(d);
      });
      if (importados.length) res.dias.push(perfil.nombre + ' (' + importados.join(', ') + ')');
    });
  }

  function perfilDe(res, pid, que) {
    if (!idSeguro(pid)) {
      res.errores.push('Se ignoró ' + que + ' con un identificador de perfil no válido.');
      return null;
    }
    var perfil = res.state.perfiles.find(function (p) { return p.id === pid; });
    if (!perfil) res.errores.push('Hay ' + que + ' para el perfil «' + pid + '», que no existe. Importa primero ese perfil.');
    return perfil;
  }

  /** entreno = { idPerfil: { palBase, dias: { lun: [...], ... } } } (o un formato anterior, que se convierte). Reemplaza el del perfil. */
  function importarEntreno(res, entreno) {
    Object.keys(entreno).forEach(function (pid) {
      var perfil = perfilDe(res, pid, 'un entreno');
      if (!perfil) return;
      var v = validarEntreno(entreno[pid]);
      if (!v.ok) { res.errores.push(perfil.nombre + ': ' + v.error); return; }
      v.errores.forEach(function (e) { res.errores.push(perfil.nombre + ': ' + e); });
      res.state.entreno[pid] = v.entreno;
      var n = DIAS.filter(function (d) { return v.entreno.dias[d].length; }).length;
      res.entreno.push(perfil.nombre + ' (' + n + (n === 1 ? ' día' : ' días') + ' con ejercicio)');
    });
  }

  /** pesos = { idPerfil: [{ fecha, kg }] }. Una medida por fecha: la del archivo reemplaza a la que había. */
  function importarPesos(res, pesos) {
    Object.keys(pesos).forEach(function (pid) {
      var perfil = perfilDe(res, pid, 'registros de peso');
      if (!perfil || !Array.isArray(pesos[pid])) return;
      var lista = propio(res.state.pesos, pid) ? res.state.pesos[pid] : [];
      var n = 0;
      pesos[pid].forEach(function (raw) {
        var v = validarPeso(raw);
        if (v.ok) { lista = ponerPeso(lista, v.registro); n += 1; } else res.errores.push(perfil.nombre + ': ' + v.error);
      });
      res.state.pesos[pid] = lista;
      if (n) res.pesos.push(perfil.nombre + ' (' + n + (n === 1 ? ' registro' : ' registros') + ')');
    });
  }

  /**
   * Mezcla un archivo importado con el estado actual, sin modificar el estado recibido.
   * Acepta el archivo de la app (con perfiles y/o alimentos), una lista de perfiles o un solo perfil.
   * Devuelve { state, agregados[], reemplazados[], ids[] (perfiles), alimentos: {…}, recetas: {…}, dias: [resumen], errores[] }.
   */
  function importar(state, data) {
    var res = {
      state: clonar(state), agregados: [], reemplazados: [], ids: [],
      alimentos: { agregados: [], reemplazados: [], ids: [] },
      recetas: { agregados: [], reemplazados: [], ids: [] },
      dias: [], entreno: [], pesos: [], errores: []
    };
    if (!Array.isArray(res.state.perfiles)) res.state.perfiles = [];
    if (!Array.isArray(res.state.alimentos)) res.state.alimentos = [];
    if (!Array.isArray(res.state.recetas)) res.state.recetas = [];
    if (!res.state.dias || typeof res.state.dias !== 'object') res.state.dias = {};
    if (!res.state.entreno || typeof res.state.entreno !== 'object') res.state.entreno = {};
    if (!res.state.pesos || typeof res.state.pesos !== 'object') res.state.pesos = {};

    var perfiles = null;
    var alimentos = null;
    var recetas = null;
    var dias = null;
    var entreno = null;
    var pesos = null;
    var esObjeto = data && typeof data === 'object' && !Array.isArray(data);
    if (Array.isArray(data)) perfiles = data;
    else if (esObjeto && (Array.isArray(data.perfiles) || Array.isArray(data.alimentos) || Array.isArray(data.recetas) || esDias(data.dias) || esDias(data.entreno) || esDias(data.pesos))) {
      if (data.app && data.app !== APP) {
        res.errores.push('El archivo es de otra aplicación («' + data.app + '»).');
        return res;
      }
      if (Array.isArray(data.perfiles)) perfiles = data.perfiles;
      if (Array.isArray(data.alimentos)) alimentos = data.alimentos;
      if (Array.isArray(data.recetas)) recetas = data.recetas;
      if (esDias(data.dias)) dias = data.dias;
      if (esDias(data.entreno)) entreno = data.entreno;
      if (esDias(data.pesos)) pesos = data.pesos;
    } else if (esObjeto && 'nombre' in data) perfiles = [data];
    else {
      res.errores.push('El archivo no tiene datos de Macros Lobo (perfiles, alimentos, recetas, días, entreno o pesos).');
      return res;
    }

    if (perfiles) mezclar(res.state.perfiles, perfiles, validarPerfil, 'perfil', res, res.errores);
    if (alimentos) mezclar(res.state.alimentos, alimentos, validarAlimento, 'alimento', res.alimentos, res.errores);
    if (recetas) mezclar(res.state.recetas, recetas, validarReceta, 'receta', res.recetas, res.errores);
    if (dias) importarDias(res, dias);
    if (entreno) importarEntreno(res, entreno);
    if (pesos) importarPesos(res, pesos);

    var activoExiste = res.state.perfiles.some(function (x) { return x.id === res.state.activo; });
    if (!activoExiste) res.state.activo = res.state.perfiles.length ? res.state.perfiles[0].id : null;
    return res;
  }

  return {
    APP: APP,
    FORMATO: FORMATO,
    LIMITES: LIMITES,
    POR_DEFECTO: POR_DEFECTO,
    num: num,
    nuevoId: nuevoId,
    perfilNuevo: perfilNuevo,
    validarPerfil: validarPerfil,
    LIMITES_ALIMENTO: LIMITES_ALIMENTO,
    validarAlimento: validarAlimento,
    DIAS: DIAS,
    validarReceta: validarReceta,
    validarItemDia: validarItemDia,
    copiarDia: copiarDia,
    idSeguro: idSeguro,
    PAL_BASE: PAL_BASE,
    LIMITES_ACT: LIMITES_ACT,
    LIMITES_ROUNDS: LIMITES_ROUNDS,
    MAX_REPS: MAX_REPS,
    validarActividad: validarActividad,
    validarEjercicioDescanso: validarEjercicioDescanso,
    validarRounds: validarRounds,
    validarEntreno: validarEntreno,
    cfgAActividades: cfgAActividades,
    semanalADias: semanalADias,
    migrarEntreno: migrarEntreno,
    validarPeso: validarPeso,
    ponerPeso: ponerPeso,
    exportar: exportar,
    importar: importar
  };
});
