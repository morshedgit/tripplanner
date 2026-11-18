import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  vite: {
    plugins: [
      {
        name: 'externalize-better-sqlite3',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'better-sqlite3') {
            return { id, external: true };
          }
        },
      },
    ],
  },
});
