import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server runs on :5173 and talks to the PHP API served by XAMPP on :80.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
