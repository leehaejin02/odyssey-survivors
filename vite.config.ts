import { defineConfig } from 'vite';

// GitHub Pages 배포 경로: https://leehaejin02.github.io/odyssey-survivors/
export default defineConfig({
  base: '/odyssey-survivors/',
  build: {
    outDir: 'dist',
  },
});
