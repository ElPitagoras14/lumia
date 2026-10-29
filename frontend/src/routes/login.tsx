import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Images } from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isApiError, login } from "@/lib/api";
import { meQueryOptions, safeRedirect } from "@/lib/auth";

export const Route = createFileRoute("/login")({
	validateSearch: z.object({
		redirect: z.string().optional().catch(undefined),
	}),
	beforeLoad: async ({ context, search }) => {
		// Already signed in: there is nothing to do here.
		const user = await context.queryClient
			.ensureQueryData(meQueryOptions)
			.catch(() => null);
		if (user) {
			throw redirect({ href: safeRedirect(search.redirect) });
		}
	},
	component: Login,
});

function Login() {
	const { redirect: target } = Route.useSearch();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const signIn = useMutation({
		mutationFn: () => login(email, password),
		onSuccess: (user) => {
			queryClient.setQueryData(meQueryOptions.queryKey, user);
			router.history.push(safeRedirect(target));
		},
		// The email stays so it can be corrected; the password does not.
		onError: () => setPassword(""),
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		signIn.mutate();
	}

	const rejected = isApiError(signIn.error, "invalid_credentials");

	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col gap-8 px-6 pt-12 pb-10">
			<div className="flex flex-col items-start gap-4">
				<div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
					<Images className="size-6" aria-hidden />
				</div>
				<h1 className="text-2xl leading-tight font-bold tracking-tight">
					Lumia
				</h1>
				<p className="text-sm text-muted-foreground">
					Sube tus fotos, compártelas con un enlace y descubre cuáles gustan
					más.
				</p>
			</div>

			<form onSubmit={submit} className="flex flex-col gap-4.5">
				<div className="flex flex-col gap-2">
					<Label htmlFor="email">Correo</Label>
					<Input
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="password">Contraseña</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autoComplete="current-password"
						required
						value={password}
						onChange={(event) => setPassword(event.target.value)}
					/>
				</div>

				{signIn.isError && (
					<p role="alert" className="text-sm text-destructive">
						{rejected
							? "Correo o contraseña incorrectos."
							: "No se pudo iniciar sesión. Inténtalo de nuevo en un momento."}
					</p>
				)}

				<Button
					type="submit"
					className="mt-2 w-full font-semibold"
					disabled={signIn.isPending}
				>
					Iniciar sesión
				</Button>
			</form>

			<p className="mt-auto text-[0.8125rem] leading-normal text-muted-foreground">
				¿Olvidaste la contraseña? Restablécela desde el servidor con el comando{" "}
				<code className="font-mono text-foreground">reset-password</code>.
			</p>
		</main>
	);
}
