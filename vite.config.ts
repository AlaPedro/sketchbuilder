import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * URL pública do site (sem barra no final). Ordem de prioridade:
 * VITE_SITE_URL (.env) → domínio de produção da Vercel → padrão.
 */
function siteUrl(mode: string) {
  const env = loadEnv(mode, process.cwd(), '');
  const url =
    env.VITE_SITE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL && `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
    'https://sketchbuilder.vercel.app';
  return url.replace(/\/+$/, '');
}

/** Injeta a URL no index.html (%SITE_URL%) e gera robots.txt e sitemap.xml no build. */
function seo(url: string): Plugin {
  return {
    name: 'sketchmaker-seo',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', url),
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${url}/sitemap.xml\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${url}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), seo(siteUrl(mode))],
}));
