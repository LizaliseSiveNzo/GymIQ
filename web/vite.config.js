/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {offlinePlugin} from './build/offlinePlugin.js';
import {execSync} from 'node:child_process';

function buildId(){
 if(process.env.VERCEL_GIT_COMMIT_SHA)return process.env.VERCEL_GIT_COMMIT_SHA.slice(0,7);
 try{return execSync('git rev-parse --short HEAD',{encoding:'utf8'}).trim();}catch{return 'dev';}
}

export default defineConfig({
  plugins: [react(),offlinePlugin()],
  define: { __APP_BUILD__: JSON.stringify(buildId()) },
  build:{rollupOptions:{output:{manualChunks(id){
    if(/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run\/router)\//.test(id))return 'react-vendor';
    if(id.includes('/node_modules/@supabase/'))return 'supabase-vendor';
  }}}},
  server: { port: 5173 },
  // Vitest (Phase 0 scaffold): engine unit tests live under src as *.test.js
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
