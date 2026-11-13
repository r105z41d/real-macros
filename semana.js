/* Macros Lobo — Paso 4: la semana, copiar días y lista para preparar la comida. */
(function () {
  'use strict';
  var A = window.App;
  var C = window.Calc;
  var D = window.Datos;
  function $(id) { return document.getElementById(id); }
  var esc = A.esc;

  var CORTO = { lun: 'Lun', mar: 'Mar', mie: 'Mié', jue: 'Jue', vie: 'Vie', sab: 'Sáb', dom: 'Dom' };
  var LARGO = { lun: 'Lunes', mar: 'Martes', mie: 'Miércoles', jue: 'Jueves', vie: 'Viernes', sab: 'Sábado', dom: 'Domingo' };
  var HOY = D.DIAS[(new Date().getDay() + 6) % 7];

  var origen = null;     // día que se copia
  var destinos = {};     // día → true
  var confirmar = null;  // resultado de copiarDia pendiente de confirmar (reemplaza días con líneas)
  var deshacer = null;   // { pid, semana } para volver atrás la última copia
  var prepDias = null;   // null = automáticamente los días con plan; si no, { día: true }

  function indices() {
    var s = A.getState();
    return { al: C.indexar(s.alimentos), rec: C.indexar(s.recetas) };
  }
  function semanaDe(pid) { return A.getState().dias[pid] || {}; }
  function lineasDe(pid, d) { return semanaDe(pid)[d] || []; }

  // ---------- Render ----------
  function render() {
    var p = A.activo();
    renderPerfiles();
    $('sem-sin-perfil').hidden = !!p;
    $('sem-grid').hidden = !p;
    if (!p) return;
    var ix = indices();
    renderTabla(p, ix);
    renderCopiar(p);
    renderPrep(p, ix);
  }

  function renderPerfiles() {
    var s = A.getState();
    $('sem-perfiles').innerHTML = s.perfiles.map(function (p) {
      return '<button type="button" class="pchip" data-id="' + esc(p.id) + '" aria-pressed="' + (p.id === s.activo) + '">' +
        esc(p.nombre || 'Sin nombre') + '</button>';
    }).join('');
  }

  function celdas(m, dec) {
    return '<td>' + A.fmt(m.kcal, 0) + '</td>' +
      '<td class="n-prot">' + A.fmt(m.prot, dec) + '</td>' +
      '<td class="n-grasa">' + A.fmt(m.grasa, dec) + '</td>' +
      '<td class="n-carbs">' + A.fmt(m.carbs, dec) + '</td>';
  }
  function celdaVs(total, obj) {
    if (!obj) return '<td>—</td>';
    var dif = total - obj.kcal;
    var estado = Math.abs(dif) <= obj.kcal * 0.05 ? 'ok' : dif < 0 ? 'falta' : 'pasa';
    return '<td class="vs est-' + estado + '">' + (dif >= 0 ? '+' : '−') + A.fmt(Math.abs(dif), 0) + '</td>';
  }

  function renderTabla(p, ix) {
    var r = C.calcPerfil(p);
    var obj = C.objetivoDia(r);
    var t = C.totalesSemana(semanaDe(p.id), ix.al, ix.rec);
    $('sem-filas').innerHTML = D.DIAS.map(function (d) {
      var pd = t.porDia[d];
      var cab = '<th scope="row"><button type="button" class="link-dia" data-dia="' + d + '" aria-label="Abrir el ' + LARGO[d].toLowerCase() + '">' +
        '<span class="d-largo">' + LARGO[d] + '</span><span class="d-corto" aria-hidden="true">' + CORTO[d] + '</span></button>' +
        (d === HOY ? ' <small class="hoy">hoy</small>' : '') + '</th>';
      if (!pd.lineas) return '<tr class="sin-plan">' + cab + '<td colspan="5">Sin plan</td></tr>';
      return '<tr>' + cab + celdas(pd.total, 0) + celdaVs(pd.total.kcal, obj) + '</tr>';
    }).join('');

    var pie = '';
    if (t.promedio) {
      pie += '<tr><th scope="row">Promedio <small>(' + t.diasConPlan + (t.diasConPlan === 1 ? ' día' : ' días') + ')</small></th>' +
        celdas(t.promedio, 0) + celdaVs(t.promedio.kcal, obj) + '</tr>';
      pie += '<tr><th scope="row">Total</th>' + celdas(t.total, 0) + '<td></td></tr>';
    }
    if (obj) {
      pie += '<tr class="fila-obj"><th scope="row">Objetivo diario</th>' + celdas(obj, 0) + '<td></td></tr>';
    }
    $('sem-pie').innerHTML = pie;

    var ritmo = $('sem-ritmo');
    if (!t.promedio || !r.valido) {
      ritmo.textContent = r.valido ? 'Planea al menos un día para ver el promedio.' : 'Completa el perfil para comparar con su objetivo.';
      return;
    }
    var rs = C.ritmoSemanal(t.promedio.kcal - r.tdee, p.peso);
    var pct = Math.abs(rs.pct);
    var guia = rs.kg >= 0 ? '' : pct > 1 ? ' Es más rápido que el 1 % por semana: más riesgo de perder músculo.'
      : pct >= 0.5 ? ' Está dentro del 0,5–1 % por semana que recomienda la guía.'
        : ' Es más lento que el 0,5 % por semana: conservador.';
    ritmo.innerHTML = 'Si todos los días comes como el promedio, ' +
      (Math.abs(rs.kg) < 0.005 ? 'mantendrías el peso' : (rs.kg < 0 ? 'bajarías ' : 'subirías ') + '<b>' + A.fmtUp(Math.abs(rs.kg), 2) + ' kg por semana</b> (' + A.fmtUp(pct, 2) + ' % de tu peso)') +
      ', frente a un mantenimiento de ' + A.fmt(r.tdee, 0) + ' kcal.' + esc(guia);
  }

  // ---------- Copiar un día ----------
  function renderCopiar(p) {
    if (!origen) {
      origen = D.DIAS.find(function (d) { return lineasDe(p.id, d).length; }) || HOY;
    }
    $('sem-origen').innerHTML = D.DIAS.map(function (d) {
      var n = lineasDe(p.id, d).length;
      return '<option value="' + d + '"' + (d === origen ? ' selected' : '') + '>' + LARGO[d] + (n ? ' (' + n + ' líneas)' : ' (vacío)') + '</option>';
    }).join('');
    $('sem-destinos').innerHTML = D.DIAS.map(function (d) {
      var es = d === origen;
      return '<button type="button" class="dia-toggle" data-dia="' + d + '" aria-pressed="' + (!es && !!destinos[d]) + '"' + (es ? ' disabled' : '') + '>' + CORTO[d] + '</button>';
    }).join('');

    var pie = $('sem-copiar-pie');
    if (confirmar) {
      var lista = confirmar.reemplazados.map(function (d) {
        var n = lineasDe(p.id, d).length;
        return LARGO[d] + ' (' + n + (n === 1 ? ' línea' : ' líneas') + ')';
      }).join(', ');
      var vacio = !lineasDe(p.id, origen).length;
      pie.innerHTML = '<p class="hint is-off">' + (vacio ? 'El ' + LARGO[origen].toLowerCase() + ' está vacío: estos días quedarán vacíos: ' : 'Se reemplazará lo que ya tienen: ') + esc(lista) + '.</p>' +
        '<span class="foot-actions"><button type="button" class="btn btn-danger" id="btn-copiar-ok">Sí, reemplazar</button>' +
        '<button type="button" class="btn" id="btn-copiar-no">Cancelar</button></span>';
    } else {
      var hay = D.DIAS.some(function (d) { return d !== origen && destinos[d]; });
      pie.innerHTML = '<button type="button" class="btn btn-primary" id="btn-copiar"' + (hay ? '' : ' disabled') + '>Copiar</button>';
    }
  }

  function aplicarCopia(p, res) {
    deshacer = { pid: p.id, semana: JSON.parse(JSON.stringify(semanaDe(p.id))) };
    A.getState().dias[p.id] = res.semana;
    var cuales = D.DIAS.filter(function (d) { return d !== origen && destinos[d]; });
    confirmar = null;
    destinos = {};
    prepDias = null;
    A.persist();
    render();
    var caja = $('sem-status');
    caja.className = 'bar-status is-ok';
    caja.innerHTML = '<span>Copiado el ' + LARGO[origen].toLowerCase() + ' a ' + esc(cuales.map(function (d) { return LARGO[d].toLowerCase(); }).join(', ')) + '. ' +
      '<button type="button" class="link-btn" id="btn-sem-deshacer">Deshacer</button></span>';
  }

  $('sem-origen').addEventListener('change', function (e) {
    origen = e.target.value;
    delete destinos[origen];
    confirmar = null;
    renderCopiar(A.activo());
  });
  $('sem-destinos').addEventListener('click', function (e) {
    var b = e.target.closest('.dia-toggle');
    if (!b || b.disabled) return;
    destinos[b.dataset.dia] = !destinos[b.dataset.dia];
    confirmar = null;
    renderCopiar(A.activo());
  });
  document.querySelector('#vista-semana .presets').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sel]');
    if (!b) return;
    var sel = b.dataset.sel === 'lab' ? ['lun', 'mar', 'mie', 'jue', 'vie'] : b.dataset.sel === 'todos' ? D.DIAS : [];
    destinos = {};
    sel.forEach(function (d) { if (d !== origen) destinos[d] = true; });
    confirmar = null;
    renderCopiar(A.activo());
  });
  $('sem-copiar-pie').addEventListener('click', function (e) {
    var p = A.activo();
    if (!p) return;
    if (e.target.id === 'btn-copiar') {
      var res = D.copiarDia(semanaDe(p.id), origen, Object.keys(destinos).filter(function (d) { return destinos[d]; }));
      if (res.error) { A.avisar('bad', res.error); return; }
      if (res.reemplazados.length) { confirmar = res; renderCopiar(p); $('btn-copiar-no').focus(); return; }
      aplicarCopia(p, res);
    } else if (e.target.id === 'btn-copiar-ok' && confirmar) {
      aplicarCopia(p, confirmar);
    } else if (e.target.id === 'btn-copiar-no') {
      confirmar = null;
      renderCopiar(p);
    }
  });
  $('sem-status').addEventListener('click', function (e) {
    if (e.target.id !== 'btn-sem-deshacer' || !deshacer) return;
    A.getState().dias[deshacer.pid] = deshacer.semana;
    deshacer = null;
    A.persist();
    A.limpiarAviso();
    render();
  });

  // ---------- Para preparar ----------
  function perfilesPrep(p) {
    return $('prep-todos').checked ? A.getState().perfiles : [p];
  }
  function diasPrep(p) {
    if (prepDias) return D.DIAS.filter(function (d) { return prepDias[d]; });
    var pfs = perfilesPrep(p);
    return D.DIAS.filter(function (d) { return pfs.some(function (pf) { return lineasDe(pf.id, d).length; }); });
  }

  var ultimaLista = '';
  function renderPrep(p, ix) {
    $('prep-uno-lbl').textContent = p.nombre || 'Este perfil';
    var pfs = perfilesPrep(p);
    var dias = diasPrep(p);
    $('prep-dias').innerHTML = D.DIAS.map(function (d) {
      return '<button type="button" class="dia-toggle" data-dia="' + d + '" aria-pressed="' + (dias.indexOf(d) >= 0) + '">' + CORTO[d] + '</button>';
    }).join('');
    var lineas = [];
    pfs.forEach(function (pf) { dias.forEach(function (d) { lineas = lineas.concat(lineasDe(pf.id, d)); }); });
    var l = C.listaPreparacion(lineas, ix.al, ix.rec);
    $('prep-lista').innerHTML = l.alimentos.map(function (a) {
      return '<li><span class="prep-nombre">' + esc(ix.al[a.ref].nombre) + '</span>' +
        '<span class="prep-g">' + A.fmt(a.gramos, 0) + ' g</span>' +
        '<span class="prep-veces">' + a.veces + (a.veces === 1 ? ' vez' : ' veces') + '</span></li>';
    }).join('');
    var notas = [];
    if (l.recetas.length) {
      notas.push('Incluye recetas: ' + l.recetas.map(function (r) {
        return ix.rec[r.ref].nombre + ' ' + A.fmt(r.gramos, 0) + ' g (' + r.veces + (r.veces === 1 ? ' vez' : ' veces') + ')';
      }).join(', ') + '.');
    }
    if (l.faltan) notas.push(l.faltan + ' línea(s) sin alimento o receta no se cuentan.');
    $('prep-recetas').textContent = notas.join(' ');
    $('prep-vacio').hidden = l.alimentos.length > 0;
    $('btn-prep-copiar').disabled = l.alimentos.length === 0;
    $('prep-texto').hidden = true;

    var quien = pfs.map(function (x) { return x.nombre || 'Sin nombre'; }).join(' y ');
    ultimaLista = 'Para preparar · ' + quien + ' · ' + dias.map(function (d) { return CORTO[d]; }).join(', ') + '\n' +
      l.alimentos.map(function (a) { return '- ' + ix.al[a.ref].nombre + ': ' + A.fmt(a.gramos, 0) + ' g'; }).join('\n') +
      (notas.length ? '\n' + notas.join('\n') : '') + '\n';
  }

  $('prep-dias').addEventListener('click', function (e) {
    var b = e.target.closest('.dia-toggle');
    if (!b) return;
    var p = A.activo();
    if (!prepDias) {
      var auto = diasPrep(p); // calcular antes de fijar prepDias, que cambia lo que devuelve diasPrep
      prepDias = {};
      auto.forEach(function (d) { prepDias[d] = true; });
    }
    prepDias[b.dataset.dia] = !prepDias[b.dataset.dia];
    renderPrep(p, indices());
  });
  document.querySelectorAll('input[name="prep-quien"]').forEach(function (r) {
    r.addEventListener('change', function () { prepDias = null; renderPrep(A.activo(), indices()); });
  });
  $('btn-prep-copiar').addEventListener('click', function () {
    var texto = ultimaLista;
    function mostrarTexto() {
      var ta = $('prep-texto');
      ta.value = texto;
      ta.hidden = false;
      ta.focus();
      ta.select();
      A.avisar('ok', 'Selecciona el texto de abajo y cópialo.');
    }
    try {
      navigator.clipboard.writeText(texto).then(function () {
        A.avisar('ok', 'Lista copiada. Pégala donde quieras (WhatsApp, notas…).');
      }, mostrarTexto);
    } catch (err) {
      mostrarTexto();
    }
  });

  // ---------- Perfil y enlaces a Día ----------
  $('sem-perfiles').addEventListener('click', function (e) {
    var b = e.target.closest('.pchip');
    if (!b || b.dataset.id === A.getState().activo) return;
    A.setActivo(b.dataset.id);
    origen = null;
    destinos = {};
    confirmar = null;
    prepDias = null;
    A.limpiarAviso();
    render();
  });
  $('sem-filas').addEventListener('click', function (e) {
    var b = e.target.closest('.link-dia');
    if (b && A.abrirDia) A.abrirDia(b.dataset.dia);
  });

  A.alImportar(function () { origen = null; confirmar = null; prepDias = null; render(); });
  A.alMostrar('semana', function () { confirmar = null; render(); });
})();
