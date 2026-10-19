import { defineConfig } from 'vitest/config';
import { loadEnv, type HtmlTagDescriptor } from 'vite';
import react from '@vitejs/plugin-react';

// Public origin, not a secret, so it lives in code; .env* files stay untracked for secrets.
// Forks override with SITE_URL in .env.local (empty disables absolute URLs).
const PRODUCTION_SITE_URL = 'https://jack-o-gen.shunyakoide.com';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['SITE_']);
  const origin = (raw: string | undefined) => {
    if (!raw?.trim()) return undefined;
    const url = new URL(raw.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('SITE_URL must be an HTTP(S) URL without credentials.');
    }
    return `${url.origin}/`;
  };
  const siteUrl = origin(env.SITE_URL ?? (mode === 'production' ? PRODUCTION_SITE_URL : undefined));
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
