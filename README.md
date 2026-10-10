# agcriminalistica.com

Sitio de AG Criminalística, construido con [Astro](https://astro.build) y publicado en GitHub Pages
mediante GitHub Actions (`.github/workflows/deploy.yml`). Cada push a `main` publica el sitio.
Cada pull request se compila y se revisa antes (`.github/workflows/check.yml`). Requiere Node 22.12 o superior.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # genera dist/
npm run check    # verificación de tipos
```

## Editar contenido

- **Artículos del blog:** `src/content/blog/<slug>.md`. El nombre del archivo es la URL (`/<slug>/`).
  Las imágenes van en `src/assets/img/` y Astro las optimiza (AVIF/WebP) automáticamente.
- **Servicios:** `src/content/services/<slug>.md` → `/servicios/<slug>/` (incluye FAQ y `videos` de YouTube opcionales).
- **Cursos:** `src/content/courses/<slug>.md` → `/courses/<slug>/`.
- **Redes, WhatsApp y clave del formulario:** `src/data/site.ts`. El teléfono y el correo no se muestran en el sitio.
- **Escena 3D:** `src/lib/crimeScene.ts` (Three.js, se carga de forma diferida).
- **Preguntas frecuentes:** `src/data/faq.ts`.

El formulario de contacto envía los mensajes al correo configurado en la cuenta de Web3Forms (no figura en el código).

## Derechos

© AG Criminalística. Todos los derechos reservados. El código es público solo para publicar el sitio;
no se concede permiso para copiar o reutilizar sus textos, imágenes, diseño ni código.
