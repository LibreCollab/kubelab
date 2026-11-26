import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const apiTarget = process.env.KUBELAB_API_PROXY ?? "http://localhost:8080";
const webPort = Number(process.env.KUBELAB_WEB_PORT ?? "5173");

function cspMeta(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  return {
    name: "kubelab-csp-meta",
    apply: "build",
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: policy },
            injectTo: "head-prepend",
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), cspMeta()],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    host: "127.0.0.1",
    port: webPort,
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
        manualChunks(id) {
          if (id.includes("knowledge-questions")) {
            return "knowledge";
          }
          if (id.includes("@kubelab/content")) {
            return "content";
          }
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("@tanstack/react-router")
          ) {
            return "react";
          }
          if (id.includes("@xterm")) {
            return "xterm";
          }
          if (id.includes("/motion/")) {
            return "motion";
          }
          if (id.includes("/dexie/")) {
            return "db";
          }
          return undefined;
        },
      },
    },
  },
});
