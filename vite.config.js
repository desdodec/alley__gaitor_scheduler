import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGitHubPages ? '/alley__gaitor_scheduler/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        sessions: resolve(process.cwd(), 'sessions.html'),
        access: resolve(process.cwd(), 'access.html'),
        manage: resolve(process.cwd(), 'manage.html'),
        contact: resolve(process.cwd(), 'contact.html'),
      },
    },
  },
});
