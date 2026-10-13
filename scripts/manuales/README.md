# Manuales gratuitos (PDF)

- `manual-*.html` + `base.css`: fuente de cada manual. Para regenerar los PDF en `public/manuales/`:
  `node scripts/manuales/build.mjs` (requiere Playwright con Chromium).
- `enviar-manuales.gs`: Google Apps Script que envía el PDF adjunto al correo del visitante y avisa al dueño.
  Se publica como aplicación web (Implementar → Nueva implementación → Aplicación web, ejecutar como
  "Yo", acceso "Cualquier usuario") y la URL resultante se pone en `SITE.manualsMailer` (`src/data/site.ts`).
  Sin esa URL, la solicitud llega por Web3Forms y el visitante descarga el PDF al instante.
