import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';
import { appPort, devPort } from './ports.mjs';

function conceptDeclarations(): Plugin {
  const source = path.resolve(import.meta.dirname, './src');
  const roots = [path.join(source, 'pages'), path.join(source, 'components')];
  const declaration = /export\s+const\s+concept\s*(?::[^=]+)?=\s*['"](?:C(?:[1-9]|1[0-7])|frame)['"]/;
  const check = () => {
    const visit = (directory: string) => {
      if (!fs.existsSync(directory)) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          if (file !== path.join(source, 'components', 'ui')) visit(file);
        } else if (entry.name.endsWith('.tsx') && !declaration.test(fs.readFileSync(file, 'utf8'))) {
          throw new Error(`Missing concept declaration: ${path.relative(source, file)}`);
        }
      }
    };
    roots.forEach(visit);
  };
  return { name: 'starci-concept-declarations', buildStart: check };
}

export default defineConfig({
  plugins: [conceptDeclarations(), react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  preview: { host: '127.0.0.1', port: devPort, strictPort: true },
  server: {
    host: '127.0.0.1', port: devPort, strictPort: true,
    proxy: { '/api': `http://127.0.0.1:${appPort}` },
  },
});
