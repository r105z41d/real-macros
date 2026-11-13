/*
 * REAL MACROS (versión instalable): registra el service worker, para que la app abra sin internet,
 * y muestra en Perfil cómo instalarla en el teléfono. Solo se incluye en la versión instalable.
 */
(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin service worker: igual funciona en línea */ });
    });
  }

  var card = document.getElementById('instalar-card');
  var texto = document.getElementById('instalar-texto');
  var boton = document.getElementById('btn-instalar');
  if (!card || !texto || !boton) return;

  var instalada = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  if (instalada) return;

  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var diferido = null; // el aviso de instalación que el navegador ofrece (Android, Chrome, Edge)

  function pintar() {
    card.hidden = false;
    if (diferido) {
      texto.textContent = 'Instálala para abrirla desde la pantalla de inicio, a pantalla completa y sin internet.';
      boton.hidden = false;
    } else if (ios) {
      texto.textContent = 'En iPhone: abre esta página en Safari, toca Compartir (el cuadro con la flecha hacia arriba) y elige «Agregar a pantalla de inicio».';
      boton.hidden = true;
    } else {
      texto.textContent = 'En Android: abre el menú del navegador (⋮) y elige «Instalar app» o «Agregar a pantalla de inicio». En el computador, usa el ícono de instalar de la barra de direcciones.';
      boton.hidden = true;
    }
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    diferido = e;
    pintar();
  });
  window.addEventListener('appinstalled', function () {
    diferido = null;
    card.hidden = true;
  });
  boton.addEventListener('click', function () {
    if (!diferido) return;
    var aviso = diferido;
    diferido = null;
    aviso.prompt();
    aviso.userChoice.then(function (r) {
      if (r && r.outcome === 'accepted') card.hidden = true;
      else pintar();
    }, pintar);
  });

  pintar();
})();
