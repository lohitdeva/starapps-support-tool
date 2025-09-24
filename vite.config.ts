import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const rootDir = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, "index.html"),
        calculator: resolve(rootDir, "calculator/index.html"),
        urlgen: resolve(rootDir, "urlgen/index.html"),
      },
    },
  },
});
