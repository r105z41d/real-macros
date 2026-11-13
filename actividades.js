/*
 * Catálogo de actividades con su MET del 2024 Adult Compendium of Physical Activities (pacompendium.com).
 * Cada entrada: { codigo, nombre, met, grupo, claves } — `claves` son otras palabras con que se busca
 * (nombres de ejercicios, sinónimos, inglés). Velocidades pasadas de mph a km/h.
 * Se carga igual en el navegador (window.Actividades) y en Node (require).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Actividades = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function a(codigo, met, nombre, grupo, claves) {
    return { codigo: codigo, met: met, nombre: nombre, grupo: grupo, claves: claves || '' };
  }

  var CATALOGO = [
    // Combate
    a('15457', 7.3, 'Kickboxing', 'Combate', 'kick boxing patadas saco pesado'),
    a('15110', 5.8, 'Boxeo en saco, suave', 'Combate', 'boxeo saco pesado bag golpes'),
    a('15113', 7.0, 'Boxeo en saco, 60 golpes/min', 'Combate', 'boxeo saco pesado bag golpes'),
    a('15115', 8.5, 'Boxeo en saco, 120 golpes/min', 'Combate', 'boxeo saco pesado bag golpes'),
    a('15118', 10.8, 'Boxeo en saco, 180 golpes/min', 'Combate', 'boxeo saco pesado bag golpes'),
    a('15120', 7.8, 'Boxeo, sparring', 'Combate', 'boxeo guantear pelea'),
    a('15125', 9.3, 'Boxeo, round simulado (ejercicio)', 'Combate', 'boxeo sombra shadow boxing rounds'),
    a('15100', 12.3, 'Boxeo en ring, pelea', 'Combate', 'boxeo combate competencia'),
    a('15430', 10.3, 'Artes marciales, ritmo moderado', 'Combate', 'karate taekwondo muay thai jiu jitsu jujitsu kickboxing'),
    a('15425', 5.3, 'Artes marciales, ritmo lento (principiante)', 'Combate', 'karate taekwondo muay thai jiu jitsu'),
    a('15433', 11.3, 'Judo', 'Combate', 'judo'),

    // Fuerza y gimnasio
    a('02054', 3.5, 'Pesas o mancuernas, varios ejercicios (8–15 reps)', 'Fuerza y gimnasio',
      'pesas mancuernas curl biceps triceps press hombro militar elevaciones laterales aperturas flyes remo con mancuerna rows extension pecho gimnasio'),
    a('02050', 6.0, 'Pesas, esfuerzo vigoroso (fisicoculturismo, powerlifting)', 'Fuerza y gimnasio', 'pesas pesado fisicoculturismo powerlifting levantamiento'),
    a('02052', 5.0, 'Sentadilla o peso muerto con peso', 'Fuerza y gimnasio',
      'sentadilla sentadillas goblet squat peso muerto rumano deadlift thrusters zancadas con peso lunges step ups'),
    a('02055', 5.8, 'Circuito con pesas (superseries)', 'Fuerza y gimnasio', 'circuito superseries pesas'),
    a('02035', 5.0, 'Circuito, esfuerzo moderado', 'Fuerza y gimnasio', 'circuito funcional estaciones'),
    a('02040', 7.5, 'Circuito vigoroso (kettlebells, poco descanso)', 'Fuerza y gimnasio', 'circuito kettlebell pesa rusa funcional'),
    a('02056', 3.0, 'Ejercicios con peso corporal, suave', 'Fuerza y gimnasio', 'peso corporal sentadillas zancadas flexiones abdominales'),
    a('02057', 6.5, 'Ejercicios con peso corporal, intenso', 'Fuerza y gimnasio', 'peso corporal sentadillas zancadas flexiones abdominales trx'),
    a('02022', 3.8, 'Calistenia moderada (flexiones, abdominales, dominadas)', 'Fuerza y gimnasio',
      'calistenia flexiones lagartijas push ups pushups abdominales sit ups dominadas pull ups zancadas'),
    a('02020', 7.5, 'Calistenia vigorosa (flexiones, burpees, jumping jacks)', 'Fuerza y gimnasio',
      'calistenia flexiones lagartijas push ups pushups burpees jumping jacks dominadas cuerdas de batalla battle ropes'),
    a('02024', 2.8, 'Abdominales suaves y plancha', 'Fuerza y gimnasio', 'abdominales crunch plancha plank rodillo russian twist core'),
    a('02058', 9.8, 'Swings con kettlebell', 'Fuerza y gimnasio', 'kettlebell pesa rusa swing'),
    a('02210', 7.0, 'Intervalos de alta intensidad (HIIT), moderado', 'Fuerza y gimnasio', 'hiit intervalos tabata'),
    a('02214', 11.0, 'HIIT vigoroso (burpees, mountain climbers, saltos, Tabata)', 'Fuerza y gimnasio', 'hiit burpees mountain climbers saltos tabata intervalos'),
    a('02060', 5.5, 'Gimnasio, ejercicio general', 'Fuerza y gimnasio', 'gimnasio gym'),
    a('02062', 7.8, 'Clase de acondicionamiento en gimnasio (funcional)', 'Fuerza y gimnasio', 'funcional acondicionamiento clase crossfit'),

    // Cuerda y máquinas
    a('02068', 11.0, 'Salto de cuerda, general', 'Cuerda y máquinas', 'cuerda saltar comba jump rope'),
    a('15552', 8.3, 'Salto de cuerda, lento (menos de 100 saltos/min)', 'Cuerda y máquinas', 'cuerda saltar comba jump rope'),
    a('15551', 11.8, 'Salto de cuerda, moderado (100–120 saltos/min)', 'Cuerda y máquinas', 'cuerda saltar comba jump rope'),
    a('15550', 12.3, 'Salto de cuerda, rápido (120–160 saltos/min)', 'Cuerda y máquinas', 'cuerda saltar comba jump rope'),
    a('15554', 10.0, 'Salto de cuerda, dobles saltos', 'Cuerda y máquinas', 'cuerda saltar comba double unders'),
    a('02071', 5.0, 'Remo en máquina, moderado (menos de 100 W)', 'Cuerda y máquinas', 'remo rowing ergometro maquina de remo'),
    a('02070', 7.3, 'Remo en máquina, vigoroso', 'Cuerda y máquinas', 'remo rowing ergometro maquina de remo'),
    a('02072', 7.5, 'Remo en máquina, 100–149 W', 'Cuerda y máquinas', 'remo rowing ergometro maquina de remo'),
    a('02073', 11.0, 'Remo en máquina, 150–199 W', 'Cuerda y máquinas', 'remo rowing ergometro maquina de remo'),
    a('02048', 5.0, 'Elíptica, moderado', 'Cuerda y máquinas', 'eliptica elliptical'),
    a('02049', 9.0, 'Elíptica, vigoroso', 'Cuerda y máquinas', 'eliptica elliptical'),
    a('02065', 9.3, 'Escaladora (stair master)', 'Cuerda y máquinas', 'escaladora escaleras stairmaster stepper'),
    a('01200', 6.8, 'Bicicleta estática, general', 'Cuerda y máquinas', 'bicicleta estatica bici fija'),
    a('01214', 4.0, 'Bicicleta estática, suave (50 W)', 'Cuerda y máquinas', 'bicicleta estatica bici fija'),
    a('01220', 6.0, 'Bicicleta estática, moderada (90–100 W)', 'Cuerda y máquinas', 'bicicleta estatica bici fija'),
    a('01236', 10.8, 'Bicicleta estática, vigorosa (200–229 W)', 'Cuerda y máquinas', 'bicicleta estatica bici fija'),
    a('01270', 9.0, 'Spinning (clase)', 'Cuerda y máquinas', 'spinning spin bicicleta estatica clase'),

    // Caminar y correr
    a('17152', 2.8, 'Caminar despacio (3–4 km/h)', 'Caminar y correr', 'caminar andar paseo'),
    a('17190', 3.8, 'Caminar a paso moderado (4,5–5,5 km/h)', 'Caminar y correr', 'caminar andar'),
    a('17200', 4.8, 'Caminar rápido (5,6–6,3 km/h)', 'Caminar y correr', 'caminar andar caminata ejercicio'),
    a('17220', 5.5, 'Caminar muy rápido (6,4–7,1 km/h)', 'Caminar y correr', 'caminar andar marcha'),
    a('17230', 7.0, 'Caminar muy, muy rápido (7,2–7,9 km/h)', 'Caminar y correr', 'caminar marcha'),
    a('17270', 4.0, 'Caminar al trabajo o a clase', 'Caminar y correr', 'caminar trabajo universidad'),
    a('17165', 3.0, 'Pasear al perro', 'Caminar y correr', 'perro mascota pasear'),
    a('17082', 5.3, 'Caminata por cerros, paso normal', 'Caminar y correr', 'senderismo caminata montana cerro trekking'),
    a('17080', 6.0, 'Senderismo a campo traviesa', 'Caminar y correr', 'senderismo caminata montana trekking hiking'),
    a('17012', 7.8, 'Caminata con morral', 'Caminar y correr', 'senderismo morral mochila trekking'),
    a('17131', 6.8, 'Subir escaleras, general', 'Caminar y correr', 'escaleras subir'),
    a('17133', 4.5, 'Subir escaleras, despacio', 'Caminar y correr', 'escaleras subir'),
    a('17134', 9.3, 'Subir escaleras, rápido', 'Caminar y correr', 'escaleras subir'),
    a('12020', 7.5, 'Trotar a ritmo propio', 'Caminar y correr', 'trotar trote correr jogging'),
    a('12028', 6.5, 'Correr a 6,4–6,8 km/h', 'Caminar y correr', 'correr trotar running'),
    a('12030', 8.5, 'Correr a 8,0–8,4 km/h', 'Caminar y correr', 'correr trotar running'),
    a('12050', 9.3, 'Correr a 9,7–10,1 km/h', 'Caminar y correr', 'correr running'),
    a('12070', 11.0, 'Correr a 11,3 km/h', 'Caminar y correr', 'correr running'),
    a('12090', 12.0, 'Correr a 12,9 km/h', 'Caminar y correr', 'correr running'),
    a('12110', 13.0, 'Correr a 14,5 km/h', 'Caminar y correr', 'correr running'),
    a('12120', 14.8, 'Correr a 16,1 km/h', 'Caminar y correr', 'correr running'),
    a('12140', 9.3, 'Correr a campo traviesa', 'Caminar y correr', 'correr trail montana'),
    a('12170', 15.0, 'Subir escaleras corriendo', 'Caminar y correr', 'escaleras correr'),

    // Bicicleta
    a('01014', 7.0, 'Bicicleta, general', 'Bicicleta', 'bicicleta bici ciclismo'),
    a('01010', 4.0, 'Bicicleta de paseo (menos de 16 km/h)', 'Bicicleta', 'bicicleta bici paseo transporte'),
    a('01020', 6.8, 'Bicicleta, 16–19 km/h', 'Bicicleta', 'bicicleta bici ciclismo'),
    a('01030', 8.0, 'Bicicleta, 19–22 km/h', 'Bicicleta', 'bicicleta bici ciclismo'),
    a('01040', 10.0, 'Bicicleta, 22,5–25,6 km/h', 'Bicicleta', 'bicicleta bici ciclismo ruta'),
    a('01009', 8.5, 'Bicicleta de montaña', 'Bicicleta', 'bicicleta bici mtb montana'),

    // Natación
    a('18240', 5.8, 'Nadar libre, despacio (recreativo)', 'Natación', 'nadar natacion piscina crol'),
    a('18230', 9.8, 'Nadar libre, rápido', 'Natación', 'nadar natacion piscina crol'),
    a('18265', 5.3, 'Nadar pecho, recreativo', 'Natación', 'nadar natacion piscina braza'),
    a('18260', 10.3, 'Nadar pecho, entrenamiento', 'Natación', 'nadar natacion piscina braza'),
    a('18255', 4.8, 'Nadar espalda, recreativo', 'Natación', 'nadar natacion piscina'),
    a('18250', 9.5, 'Nadar espalda, entrenamiento', 'Natación', 'nadar natacion piscina'),
    a('18270', 13.8, 'Nadar mariposa', 'Natación', 'nadar natacion piscina'),
    a('18355', 5.5, 'Aeróbicos acuáticos', 'Natación', 'aquaerobicos acuaticos piscina'),

    // Deportes
    a('15610', 7.0, 'Fútbol recreativo', 'Deportes', 'futbol microfutbol banquitas soccer partido'),
    a('15605', 9.5, 'Fútbol competitivo', 'Deportes', 'futbol soccer partido torneo'),
    a('15055', 7.5, 'Baloncesto, general', 'Deportes', 'baloncesto basketball basket'),
    a('15040', 8.0, 'Baloncesto, partido', 'Deportes', 'baloncesto basketball basket'),
    a('15675', 6.8, 'Tenis, moderado', 'Deportes', 'tenis'),
    a('15690', 8.0, 'Tenis, singles', 'Deportes', 'tenis'),
    a('15680', 6.0, 'Tenis, dobles', 'Deportes', 'tenis'),
    a('15710', 4.0, 'Voleibol', 'Deportes', 'voleibol voley volleyball'),
    a('15725', 8.0, 'Voleibol de playa', 'Deportes', 'voleibol voley playa arena'),
    a('15620', 5.0, 'Béisbol o sóftbol', 'Deportes', 'beisbol softbol'),
    a('15530', 7.0, 'Ráquetbol', 'Deportes', 'raquetbol raqueta'),
    a('15660', 4.0, 'Tenis de mesa (ping pong)', 'Deportes', 'ping pong tenis de mesa'),
    a('15533', 8.0, 'Escalada en roca o montaña', 'Deportes', 'escalada escalar roca'),
    a('15534', 8.8, 'Boulder', 'Deportes', 'escalada boulder'),
    a('15580', 5.0, 'Patineta (skate)', 'Deportes', 'patineta skate'),
    a('15560', 8.3, 'Rugby competitivo', 'Deportes', 'rugby'),
    a('15230', 8.0, 'Fútbol americano de bandera', 'Deportes', 'futbol americano flag tochito'),
    a('15250', 8.0, 'Ultimate frisbee', 'Deportes', 'frisbee ultimate'),

    // Baile y clases
    a('02005', 4.8, 'Aeróbicos, bajo impacto', 'Baile y clases', 'aerobicos rumba aerobica'),
    a('02006', 8.0, 'Aeróbicos, alto impacto', 'Baile y clases', 'aerobicos rumba aerobica'),
    a('02310', 6.5, 'Zumba (clase)', 'Baile y clases', 'zumba baile clase'),
    a('02315', 5.5, 'Zumba en casa (video)', 'Baile y clases', 'zumba baile video'),
    a('02001', 5.5, 'Step, escalón bajo', 'Baile y clases', 'step aerobicos'),
    a('02003', 9.0, 'Step, escalón alto', 'Baile y clases', 'step aerobicos'),
    a('03025', 4.5, 'Baile latino (salsa, merengue, flamenco)', 'Baile y clases', 'bailar baile salsa merengue flamenco'),
    a('03090', 4.8, 'Salsa en pareja', 'Baile y clases', 'bailar baile salsa'),
    a('03030', 5.5, 'Baile de salón, rápido', 'Baile y clases', 'bailar baile salon'),
    a('03040', 3.0, 'Baile de salón, lento', 'Baile y clases', 'bailar baile salon vals'),
    a('03031', 9.8, 'Baile de discoteca, vigoroso', 'Baile y clases', 'bailar baile discoteca rumba'),

    // Flexibilidad
    a('02150', 2.3, 'Yoga hatha', 'Flexibilidad', 'yoga'),
    a('02185', 2.7, 'Yoga vinyasa', 'Flexibilidad', 'yoga'),
    a('02160', 4.0, 'Power yoga', 'Flexibilidad', 'yoga power'),
    a('02153', 8.0, 'Yoga hatha, alta intensidad', 'Flexibilidad', 'yoga'),
    a('02105', 2.8, 'Pilates', 'Flexibilidad', 'pilates'),
    a('02101', 2.3, 'Estiramiento suave', 'Flexibilidad', 'estirar estiramientos stretching')
  ];

  /*
   * Ejercicios concretos para los descansos entre rounds. El Compendio no tiene un MET para cada ejercicio
   * (no hay «curl martillo»): cada uno toma el de su tipo en el Compendio, por su código.
   *   02054 mancuernas o pesas, varios ejercicios 3,5 · 02052 sentadilla o peso muerto con peso 5,0
   *   02022 calistenia moderada 3,8 · 02020 calistenia vigorosa 7,5 · 02024 abdominales y plancha 2,8
   *   02056 peso corporal suave 3,0 · 02058 swings con kettlebell 9,8
   */
  function ej(nombre, codigo, grupo, claves) {
    return { nombre: nombre, codigo: codigo, met: null, grupo: grupo, claves: claves || '' };
  }
  var EJERCICIOS = [
    ej('Flexiones', '02022', 'Pecho', 'push ups pushups lagartijas'),
    ej('Flexiones diamante', '02022', 'Pecho', 'diamond push ups triceps'),
    ej('Flexiones con rodillas o inclinadas', '02056', 'Pecho', 'knee push ups incline'),
    ej('Aperturas con mancuernas', '02054', 'Pecho', 'flyes floor flyes aperturas en el suelo'),
    ej('Press de pecho con mancuernas', '02054', 'Pecho', 'floor press bench press press de banca'),
    ej('Fondos en silla', '02022', 'Pecho', 'dips fondos triceps'),
    ej('Remo inclinado con mancuernas', '02054', 'Espalda', 'bent over rows remo'),
    ej('Remo a una mano', '02054', 'Espalda', 'single arm dumbbell row remo'),
    ej('Dominadas', '02022', 'Espalda', 'pull ups chin ups barra'),
    ej('Superman', '02056', 'Espalda', 'superman espalda baja lumbar'),
    ej('Press de hombros con mancuernas', '02054', 'Hombros', 'shoulder press press militar'),
    ej('Elevaciones laterales', '02054', 'Hombros', 'lateral raises'),
    ej('Elevaciones frontales', '02054', 'Hombros', 'front raises'),
    ej('Pájaros (aperturas invertidas)', '02054', 'Hombros', 'reverse fly rear delt'),
    ej('Curl de bíceps', '02054', 'Brazos', 'bicep curls curl alterno alternating'),
    ej('Curl martillo', '02054', 'Brazos', 'hammer curls'),
    ej('Extensión de tríceps sobre la cabeza', '02054', 'Brazos', 'overhead tricep extension'),
    ej('Patada de tríceps', '02054', 'Brazos', 'tricep kickback'),
    ej('Sentadilla goblet', '02052', 'Piernas', 'goblet squat sentadilla con mancuerna'),
    ej('Sentadilla sin peso', '02022', 'Piernas', 'air squats bodyweight squat'),
    ej('Sentadilla con salto', '02020', 'Piernas', 'jump squats'),
    ej('Peso muerto rumano', '02052', 'Piernas', 'romanian deadlift rdl'),
    ej('Zancadas con mancuernas', '02052', 'Piernas', 'lunges estocadas'),
    ej('Subir al cajón o silla', '02052', 'Piernas', 'step ups'),
    ej('Puente de glúteo', '02054', 'Piernas', 'glute bridge hip thrust'),
    ej('Elevación de talones', '02054', 'Piernas', 'calf raises pantorrillas'),
    ej('Abdominales (crunch)', '02024', 'Abdomen', 'crunch sit ups'),
    ej('Plancha', '02024', 'Abdomen', 'plank'),
    ej('Giros rusos', '02024', 'Abdomen', 'russian twists'),
    ej('Flexiones laterales con mancuerna', '02024', 'Abdomen', 'side bends'),
    ej('Rueda abdominal (rodillo)', '02024', 'Abdomen', 'ab wheel rollout rodillo'),
    ej('Elevación de piernas', '02024', 'Abdomen', 'leg raises'),
    ej('Escaladores', '02020', 'Abdomen', 'mountain climbers'),
    ej('Burpees', '02020', 'Cuerpo completo', 'burpees'),
    ej('Saltos de tijera', '02020', 'Cuerpo completo', 'jumping jacks'),
    ej('Thrusters con mancuernas', '02052', 'Cuerpo completo', 'thrusters sentadilla press'),
    ej('Peso muerto con remo', '02052', 'Cuerpo completo', 'deadlift row combo'),
    ej('Leñador con mancuerna', '02054', 'Cuerpo completo', 'woodchoppers'),
    ej('Swing con kettlebell o mancuerna', '02058', 'Cuerpo completo', 'kettlebell swing pesa rusa')
  ];

  // Tipos para un ejercicio propio (que no está en la lista): su MET sale del código del Compendio.
  var TIPOS_EJERCICIO = [
    ['02054', 'Con mancuernas o pesas'],
    ['02052', 'Pierna con peso (sentadilla, peso muerto, zancadas)'],
    ['02022', 'Peso corporal (flexiones, dominadas)'],
    ['02020', 'Explosivo (burpees, saltos)'],
    ['02024', 'Abdomen y plancha']
  ];

  function normal(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  }

  var INDICE = CATALOGO.map(function (x) {
    return { x: x, nombre: normal(x.nombre), todo: normal(x.nombre + ' ' + x.claves + ' ' + x.codigo) };
  });

  /**
   * Busca por nombre, sinónimo o código. Todas las palabras de la búsqueda deben aparecer.
   * Primero las que empiezan con lo buscado, luego las que lo tienen en el nombre, luego por sinónimo.
   */
  function buscar(q, limite) {
    var t = normal(q);
    if (!t) return [];
    var palabras = t.split(' ');
    return INDICE
      .filter(function (e) { return palabras.every(function (p) { return e.todo.indexOf(p) >= 0; }); })
      .map(function (e) {
        var rango = e.nombre.indexOf(t) === 0 ? 0 : e.nombre.indexOf(t) > 0 ? 1 : palabras.every(function (p) { return e.nombre.indexOf(p) >= 0; }) ? 2 : 3;
        return { e: e, rango: rango };
      })
      .sort(function (a, b) { return a.rango - b.rango; })
      .slice(0, limite || 8)
      .map(function (r) { return r.e.x; });
  }

  function porCodigo(codigo) {
    return CATALOGO.find(function (x) { return x.codigo === codigo; }) || null;
  }

  /*
   * «A tope»: el mismo tipo de ejercicio con esfuerzo vigoroso en el Compendio (sin pausas, terminas sin aire).
   *   mancuernas 02054 (3,5) → pesas vigoroso 02050 (6,0) · pierna con peso 02052 (5,0) → 02050 (6,0)
   *   calistenia moderada 02022 (3,8) → vigorosa 02020 (7,5) · calistenia vigorosa 02020 (7,5) → HIIT vigoroso 02214 (11,0)
   *   abdominales suaves 02024 (2,8) → calistenia moderada 02022 (3,8) · peso corporal suave 02056 (3,0) → intenso 02057 (6,5)
   * Los que ya son lo más intenso de su tipo (swings 02058) no tienen «a tope».
   */
  var VIGOROSO = { '02054': '02050', '02052': '02050', '02022': '02020', '02020': '02214', '02024': '02022', '02056': '02057' };
  /** MET «a tope» de un tipo de ejercicio (por su código), o null si no tiene. */
  function metTope(codigo) {
    var v = Object.prototype.hasOwnProperty.call(VIGOROSO, codigo) ? porCodigo(VIGOROSO[codigo]) : null;
    return v ? v.met : null;
  }

  // El MET de cada ejercicio es el de su código en el catálogo; el de «a tope», el del código vigoroso.
  EJERCICIOS.forEach(function (x) { x.met = porCodigo(x.codigo).met; x.metTope = metTope(x.codigo); });
  var TIPOS = TIPOS_EJERCICIO.map(function (t) {
    return { codigo: t[0], nombre: t[1], met: porCodigo(t[0]).met, metTope: metTope(t[0]) };
  });

  return {
    CATALOGO: CATALOGO, EJERCICIOS: EJERCICIOS, TIPOS_EJERCICIO: TIPOS,
    buscar: buscar, porCodigo: porCodigo, normal: normal, metTope: metTope
  };
});
