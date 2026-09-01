import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base = nom du repo GitHub, car GitHub Pages sert le site depuis
// https://pompier-mireval.github.io/app/ et pas depuis la racine.
export default defineConfig({
  base: '/app/',
  plugins: [react()],
});
