/*
 * Guardado de Macros Lobo.
 *
 * 1. Siempre guarda en el navegador (localStorage): la app abre al instante y funciona sin conexión.
 * 2. Publicada en claude.ai, además sincroniza con la nube privada del usuario (capacidad `db`):
 *    cada sección (perfiles, alimentos, recetas, días, entreno, pesos) es un documento en
 *    data/users/<id del usuario>/<sección>, que nadie más puede leer. Un cambio en el PC llega al
 *    teléfono en vivo y al revés. Si dos dispositivos cambian la misma sección, gana el cambio más reciente.
 *
 * Se carga igual en el navegador (window.Store) y en Node (require) para probar la sincronización
 * con una nube de prueba.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    var ls = null;
    try { ls = root.localStorage; } catch (e) { ls = null; }
    root.Store = api.crearStore({ ls: ls, claude: root.claude, retraso: 800 });
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'macros-lobo:v1';
  var KEY_META = 'macros-lobo:sync';
  var SECCIONES = ['perfiles', 'alimentos', 'recetas', 'dias', 'entreno', 'pesos'];

  /** La parte del estado que va en cada documento. */
  function extraer(state, sec) {
    if (sec === 'perfiles') return { activo: state.activo || null, perfiles: state.perfiles || [] };
    var v = state[sec];
    if (v === undefined || v === null) return sec === 'alimentos' || sec === 'recetas' ? [] : {};
    return v;
  }
  function aplicarSeccion(state, sec, datos) {
    if (sec === 'perfiles') {
      state.perfiles = Array.isArray(datos && datos.perfiles) ? datos.perfiles : [];
      state.activo = (datos && datos.activo) || null;
    } else {
      state[sec] = datos;
    }
  }
  function tieneDatos(state, sec) {
    var v = extraer(state, sec);
    if (sec === 'perfiles') return v.perfiles.length > 0;
    return Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0;
  }
  /** Huella corta (FNV-1a) del JSON de una sección, para saber si cambió. */
  function huella(datos) {
    var s = JSON.stringify(datos);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return s.length + ':' + h.toString(36);
  }

  function crearStore(entorno) {
    var ls = entorno.ls;
    var claude = entorno.claude;
    var retraso = entorno.retraso == null ? 800 : entorno.retraso;
    var ahora = entorno.ahora || function () { return Date.now(); };

    // ---------- Navegador ----------
    function load() {
      try {
        var raw = ls && ls.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }
    function guardarLocal(state) {
      try {
        if (!ls) return false;
        ls.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        return false;
      }
    }
    function clear() {
      try { if (ls) { ls.removeItem(KEY); ls.removeItem(KEY_META); } return true; } catch (e) { return false; }
    }

    // meta: { uid, huella: {sec}, remoto: {sec: ms de la última versión de la nube que tenemos}, local: {sec: ms del último cambio aquí} }
    function metaVacia() { return { uid: null, huella: {}, remoto: {}, local: {} }; }
    var meta = (function () {
      try {
        var m = ls && JSON.parse(ls.getItem(KEY_META) || 'null');
        return m && m.huella && m.remoto && m.local ? m : metaVacia();
      } catch (e) { return metaVacia(); }
    })();
    function guardarMeta() {
      try { if (ls) ls.setItem(KEY_META, JSON.stringify(meta)); } catch (e) { /* sin almacenamiento */ }
    }

    // ---------- Estado de la sincronización ----------
    var info = { modo: 'local', fase: 'local', mensaje: '' };
    var oyentesEstado = [];
    function fijar(fase, mensaje) {
      info.fase = fase;
      info.mensaje = mensaje || '';
      oyentesEstado.forEach(function (fn) { try { fn(estado()); } catch (e) { /* nada */ } });
    }
    function estado() { return { modo: info.modo, fase: info.fase, mensaje: info.mensaje }; }

    var app = null;      // { obtener(): state, aplicar(secciones) }
    var col = null;      // colección de la nube
    var sucio = {};      // sec → hay cambios locales sin subir
    var enviando = {};   // sec → actualizado del envío en curso
    var timer = null;
    var conectado = false;

    /** Guarda en el navegador y marca para subir las secciones que cambiaron. */
    function save(state) {
      var ok = guardarLocal(state);
      var hubo = false;
      SECCIONES.forEach(function (sec) {
        var h = huella(extraer(state, sec));
        if (h !== meta.huella[sec] && !(meta.huella[sec] === undefined && !tieneDatos(state, sec))) {
          meta.local[sec] = ahora();
          sucio[sec] = true;
          hubo = true;
        }
      });
      if (hubo) {
        guardarMeta();
        if (conectado) programar(retraso);
      }
      return ok;
    }

    function programar(ms) {
      clearTimeout(timer);
      timer = setTimeout(subir, ms);
    }

    var subiendo = null;
    /** Sube las secciones pendientes, una escritura a la vez por documento. */
    function subir() {
      if (!conectado || !app) return Promise.resolve();
      if (subiendo) return subiendo;
      var state = app.obtener();
      var pendientes = SECCIONES.filter(function (s) { return sucio[s]; });
      if (!pendientes.length) { fijar('listo'); return Promise.resolve(); }
      fijar('guardando');
      subiendo = Promise.all(pendientes.map(function (sec) {
        var datos = JSON.parse(JSON.stringify(extraer(state, sec)));
        var cuerpo = { v: 1, actualizado: Math.max(ahora(), (meta.remoto[sec] || 0) + 1), datos: datos };
        enviando[sec] = cuerpo.actualizado;
        return col.doc(sec).set(cuerpo).then(function () {
          meta.remoto[sec] = cuerpo.actualizado;
          meta.huella[sec] = huella(datos);
          // Si no cambió nada mientras se subía, queda al día.
          if (huella(extraer(app.obtener(), sec)) === meta.huella[sec]) sucio[sec] = false;
        });
      })).then(function () {
        guardarMeta();
        subiendo = null;
        if (SECCIONES.some(function (s) { return sucio[s]; })) { programar(retraso); fijar('guardando'); }
        else fijar('listo');
      }, function (err) {
        guardarMeta();
        subiendo = null;
        var code = err && err.code;
        if (code === 'quota_exceeded') fijar('error', 'La nube está llena; los cambios quedan en este navegador.');
        else if (code === 'invalid_argument' || code === 'transform_error') { conectado = false; fijar('error', 'Esta cuenta no puede guardar en la nube de esta app; los cambios quedan en este navegador.'); }
        else if (code === 'revoked' || code === 'not_granted') { conectado = false; fijar('error', 'Se perdió el acceso a la nube; los cambios quedan en este navegador.'); }
        else { fijar('error', 'No se pudo subir; se reintenta en un momento.'); programar(5000); }
      });
      return subiendo;
    }

    /** Llega la nube: aplica lo que es más nuevo que lo que tenemos. */
    function recibir(snap, primera) {
      var recibidas = {};
      var presentes = {};
      if (primera) {
        // Cambios hechos aquí sin conexión (en esta visita o en una anterior): compiten por fecha con la nube.
        var st0 = app.obtener();
        SECCIONES.forEach(function (sec) {
          if (meta.huella[sec] !== undefined && huella(extraer(st0, sec)) !== meta.huella[sec]) sucio[sec] = true;
        });
      }
      (snap.docs || []).forEach(function (d) {
        if (!d.exists || SECCIONES.indexOf(d.id) < 0) return;
        presentes[d.id] = true;
        if (d.metadata && d.metadata.hasPendingWrites) return;
        var cuerpo = d.data();
        if (!cuerpo || typeof cuerpo.actualizado !== 'number') return;
        var sec = d.id;
        if (cuerpo.actualizado === enviando[sec]) { // eco de nuestro propio envío
          return;
        }
        if (cuerpo.actualizado <= (meta.remoto[sec] || 0)) return;
        if (sucio[sec] && (meta.local[sec] || 0) > cuerpo.actualizado) return; // lo de aquí es más nuevo: se subirá
        recibidas[sec] = cuerpo.datos;
        meta.remoto[sec] = cuerpo.actualizado;
        meta.huella[sec] = huella(cuerpo.datos);
        sucio[sec] = false;
      });
      if (Object.keys(recibidas).length) {
        guardarMeta();
        app.aplicar(recibidas);
      }
      if (primera) {
        // Lo que la nube no tiene y aquí sí, o cambió aquí sin conexión: subirlo.
        var state = app.obtener();
        SECCIONES.forEach(function (sec) {
          if (!presentes[sec] && tieneDatos(state, sec)) { sucio[sec] = true; meta.local[sec] = meta.local[sec] || ahora(); }
        });
        guardarMeta();
      }
      return Object.keys(recibidas);
    }

    /**
     * Conecta con la nube si la app está publicada en claude.ai.
     * cb = { obtener(): estado actual, aplicar(secciones): poner en el estado y redibujar }.
     * Resuelve 'nube' o 'local'.
     */
    function conectar(cb) {
      app = cb;
      if (!claude || typeof claude.use !== 'function') { info.modo = 'local'; fijar('local'); return Promise.resolve('local'); }
      fijar('conectando');
      return Promise.all([claude.use('db'), claude.use('user')]).then(function (r) {
        var db = r[0];
        var user = r[1];
        if (!db || !user) return null;
        return user.id().then(function (uid) { return uid ? { db: db, uid: uid } : null; });
      }).then(function (x) {
        if (!x) { info.modo = 'local'; fijar('local'); return 'local'; }
        if (meta.uid && meta.uid !== x.uid) { meta = metaVacia(); sucio = {}; }
        meta.uid = x.uid;
        guardarMeta();
        info.modo = 'nube';
        col = x.db.collection('data/users/' + x.uid);
        var primera = true;
        var aviso = setTimeout(function () {
          if (primera) fijar('sin-conexion', 'Sin conexión con la nube: se guarda en este navegador y se sube al volver.');
        }, 10000);
        return new Promise(function (resolve) {
          col.onSnapshot(function (snap) {
            var desdeCache = snap.metadata && snap.metadata.fromCache;
            var esPrimera = primera && !desdeCache;
            recibir(snap, esPrimera);
            if (esPrimera) {
              primera = false;
              clearTimeout(aviso);
              conectado = true;
              fijar('listo');
              resolve('nube');
              if (SECCIONES.some(function (s) { return sucio[s]; })) programar(0);
            }
          }, function (err) {
            clearTimeout(aviso);
            conectado = false;
            fijar('error', err && err.code === 'revoked' ? 'Se perdió el acceso a la nube; los cambios quedan en este navegador.' : 'No se pudo conectar con la nube; los cambios quedan en este navegador.');
            resolve('local');
          });
        });
      }, function () {
        info.modo = 'local';
        fijar('local');
        return 'local';
      });
    }

    /** Sube ya lo pendiente (al ocultar la página, o en pruebas). */
    function vaciar() {
      clearTimeout(timer);
      return subir();
    }

    return {
      KEY: KEY,
      SECCIONES: SECCIONES,
      load: load,
      save: save,
      clear: clear,
      conectar: conectar,
      vaciar: vaciar,
      estado: estado,
      alCambiarEstado: function (fn) { oyentesEstado.push(fn); },
      aplicarSeccion: aplicarSeccion
    };
  }

  return { crearStore: crearStore, SECCIONES: SECCIONES, extraer: extraer, aplicarSeccion: aplicarSeccion, huella: huella };
});
