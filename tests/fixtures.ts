/** Webs de prueba: una de un restaurante bien hecha y una de taller abandonada. */

export const BUENA = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Restaurante en Bilbao | Taberna del Puerto</title>
  <meta name="description" content="Restaurante en el Casco Viejo de Bilbao: pescado del día, brasa y pintxos de autor. Reserva tu mesa online o llámanos al 944 12 34 56.">
  <meta property="og:title" content="Taberna del Puerto">
  <meta property="og:image" content="https://taberna.example/og.jpg">
  <meta name="theme-color" content="#a3282d">
  <link rel="canonical" href="https://taberna.example/">
  <link rel="icon" href="/favicon.svg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Restaurant","name":"Taberna del Puerto","telephone":"+34944123456","address":{"@type":"PostalAddress","streetAddress":"Calle Somera 3","addressLocality":"Bilbao"}}</script>
  <script src="https://www.googletagmanager.com/gtag/js?id=G-ABC1234567" async></script>
  <script src="https://cdn.cookiebot.com/uc.js" data-cbid="x"></script>
  <style>.boton{background:#a3282d;color:#fff}.pie{border-color:#a3282d}</style>
</head>
<body>
  <header><a href="tel:+34944123456">944 12 34 56</a> <a href="https://reservas.covermanager.com/taberna">Reservar mesa</a></header>
  <h1>Restaurante de pescado en Bilbao</h1>
  <p>${'Cocina de mercado con el mejor pescado del Cantábrico, carnes a la brasa y una bodega con más de cien referencias. '.repeat(12)}</p>
  <img src="/img/sala.webp" alt="Sala del restaurante" width="800" height="600" loading="lazy" srcset="/img/sala-400.webp 400w">
  <img src="/img/pulpo.webp" alt="Pulpo a la brasa" width="800" height="600" loading="lazy" srcset="/img/pulpo-400.webp 400w">
  <img src="/img/bodega.webp" alt="Bodega" width="800" height="600" loading="lazy" srcset="/img/bodega-400.webp 400w">
  <a href="https://wa.me/34600111222">Escríbenos por WhatsApp</a>
  <a href="https://www.google.com/maps/place/Taberna">Cómo llegar</a>
  <a href="https://instagram.com/taberna">Instagram</a>
  <form><label for="n">Nombre</label><input id="n"><label for="t">Teléfono</label><input id="t"><button>Enviar</button></form>
  <footer>Calle Somera 3, 48005 Bilbao · © 2026 Taberna del Puerto · <a href="/aviso-legal">Aviso legal</a> · <a href="/privacidad">Política de privacidad</a> · <a href="/cookies">Política de cookies</a></footer>
</body>
</html>`

export const MALA = `<html>
<head>
  <title>Inicio</title>
  <meta name="viewport" content="width=device-width, user-scalable=no">
  <script src="http://taller.example/js/jquery.js"></script>
  <script src="/js/slider.js"></script>
  <script src="https://connect.facebook.net/es_ES/fbevents.js"></script>
  <link rel="stylesheet" href="/wp-content/themes/viejo/style.css">
</head>
<body>
  <div class="cabecera"><img src="/logo.png"></div>
  <h1>Bienvenidos</h1><h1>Talleres Pérez</h1>
  <p>Reparamos su coche. Llame al 944 55 66 77.</p>
  <img src="/foto1.jpg"><img src="/foto2.jpg"><img src="/foto3.jpg"><img src="/foto4.jpg"><img src="/foto5.jpg"><img src="/foto6.jpg">
  <button><i class="icono-menu"></i></button>
  <form><input type="text"><input type="email"><textarea></textarea></form>
  <p>Copyright © 2016 Talleres Pérez</p>
</body>
</html>`

export const SPA = `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mi tienda</title><script type="module" src="/assets/index-abc.js"></script></head><body><div id="root"></div></body></html>`
