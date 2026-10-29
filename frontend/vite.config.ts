import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		viteReact(),
	],
	server: {
		// Native mode: the dev server forwards the API to the backend running
		// on the host, so the app keeps requesting relative paths on one origin.
		proxy: {
			"/api": "http://localhost:8000",
		},
	},
});

export default config;
