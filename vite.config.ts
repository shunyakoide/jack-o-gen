import { defineConfig } from 'vitest/config';
import { loadEnv, type HtmlTagDescriptor } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['SITE_', 'CF_PAGES_URL']);
  const configuredUrl = env.SITE_URL?.trim() || env.CF_PAGES_URL?.trim();
  let siteUrl: string | undefined;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('SITE_URL must be an HTTP(S) URL without credentials.');
    }
    siteUrl = `${url.origin}/`;
  }
  const imageUrl = siteUrl ? new URL('og-card.png', siteUrl).href : '/og-card.png';

  return {
    plugins: [react(), {
      name: 'brand-social-metadata',
      transformIndexHtml() {
        // Build-time tags are visible to crawlers that do not execute JavaScript.
        const tags: HtmlTagDescriptor[] = [
          { tag: 'meta', attrs: { property: 'og:image', content: imageUrl }, injectTo: 'head-prepend' },
          { tag: 'meta', attrs: { name: 'twitter:image', content: imageUrl }, injectTo: 'head' },
        ];
        if (siteUrl) {
          tags.push(
            { tag: 'meta', attrs: { property: 'og:url', content: siteUrl }, injectTo: 'head' },
            { tag: 'link', attrs: { rel: 'canonical', href: siteUrl }, injectTo: 'head' },
          );
        }
        return tags;
      },
    }],
    worker: { format: 'es' },
    optimizeDeps: { exclude: ['manifold-3d'] },
    test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 60000 },
  };
});
