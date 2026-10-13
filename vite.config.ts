import { defineConfig } from 'vitest/config';
import { loadEnv, type HtmlTagDescriptor } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', ['SITE_', 'CF_PAGES_URL']);
  const origin = (raw: string | undefined) => {
    if (!raw?.trim()) return undefined;
    const url = new URL(raw.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('SITE_URL must be an HTTP(S) URL without credentials.');
    }
    return `${url.origin}/`;
  };
  // CF_PAGES_URL はデプロイごとのハッシュ付き URL なので画像の参照先にだけ使い、canonical / og:url は SITE_URL があるときだけ出す
  const siteUrl = origin(env.SITE_URL);
  const imageBase = siteUrl ?? origin(env.CF_PAGES_URL);
  const imageUrl = imageBase ? new URL('og-card.png', imageBase).href : '/og-card.png';

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
