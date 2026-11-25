import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.svg", "icons/*.png"],
      manifest: {
        name: "Small Farmer Super App",
        short_name: "FarmApp",
        description: "Track everything on your farm — crops, livestock, tasks, inventory and money — with an AI assistant.",
        theme_color: "#f2f2f7",
        background_color: "#f2f2f7",
        display: "standalone",
        id: "/",
        start_url: "/",
        icons: [
          // PNGs first: Windows/Android build shortcut & taskbar icons from these. New file
          // names (v2) so no cached copy of the old leaf icon can be reused.
          { src: "icons/icon-v2-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-v2-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-v2-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
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
