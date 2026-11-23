import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.KUBELAB_API_PROXY ?? "http://localhost:8080";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": apiTarget,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "@tanstack/react-router"],
          xterm: ["@xterm/xterm", "@xterm/addon-fit"],
          motion: ["motion"],
        },
      },
    },
  },
});
