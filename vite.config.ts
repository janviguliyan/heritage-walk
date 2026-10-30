import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The site's address, for link previews and the canonical link: SITE_URL if set, else Vercel's
// production domain (set by Vercel at build time), else localhost.
const siteUrl = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5299')
).replace(/\/$/, '')

function siteMeta(): Plugin {
  return {
    name: 'site-meta',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
    // a sitemap, and robots pointing to it
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc><changefreq>monthly</changefreq></url>\n</urlset>\n` })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n` })
    },
  }
}

export default defineConfig({
  plugins: [react(), siteMeta()],
  server: { host: true },
  build: { chunkSizeWarningLimit: 5000 },
})
