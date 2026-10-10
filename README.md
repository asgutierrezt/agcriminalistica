# agcriminalistica.com

Sitio de AG Criminalística, construido con [Astro](https://astro.build) y publicado en GitHub Pages
mediante GitHub Actions (`.github/workflows/deploy.yml`). Cada push a `main` publica el sitio.

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
- **Cursos:** `src/content/courses/<slug>.md` → `/courses/<slug>/`.
- **Datos de contacto, redes y clave del formulario:** `src/data/site.ts`.
- **Preguntas frecuentes:** `src/data/faq.ts`.

El formulario de contacto envía los mensajes a asgutierrezt@gmail.com a través de Web3Forms.
