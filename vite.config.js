import { defineConfig } from 'vite';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGitHubPages ? '/alley__gaitor_scheduler/' : '/',
});
