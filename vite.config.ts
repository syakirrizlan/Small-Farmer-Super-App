import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon.svg", "icons/icon-maskable.svg"],
      manifest: {
        name: "Small Farmer Super App",
        short_name: "FarmApp",
        description: "Track everything on your farm — crops, livestock, tasks, inventory and money — with an AI assistant.",
        theme_color: "#f2f2f7",
        background_color: "#f2f2f7",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icons/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // App shell is cached for offline use. AI calls are network-only and never cached.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
});
