import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-3 px-6">
			<h1 className="text-4xl font-bold">Lumia</h1>
			<p className="text-lg text-muted-foreground">
				Sube fotos a un álbum, compártelo con un enlace y descubre cuáles gustan
				más.
			</p>
		</main>
	);
}
