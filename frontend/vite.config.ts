import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackRouter } from "@tanstack/router-plugin/vite";

import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The repository's `.env` lives one level up from this folder, where Vite
// would not look. A variable already set in the shell wins over the file.
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

const config = defineConfig(({ mode }) => {
	const apiProxyTarget = loadEnv(mode, repositoryRoot, "").API_PROXY_TARGET;

	return {
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
			// With API_PROXY_TARGET pointing at the Docker stack's nginx, it also
			// forwards /images, which only imgproxy (in that stack) can serve.
			proxy: (apiProxyTarget
				? { "/api": apiProxyTarget, "/images": apiProxyTarget }
				: { "/api": "http://localhost:8000" }) as Record<string, string>,
		},
	};
});

export default config;
