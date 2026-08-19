import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const playbackFailureSinkPlugin = () => ({
  name: 'playback-failure-sink-plugin',
  configureServer(server: any) {
    server.middlewares.use('/__dev_telemetry_sink', (req: any, res: any) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            const logs = JSON.parse(body);
            const logPath = path.resolve(__dirname, 'playback-failures.json');
            
            let existing = [];
            if (fs.existsSync(logPath)) {
              existing = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            }
            const updated = [...existing, ...logs].slice(-500);
            fs.writeFileSync(logPath, JSON.stringify(updated, null, 2));

            res.statusCode = 200;
            res.end(JSON.stringify({ status: 'logged' }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid payload' }));
          }
        });
      }
    });
  }
});

export default defineConfig(() => {
  return {
    base: '/ajn-liberty-broadcast/',
    define: {
      'process.env.APP_URL': JSON.stringify(process.env.APP_URL || ''),
    },
    plugins: [react(), tailwindcss(), playbackFailureSinkPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': 'preact/compat',
        'react-dom': 'preact/compat',
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
