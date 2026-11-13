/*
 * Motor de cálculo de Macros Lobo.
 * Funciones puras (sin DOM ni almacenamiento) para poder probarlas con `node --test`.
 * Se carga igual en el navegador (window.Calc) y en Node (require).
 *
 * Fórmulas (las mismas de "caculo lobo.txt"):
 *   TMB (Mifflin-St Jeor)  hombre: 10·peso + 6,25·altura − 5·edad + 5
 *                          mujer:  10·peso + 6,25·altura − 5·edad − 161
 *   TDEE      = TMB × factor de actividad
 *   Objetivo  = TDEE + ajuste            (ajuste negativo = déficit)
 *   Proteína  = g/kg × peso              → × 4 kcal
 *   Grasa     = Objetivo × %grasa        → ÷ 9 para gramos
 *   Carbos    = Objetivo − (kcal proteína + kcal grasa) → ÷ 4 para gramos
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KCAL_POR_G = { prot: 4, carbs: 4, grasa: 9 };

  var FACTORES = [
    { valor: 1.2, nombre: 'Sedentario', detalle: 'Poco o nada de ejercicio' },
    { valor: 1.375, nombre: 'Ligero', detalle: 'Ejercicio 1–3 días por semana' },
    { valor: 1.55, nombre: 'Moderado', detalle: 'Ejercicio 3–5 días por semana' },
    { valor: 1.725, nombre: 'Muy activo', detalle: 'Ejercicio fuerte 6–7 días por semana' },
    { valor: 1.9, nombre: 'Extremo', detalle: 'Doble sesión o trabajo físico pesado' }
  ];

  // Rangos de referencia tomados de la nota de cálculo.
  var RANGOS = {
    protGkg: { min: 1.6, max: 2.2 },
    grasaPct: { min: 20, max: 30 }
  };

  function esNum(n) {
    return typeof n === 'number' && isFinite(n);
  }

  /** Tasa metabólica basal (Mifflin-St Jeor). sexo: 'h' hombre, 'm' mujer. */
  function tmb(p) {
    var base = 10 * p.peso + 6.25 * p.altura - 5 * p.edad;
    return base + (p.sexo === 'm' ? -161 : 5);
  }

  function tdee(tmbKcal, factor) {
    return tmbKcal * factor;
  }

  /** ajuste en kcal: −300 = déficit de 300, +300 = superávit de 300. */
  function objetivo(tdeeKcal, ajuste) {
    return tdeeKcal + ajuste;
  }

  /** Reparto de macros sobre las calorías objetivo (no sobre el TDEE). */
  function macros(kcalObjetivo, peso, protGkg, grasaPct) {
    var protG = protGkg * peso;
    var protKcal = protG * KCAL_POR_G.prot;
    var grasaKcal = kcalObjetivo * (grasaPct / 100);
    var grasaG = grasaKcal / KCAL_POR_G.grasa;
    var carbsKcal = kcalObjetivo - (protKcal + grasaKcal);
    var carbsG = carbsKcal / KCAL_POR_G.carbs;
    function pct(k) {
      return kcalObjetivo > 0 ? (k / kcalObjetivo) * 100 : NaN;
    }
    return {
      prot: { g: protG, kcal: protKcal, pct: pct(protKcal) },
      grasa: { g: grasaG, kcal: grasaKcal, pct: pct(grasaKcal) },
      carbs: { g: carbsG, kcal: carbsKcal, pct: pct(carbsKcal) }
    };
  }

  function imc(peso, alturaCm) {
    var m = alturaCm / 100;
    return peso / (m * m);
  }

  function imcCategoria(valor) {
    if (!esNum(valor)) return '';
    if (valor < 18.5) return 'Bajo peso';
    if (valor < 25) return 'Normal';
    if (valor < 30) return 'Sobrepeso';
    if (valor < 35) return 'Obesidad I';
    if (valor < 40) return 'Obesidad II';
    return 'Obesidad III';
  }

  var CAMPOS_PERFIL = ['peso', 'altura', 'edad', 'factor', 'ajuste', 'protGkg', 'grasaPct'];

  /**
   * Calcula todo el perfil de una vez.
   * dia (opcional) = { palBase, kcalEjercicio }: gasto de un día concreto con su ejercicio
   *   (gasto = TMB × palBase + kcal del ejercicio de ese día). Sin `dia`, gasto = TMB × factor (igual todos los días).
   * Devuelve { valido, faltan[], modo, tmb, tdee, objetivo, imc, imcCat, macros, avisos[] }.
   */
  function calcPerfil(p, dia) {
    var porDia = !!dia;
    var faltan = CAMPOS_PERFIL.filter(function (k) { return !(porDia && k === 'factor') && !esNum(p[k]); });
    if (porDia && !esNum(dia.palBase)) faltan.push('palBase');
    if (faltan.length) {
      return { valido: false, faltan: faltan, avisos: [] };
    }
    var t = tmb(p);
    var ejercicio = porDia && esNum(dia.kcalEjercicio) ? dia.kcalEjercicio : 0;
    var d = porDia ? t * dia.palBase + ejercicio : tdee(t, p.factor);
    var o = objetivo(d, p.ajuste);
    var m = macros(o, p.peso, p.protGkg, p.grasaPct);
    var i = imc(p.peso, p.altura);
    var avisos = [];

    if (p.protGkg < RANGOS.protGkg.min || p.protGkg > RANGOS.protGkg.max) {
      avisos.push({ nivel: 'warn', texto: 'La proteína está fuera del rango 1,6–2,2 g/kg de tu nota.' });
    }
    if (p.grasaPct < RANGOS.grasaPct.min || p.grasaPct > RANGOS.grasaPct.max) {
      avisos.push({ nivel: 'warn', texto: 'La grasa está fuera del rango 20–30 % de tu nota.' });
    }
    if (m.carbs.kcal < 0) {
      avisos.push({ nivel: 'bad', texto: 'Proteína + grasa superan las calorías objetivo: los carbohidratos quedan negativos. Baja la proteína o la grasa, o el déficit.' });
    }
    if (o < t) {
      avisos.push({ nivel: 'warn', texto: 'Las calorías objetivo quedan por debajo de tu TMB.' });
    }

    return {
      valido: true,
      faltan: [],
      modo: porDia ? 'ejercicio' : 'factor',
      palBase: porDia ? dia.palBase : null,
      kcalEjercicio: ejercicio,
      tmb: t,
      tdee: d,
      objetivo: o,
      imc: i,
      imcCat: imcCategoria(i),
      macros: m,
      avisos: avisos
    };
  }

  // ---------- Alimentos (se usan desde el Paso 2, ya probados aquí) ----------

  /**
   * Macros de una porción. alimento = { base, kcal, grasa, carbs, prot } por `base` gramos.
   * Igual que la hoja "Total Dia": (valor / gramaje base) × gramaje real.
   */
  function porcion(alimento, gramos) {
    var f = alimento.base > 0 ? gramos / alimento.base : 0;
    return {
      kcal: alimento.kcal * f,
      grasa: alimento.grasa * f,
      carbs: alimento.carbs * f,
      prot: alimento.prot * f
    };
  }

  /**
   * Revisa un alimento por cada 100 g:
   * - que proteína + carbos + grasa no pesen más que el alimento;
   * - que las kcal cuadren con 4·proteína + 4·carbos + 9·grasa (factores de Atwater).
   *   Se tolera hasta 15 % o 10 kcal por fibra, alcohol, polioles y redondeos de etiqueta.
   */
  function revisarAlimento(a) {
    var f = a.base > 0 ? 100 / a.base : 0;
    var por100 = { kcal: a.kcal * f, prot: a.prot * f, carbs: a.carbs * f, grasa: a.grasa * f };
    var kcalCalc = 4 * por100.prot + 4 * por100.carbs + 9 * por100.grasa;
    var dif = por100.kcal - kcalCalc;
    var difPct = por100.kcal > 0 ? (dif / por100.kcal) * 100 : (kcalCalc > 0 ? -100 : 0);
    var suma = por100.prot + por100.carbs + por100.grasa;
    var problemas = [];
    if (suma > 102) {
      problemas.push({ nivel: 'bad', texto: 'Proteína + carbos + grasa suman ' + (Math.round(suma * 10) / 10).toString().replace('.', ',') + ' g por cada 100 g: más que el propio alimento.' });
    }
    if (Math.abs(dif) > 10 && Math.abs(difPct) > 15) {
      problemas.push({
        nivel: 'warn',
        texto: 'Las kcal no cuadran con los macros: ' + Math.round(por100.kcal) + ' kcal declaradas frente a ' + Math.round(kcalCalc) +
          ' calculadas (4·P + 4·C + 9·G) por 100 g. Revisa la etiqueta o la fuente.'
      });
    }
    return { por100: por100, kcalCalc: kcalCalc, dif: dif, difPct: difPct, problemas: problemas };
  }

  function sumar(lista) {
    return lista.reduce(function (acc, x) {
      acc.kcal += x.kcal; acc.grasa += x.grasa; acc.carbs += x.carbs; acc.prot += x.prot;
      return acc;
    }, { kcal: 0, grasa: 0, carbs: 0, prot: 0 });
  }

  // ---------- Recetas y día (paso 3) ----------
  var CERO = { kcal: 0, grasa: 0, carbs: 0, prot: 0 };

  function escalar(m, f) {
    return { kcal: m.kcal * f, grasa: m.grasa * f, carbs: m.carbs * f, prot: m.prot * f };
  }

  /** Lista → { id: elemento }. */
  function indexar(lista) {
    var out = Object.create(null); // sin prototipo: un id como «toString» no encuentra nada heredado
    (lista || []).forEach(function (x) { out[x.id] = x; });
    return out;
  }

  /**
   * Total de una receta, como la hoja "Ensalada": suma de (valor / base) × gramos de cada ingrediente.
   * peso = peso de la preparación lista (pesoTotal) o, si no se anotó, la suma de los ingredientes.
   * Devuelve { total, pesoIngredientes, peso, por100, faltan[] (ids de ingredientes que no existen) }.
   */
  function totalReceta(receta, alimentosPorId) {
    var faltan = [];
    var pesoIng = 0;
    var partes = (receta.ingredientes || []).map(function (ing) {
      pesoIng += ing.gramos;
      var a = alimentosPorId[ing.ref];
      if (!a) { faltan.push(ing.ref); return CERO; }
      return porcion(a, ing.gramos);
    });
    var total = sumar(partes);
    var peso = receta.pesoTotal > 0 ? receta.pesoTotal : pesoIng;
    return {
      total: total,
      pesoIngredientes: pesoIng,
      peso: peso,
      por100: peso > 0 ? escalar(total, 100 / peso) : escalar(CERO, 0),
      faltan: faltan
    };
  }

  /** Macros de una línea del día: un alimento o una receta, por gramos reales. null si ya no existe. */
  function itemDia(item, alimentosPorId, recetasPorId) {
    if (item.tipo === 'receta') {
      var r = recetasPorId[item.ref];
      if (!r) return null;
      var t = totalReceta(r, alimentosPorId);
      return t.peso > 0 ? escalar(t.total, item.gramos / t.peso) : escalar(CERO, 0);
    }
    var a = alimentosPorId[item.ref];
    return a ? porcion(a, item.gramos) : null;
  }

  /** Total del día. Devuelve { total, porItem[] (null si falta), faltan[] (líneas sin alimento o receta) }. */
  function totalDia(items, alimentosPorId, recetasPorId) {
    var faltan = [];
    var porItem = (items || []).map(function (it) {
      var m = itemDia(it, alimentosPorId, recetasPorId);
      if (!m) faltan.push(it);
      return m;
    });
    return {
      total: sumar(porItem.map(function (m) { return m || CERO; })),
      porItem: porItem,
      faltan: faltan
    };
  }

  // ---------- Semana (paso 4) ----------
  var DIAS_SEMANA = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

  /**
   * Totales de la semana de un perfil. semana = { lun: [líneas], ... }.
   * Devuelve { porDia: { lun: { total, lineas } }, total, diasConPlan, promedio (sobre los días con plan) }.
   */
  function totalesSemana(semana, alimentosPorId, recetasPorId) {
    var porDia = {};
    var conPlan = [];
    DIAS_SEMANA.forEach(function (d) {
      var items = (semana && semana[d]) || [];
      porDia[d] = { total: totalDia(items, alimentosPorId, recetasPorId).total, lineas: items.length };
      if (items.length) conPlan.push(porDia[d].total);
    });
    var total = sumar(conPlan);
    return {
      porDia: porDia,
      total: total,
      diasConPlan: conPlan.length,
      promedio: conPlan.length ? escalar(total, 1 / conPlan.length) : null
    };
  }

  /**
   * Lista para preparar la comida: gramos totales de cada alimento en las líneas dadas.
   * Las recetas se abren en sus ingredientes en proporción a lo que se come
   * (gramos de la línea ÷ peso de la receta × gramos de cada ingrediente).
   * lineas = todas las líneas de los días y perfiles elegidos.
   * Devuelve { alimentos: [{ ref, gramos, veces }] (de mayor a menor), recetas: [{ ref, gramos, veces }], faltan }.
   */
  function listaPreparacion(lineas, alimentosPorId, recetasPorId) {
    var al = {};
    var rec = {};
    var faltan = 0;
    function sumarAlimento(ref, g) {
      if (!alimentosPorId[ref]) { faltan += 1; return; }
      if (!al[ref]) al[ref] = { ref: ref, gramos: 0, veces: 0 };
      al[ref].gramos += g;
      al[ref].veces += 1;
    }
    (lineas || []).forEach(function (it) {
      if (it.tipo === 'receta') {
        var r = recetasPorId[it.ref];
        if (!r) { faltan += 1; return; }
        var peso = totalReceta(r, alimentosPorId).peso;
        var f = peso > 0 ? it.gramos / peso : 0;
        if (!rec[it.ref]) rec[it.ref] = { ref: it.ref, gramos: 0, veces: 0 };
        rec[it.ref].gramos += it.gramos;
        rec[it.ref].veces += 1;
        r.ingredientes.forEach(function (ing) { sumarAlimento(ing.ref, ing.gramos * f); });
      } else {
        sumarAlimento(it.ref, it.gramos);
      }
    });
    function orden(a, b) { return b.gramos - a.gramos; }
    return {
      alimentos: Object.keys(al).map(function (k) { return al[k]; }).sort(orden),
      recetas: Object.keys(rec).map(function (k) { return rec[k]; }).sort(orden),
      faltan: faltan
    };
  }

  /** Objetivo del día en el mismo formato que los totales, a partir de calcPerfil(). */
  function objetivoDia(resPerfil) {
    if (!resPerfil || !resPerfil.valido) return null;
    var m = resPerfil.macros;
    return { kcal: resPerfil.objetivo, prot: m.prot.g, grasa: m.grasa.g, carbs: m.carbs.g };
  }

  /** Objetivo − Total (positivo = te falta, negativo = te pasaste), como en la hoja "Objetivo". */
  function diferencia(obj, total) {
    return {
      kcal: obj.kcal - total.kcal,
      grasa: obj.grasa - total.grasa,
      carbs: obj.carbs - total.carbs,
      prot: obj.prot - total.prot
    };
  }

  // ---------- Gasto del entrenamiento (Compendio de Actividades Físicas 2024) ----------
  // https://pacompendium.com — valores MET por código de actividad.
  var MET = {
    boxeoSaco: { valor: 5.8, codigo: '15110', nombre: 'Boxeo, saco' },
    boxeoSaco60: { valor: 7.0, codigo: '15113', nombre: 'Boxeo, saco, 60 golpes/min' },
    boxeoSparring: { valor: 7.8, codigo: '15120', nombre: 'Boxeo, sparring' },
    boxeoRound: { valor: 9.3, codigo: '15125', nombre: 'Boxeo, round simulado (ejercicio)' },
    kickboxing: { valor: 7.3, codigo: '15457', nombre: 'Kickboxing' },
    artesMarcialesModerado: { valor: 10.3, codigo: '15430', nombre: 'Artes marciales, ritmo moderado (incluye kickboxing)' },
    cuerdaLenta: { valor: 8.3, codigo: '15552', nombre: 'Salto de cuerda, lento (<100 saltos/min)' },
    cuerdaGeneral: { valor: 11.0, codigo: '02068', nombre: 'Salto de cuerda, general' },
    cuerdaModerada: { valor: 11.8, codigo: '15551', nombre: 'Salto de cuerda, moderado (100–120 saltos/min)' },
    remoModerado: { valor: 5.0, codigo: '02071', nombre: 'Remo en máquina, moderado (<100 W)' },
    remoVigoroso: { valor: 7.3, codigo: '02070', nombre: 'Remo en máquina, vigoroso' },
    remo100W: { valor: 7.5, codigo: '02072', nombre: 'Remo en máquina, 100–149 W' },
    pesasVarias: { valor: 3.5, codigo: '02054', nombre: 'Pesas, varios ejercicios, 8–15 reps' },
    circuitoModerado: { valor: 5.0, codigo: '02035', nombre: 'Circuito, esfuerzo moderado' },
    pesasVigoroso: { valor: 6.0, codigo: '02050', nombre: 'Pesas, esfuerzo vigoroso' },
    calisteniaVigorosa: { valor: 7.5, codigo: '02020', nombre: 'Calistenia vigorosa (flexiones, abdominales…)' }
  };
  // Gasto de estar sentado (≈ 1,5 × basal, FAO). El entreno se cuenta como extra sobre eso.
  var MET_SENTADO = 1.5;

  /** kcal extra de una actividad frente a estar sentado: (MET − 1,5) × kg × horas. */
  function kcalActividad(met, pesoKg, minutos, metBase) {
    var base = metBase == null ? MET_SENTADO : metBase;
    return Math.max(0, met - base) * pesoKg * (minutos / 60);
  }

  /**
   * Sesión por rounds: boxeo en cada round y ejercicio con pesas en cada descanso.
   * o = { peso, rounds, minRound, minDescanso, descansos (por defecto = rounds), metBoxeo, metDescanso }
   */
  function sesionRounds(o) {
    var descansos = o.descansos == null ? o.rounds : o.descansos;
    var minBoxeo = o.rounds * o.minRound;
    var minDesc = descansos * o.minDescanso;
    var kB = kcalActividad(o.metBoxeo, o.peso, minBoxeo);
    var kD = kcalActividad(o.metDescanso, o.peso, minDesc);
    return { minBoxeo: minBoxeo, minDescanso: minDesc, minutos: minBoxeo + minDesc, kcalBoxeo: kB, kcalDescanso: kD, kcal: kB + kD };
  }

  /**
   * Sesión armada por bloques: [{ nombre, minutos, met }]. Devuelve minutos, kcal y el detalle por bloque.
   */
  function sesionBloques(pesoKg, bloques) {
    var detalle = bloques.map(function (b) {
      return { nombre: b.nombre, minutos: b.minutos, met: b.met, kcal: kcalActividad(b.met, pesoKg, b.minutos) };
    });
    return {
      minutos: detalle.reduce(function (a, b) { return a + b.minutos; }, 0),
      kcal: detalle.reduce(function (a, b) { return a + b.kcal; }, 0),
      detalle: detalle
    };
  }

  /**
   * Factor de actividad equivalente: (TMB × nivel del resto del día + kcal de entreno por día) ÷ TMB.
   * palBase: cómo es tu día sin el entreno. FAO: un oficinista urbano ronda 1,55;
   * una hora diaria de ejercicio moderado a vigoroso lo sube a ≈ 1,75.
   */
  function factorEquivalente(tmbKcal, palBase, kcalEntrenoSemana) {
    return (tmbKcal * palBase + kcalEntrenoSemana / 7) / tmbKcal;
  }

  // ≈ 7.700 kcal por kg de tejido graso perdido (aproximación clásica).
  var KCAL_POR_KG = 7700;
  /** Cambio de peso semanal esperado por el ajuste (negativo = bajar). */
  function ritmoSemanal(ajuste, peso) {
    var kg = (ajuste * 7) / KCAL_POR_KG;
    return { kg: kg, pct: (kg / peso) * 100 };
  }

  // ---------- Ejercicio de cada día ----------
  // entreno = { palBase, dias: { lun: [{ nombre, met, minutos, nota, rounds? }], ... } }
  // rounds (opcional) = { n, min, descanso, ejercicios: [{ nombre, codigo, met, metTope, reps, tope } | null, ...] }:
  //   n rounds de `min` minutos de la actividad, cada uno seguido de un descanso de `descanso` minutos;
  //   ejercicios[i] es lo que se hizo en el descanso i (null = descanso sin ejercicio, no suma).
  //   tope = ese minuto fue a tope: usa metTope (el MET vigoroso de su tipo) si lo tiene.

  /** MET con que cuenta un descanso: el vigoroso si fue a tope y su tipo lo tiene. */
  function metDescanso(e) {
    return e.tope && esNum(e.metTope) ? e.metTope : e.met;
  }

  /**
   * Minutos y kcal extra de una actividad, con sus descansos si va por rounds. Las reps se cuentan
   * por ejercicio, pero no cambian las kcal: el Compendio da el gasto por minuto, no por repetición.
   */
  function detalleActividad(x, peso) {
    var r = x && x.rounds;
    var minPrincipal = r ? r.n * r.min : x.minutos;
    var kPrincipal = kcalActividad(x.met, peso, minPrincipal);
    var slots = r && r.descanso > 0 ? (r.ejercicios || []).slice(0, r.n) : [];
    var kDesc = 0;
    var conEjercicio = 0;
    var porEjercicio = [];
    slots.forEach(function (e) {
      if (!e) return;
      conEjercicio += 1;
      kDesc += kcalActividad(metDescanso(e), peso, r.descanso);
      var t = porEjercicio.find(function (y) { return y.nombre === e.nombre; });
      if (!t) { t = { nombre: e.nombre, descansos: 0, aTope: 0, reps: 0, sinReps: 0 }; porEjercicio.push(t); }
      t.descansos += 1;
      if (metDescanso(e) !== e.met) t.aTope += 1;
      if (esNum(e.reps)) t.reps += e.reps; else t.sinReps += 1;
    });
    var minDesc = r ? r.n * r.descanso : 0;
    return {
      minutos: minPrincipal + minDesc,
      minPrincipal: minPrincipal,
      minDescansos: minDesc,
      kcalPrincipal: kPrincipal,
      kcalDescansos: kDesc,
      kcal: kPrincipal + kDesc,
      descansos: r ? r.n : 0,
      conEjercicio: conEjercicio,
      porEjercicio: porEjercicio
    };
  }

  /** kcal extra del ejercicio de un día: suma de (MET − 1,5) × kg × horas de cada actividad (y de sus descansos). */
  function kcalEjercicioDia(actividades, peso) {
    return (actividades || []).reduce(function (s, x) { return s + detalleActividad(x, peso).kcal; }, 0);
  }

  /**
   * El perfil calculado para un día de la semana. Con modo «ejercicio», el gasto de ese día es
   * TMB × resto del día + su ejercicio; con modo «factor», el de siempre (TMB × factor).
   */
  function calcPerfilDia(p, entreno, dia) {
    if (p.modo !== 'ejercicio') return calcPerfil(p);
    var e = entreno || {};
    var lista = (e.dias && e.dias[dia]) || [];
    return calcPerfil(p, { palBase: e.palBase, kcalEjercicio: esNum(p.peso) ? kcalEjercicioDia(lista, p.peso) : NaN });
  }

  /**
   * Los 7 días del perfil y su promedio. Devuelve
   * { porDia: { lun: resultado de calcPerfil, ... }, promedio: { tdee, objetivo, kcal, prot, grasa, carbs, kcalEjercicio } | null }.
   */
  function calcSemanaPerfil(p, entreno) {
    var porDia = {};
    var suma = { tdee: 0, objetivo: 0, kcal: 0, prot: 0, grasa: 0, carbs: 0, kcalEjercicio: 0 };
    var validos = 0;
    DIAS_SEMANA.forEach(function (d) {
      var r = calcPerfilDia(p, entreno, d);
      porDia[d] = r;
      if (!r.valido) return;
      validos += 1;
      suma.tdee += r.tdee;
      suma.objetivo += r.objetivo;
      suma.kcal += r.objetivo;
      suma.prot += r.macros.prot.g;
      suma.grasa += r.macros.grasa.g;
      suma.carbs += r.macros.carbs.g;
      suma.kcalEjercicio += r.kcalEjercicio || 0;
    });
    if (validos < 7) return { porDia: porDia, promedio: null };
    Object.keys(suma).forEach(function (k) { suma[k] /= 7; });
    return { porDia: porDia, promedio: suma };
  }

  // ---------- Registro de peso y calibración (paso 5) ----------

  /** 'AAAA-MM-DD' → número de día (UTC), para no depender de la zona horaria. NaN si no es una fecha real. */
  function diaNum(fecha) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fecha || ''));
    if (!m) return NaN;
    var n = Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000;
    return fechaDeNum(n) === fecha ? n : NaN;
  }
  function fechaDeNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
  /** Lunes de la semana de una fecha. */
  function lunesDe(fecha) {
    var n = diaNum(fecha);
    var dow = (new Date(n * 86400000).getUTCDay() + 6) % 7;
    return fechaDeNum(n - dow);
  }

  /** Promedio de cada semana (lunes a domingo), la más reciente primero, con el cambio frente a la anterior. */
  function promediosSemanales(registros) {
    var g = {};
    (registros || []).forEach(function (r) {
      if (!isFinite(diaNum(r.fecha))) return;
      var l = lunesDe(r.fecha);
      (g[l] = g[l] || []).push(r.kg);
    });
    var out = Object.keys(g).sort().map(function (l) {
      var xs = g[l];
      return { semana: l, promedio: xs.reduce(function (a, b) { return a + b; }, 0) / xs.length, n: xs.length };
    });
    out.forEach(function (w, i) { w.cambio = i > 0 ? w.promedio - out[i - 1].promedio : null; });
    return out.reverse();
  }

  /**
   * Tendencia del peso: recta de mínimos cuadrados con los registros de los últimos `dias` días
   * (contados desde el último registro). suficiente = al menos 4 registros en 14 días o más.
   */
  function tendenciaPeso(registros, dias) {
    dias = dias || 28;
    var pts = (registros || [])
      .map(function (r) { return { x: diaNum(r.fecha), y: r.kg }; })
      .filter(function (p) { return isFinite(p.x) && isFinite(p.y); })
      .sort(function (a, b) { return a.x - b.x; });
    if (!pts.length) return null;
    var fin = pts[pts.length - 1].x;
    pts = pts.filter(function (p) { return p.x > fin - dias; });
    var n = pts.length;
    var res = {
      n: n, spanDias: pts[n - 1].x - pts[0].x, desde: fechaDeNum(pts[0].x), hasta: fechaDeNum(fin),
      ultimo: pts[n - 1].y, kgSemana: null, suficiente: false
    };
    if (n < 2 || res.spanDias === 0) return res;
    var mx = pts.reduce(function (a, p) { return a + p.x; }, 0) / n;
    var my = pts.reduce(function (a, p) { return a + p.y; }, 0) / n;
    var sxy = 0;
    var sxx = 0;
    pts.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); });
    res.kgSemana = (sxy / sxx) * 7;
    res.suficiente = n >= 4 && res.spanDias >= 14;
    return res;
  }

  /** Mantenimiento real: lo que comes en promedio menos lo que explica el cambio de peso. */
  function tdeeReal(ingestaPromedio, kgSemana) {
    return ingestaPromedio - (kgSemana * KCAL_POR_KG) / 7;
  }

  // ---------- Chequeo contra guías de nutrición ----------
  var FUENTES = {
    msj: 'Frankenfield y col., J Am Diet Assoc 2005',
    morton: 'Morton y col., Br J Sports Med 2018; ISSN 2017',
    amdr: 'Rangos AMDR, Institute of Medicine',
    acsm: 'Posición conjunta ACSM/AND/DC 2016',
    helms: 'Helms y col., JISSN 2014',
    fao: 'FAO/OMS/UNU 2004, cap. 5'
  };

  /**
   * Revisa un perfil ya calculado contra las guías. Devuelve una lista de
   * { id, titulo, valor, guia, estado: 'ok' | 'warn' | 'info', nota, fuente }.
   */
  function chequeoGuias(p, r) {
    if (!r || !r.valido) return [];
    var m = r.macros;
    var lista = [];
    function n1(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }
    function n2(x) { return (Math.round(x * 100) / 100).toString().replace('.', ','); }

    lista.push({
      id: 'tmb', titulo: 'Fórmula de la TMB', valor: 'Mifflin-St Jeor', guia: 'La más precisa de las ecuaciones comunes',
      estado: 'ok', nota: 'Aun así puede errar ±10 % en una persona concreta.', fuente: FUENTES.msj
    });

    var pg = p.protGkg;
    lista.push({
      id: 'prot', titulo: 'Proteína', valor: n1(pg) + ' g/kg', guia: '1,6–2,2 g/kg',
      estado: pg < 1.4 ? 'warn' : pg <= 2.2 ? 'ok' : 'info',
      nota: pg < 1.4 ? 'Por debajo de 1,4 g/kg, el mínimo que recomienda la ISSN para quien entrena.'
        : pg <= 2.2 ? 'Dentro del rango con el que se maximiza la ganancia o conservación de músculo.'
          : 'Por encima de 2,2 g/kg no suma músculo; en déficit puede ayudar a conservarlo (hasta 2,3–3,1 g/kg de masa magra).',
      fuente: FUENTES.morton
    });

    var gp = m.grasa.pct;
    lista.push({
      id: 'grasa', titulo: 'Grasa', valor: n1(gp) + ' % · ' + n1(m.grasa.g / p.peso) + ' g/kg', guia: '20–35 % de las kcal',
      estado: gp >= 20 && gp <= 35 ? 'ok' : 'warn',
      nota: gp < 20 ? 'Menos del 20 % puede afectar hormonas y absorción de vitaminas.' : gp > 35 ? 'Más del 35 % deja poco espacio para carbohidratos.' : 'Dentro del rango.',
      fuente: FUENTES.amdr
    });

    var cgk = m.carbs.g / p.peso;
    lista.push({
      id: 'carbs', titulo: 'Carbohidratos', valor: n1(cgk) + ' g/kg', guia: '3–5 g/kg (ligero) · 5–7 g/kg (~1 h/día)',
      estado: cgk < 3 ? 'warn' : 'ok',
      nota: cgk < 3 ? 'Por debajo de lo que piden los entrenos intensos; puede bajar el rendimiento en los rounds.'
        : cgk < 5 ? 'Alcanza para entrenar; con sesiones intensas de ~1 h diaria la guía sube a 5–7 g/kg. En déficit es normal quedar abajo.'
          : 'Dentro del rango para entrenamiento moderado a intenso.',
      fuente: FUENTES.acsm
    });

    var rs = ritmoSemanal(p.ajuste, p.peso);
    var pct = Math.abs(rs.pct);
    lista.push({
      id: 'ritmo', titulo: 'Ritmo esperado',
      valor: p.ajuste === 0 ? 'mantener' : (rs.kg < 0 ? '−' : '+') + n2(Math.abs(rs.kg)) + ' kg/sem (' + n2(pct) + ' %)',
      guia: 'Bajar 0,5–1 % del peso por semana',
      estado: p.ajuste >= 0 ? 'info' : pct > 1 ? 'warn' : 'ok',
      nota: p.ajuste > 0 ? 'Superávit: el peso debería subir.'
        : p.ajuste === 0 ? 'Mantenimiento.'
          : pct > 1 ? 'Más rápido que 1 % por semana: más riesgo de perder músculo.'
            : pct < 0.5 ? 'Más lento que 0,5 % por semana: conservador, protege el músculo pero tarda más.'
              : 'Dentro del rango que mejor conserva el músculo.',
      fuente: FUENTES.helms
    });

    var margen = r.tdee * 0.1;
    var aj = Math.abs(p.ajuste);
    var ratio = aj > 0 ? margen / aj : 0;
    lista.push({
      id: 'factor', titulo: r.modo === 'ejercicio' ? 'Gasto del día' : 'Factor de actividad',
      valor: r.modo === 'ejercicio' ? 'base × ' + String(r.palBase).replace('.', ',') + ' + ejercicio' : '× ' + String(p.factor).replace('.', ','),
      guia: 'Comprobarlo con tu peso',
      estado: ratio >= 0.75 ? 'warn' : 'info',
      nota: 'Es la parte más incierta del cálculo: un error del 10 % son ' + Math.round(margen) + ' kcal' +
        (aj > 0 ? ', ' + (ratio >= 1 ? 'más que' : ratio >= 0.75 ? 'casi lo mismo que' : 'menos que') + ' tu ajuste de ' + aj + ' kcal' : '') +
        '. Si en 2–3 semanas el peso no se mueve como se espera, ' + (r.modo === 'ejercicio' ? 'ajusta el nivel del resto del día.' : 'ajusta el factor.'),
      fuente: FUENTES.fao
    });

    return lista;
  }

  return {
    KCAL_POR_G: KCAL_POR_G,
    FACTORES: FACTORES,
    RANGOS: RANGOS,
    MET: MET,
    MET_SENTADO: MET_SENTADO,
    KCAL_POR_KG: KCAL_POR_KG,
    FUENTES: FUENTES,
    kcalActividad: kcalActividad,
    sesionRounds: sesionRounds,
    sesionBloques: sesionBloques,
    detalleActividad: detalleActividad,
    metDescanso: metDescanso,
    kcalEjercicioDia: kcalEjercicioDia,
    calcPerfilDia: calcPerfilDia,
    calcSemanaPerfil: calcSemanaPerfil,
    diaNum: diaNum,
    lunesDe: lunesDe,
    promediosSemanales: promediosSemanales,
    tendenciaPeso: tendenciaPeso,
    tdeeReal: tdeeReal,
    factorEquivalente: factorEquivalente,
    ritmoSemanal: ritmoSemanal,
    chequeoGuias: chequeoGuias,
    tmb: tmb,
    tdee: tdee,
    objetivo: objetivo,
    macros: macros,
    imc: imc,
    imcCategoria: imcCategoria,
    calcPerfil: calcPerfil,
    porcion: porcion,
    revisarAlimento: revisarAlimento,
    indexar: indexar,
    totalReceta: totalReceta,
    itemDia: itemDia,
    totalDia: totalDia,
    totalesSemana: totalesSemana,
    listaPreparacion: listaPreparacion,
    objetivoDia: objetivoDia,
    sumar: sumar,
    diferencia: diferencia
  };
});
