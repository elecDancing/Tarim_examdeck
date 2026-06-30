import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/katex")) {
            return "vendor-katex";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("node_modules/jszip")) {
            return "vendor-zip";
          }
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: false
  }
});
