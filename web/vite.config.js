import { defineConfig } from 'vite';

// DRACOLoader's default decoder URLs (new URL(..., import.meta.url)) make Vite emit ~1.3 MB of decoder
// copies we never load: the app always points it at public/draco/. Blank them out.
const dropBundledDraco = {
  name: 'drop-bundled-draco',
  transform(code, id) {
    if (!id.includes('DRACOLoader')) return null;
    return code.replace(/new URL\(\s*'\.\.\/libs\/draco\/[^']+',\s*import\.meta\.url\s*\)\.toString\(\)/g, "''");
  },
};

// Relative base so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [dropBundledDraco],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
});
