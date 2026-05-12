import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "path";
var webFeedProxy = {
    target: "http://fbc-prf.online",
    changeOrigin: true,
    rewrite: function () { return "/sample-request/web/submissions/feed"; },
};
export default defineConfig({
    plugins: [react(), viteSingleFile()],
    server: {
        proxy: {
            "/api/web-feed": webFeedProxy,
        },
    },
    preview: {
        proxy: {
            "/api/web-feed": webFeedProxy,
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
        },
    },
    build: {
        cssCodeSplit: false,
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
            },
        },
    },
});
