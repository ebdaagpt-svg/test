import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  envPrefix: ['VITE_', 'DISABLE_'],
  plugins: [react()],
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
});
