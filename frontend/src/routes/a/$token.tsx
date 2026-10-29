import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Images } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	getSharedAlbum,
	isApiError,
	joinSharedAlbum,
	type SharedAlbum,
} from "@/lib/api";

// Outside the `_owner` layout: a guest has no session and needs none, the
// token in the path is the only credential.
export const Route = createFileRoute("/a/$token")({ component: GuestAlbum });

function GuestAlbum() {
	const { token } = Route.useParams();
	const shared = useQuery({
		queryKey: ["shared", token],
		queryFn: () => getSharedAlbum(token),
		retry: false,
	});

	if (shared.isPending) {
		return (
			<Shell>
				<p className="text-sm text-muted-foreground" role="status">
					Cargando…
				</p>
			</Shell>
		);
	}

	if (shared.isError) {
		// An unknown token and a revoked one look the same on purpose.
		return (
			<Shell>
				<div className="flex flex-col gap-2">
					<h1 className="text-xl leading-tight font-semibold">
						{isApiError(shared.error, "not_found")
							? "Este enlace no es válido"
							: "No se pudo abrir el álbum"}
					</h1>
					<p role="alert" className="text-sm text-muted-foreground">
						{isApiError(shared.error, "not_found")
							? "Puede que haya dejado de funcionar. Pide un enlace nuevo a quien te lo compartió."
							: "Inténtalo de nuevo en un momento."}
					</p>
				</div>
			</Shell>
		);
	}

	const { album, participant } = shared.data;

	if (!participant) {
		return (
			<Shell>
				<AskName token={token} title={album.title} />
			</Shell>
		);
	}

	// Provisional: the voting deck replaces this screen.
	return (
		<Shell>
			<div className="flex flex-col gap-2">
				<h1 className="text-xl leading-tight font-semibold break-words">
					{album.title}
				</h1>
				<p className="text-base">Hola, {participant.name}</p>
				<p className="text-sm text-muted-foreground">
					{album.photoCount === 1
						? "Este álbum tiene 1 foto."
						: `Este álbum tiene ${album.photoCount} fotos.`}{" "}
					Calificarlas todavía no está disponible.
				</p>
			</div>
		</Shell>
	);
}

function AskName({ token, title }: { token: string; title: string }) {
	const queryClient = useQueryClient();
	const [name, setName] = useState("");

	const join = useMutation({
		mutationFn: () => joinSharedAlbum(token, name),
		onSuccess: (participant) => {
			queryClient.setQueryData<SharedAlbum>(["shared", token], (current) =>
				current ? { ...current, participant } : current,
			);
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		join.mutate();
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-6">
			<div className="flex flex-col gap-2">
				<p className="text-sm text-muted-foreground">
					Te compartieron el álbum
				</p>
				<h1 className="text-xl leading-tight font-semibold break-words">
					{title}
				</h1>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="guest-name">Tu nombre</Label>
				<Input
					id="guest-name"
					name="name"
					required
					autoComplete="given-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
				<p className="text-[0.8125rem] text-muted-foreground">
					Quien creó el álbum verá tu nombre junto a tus votos.
				</p>
			</div>
			{join.isError && (
				<p role="alert" className="text-sm text-destructive">
					{isApiError(join.error, "validation_failed")
						? "El nombre debe tener entre 1 y 50 caracteres."
						: "No se pudo entrar al álbum. Inténtalo de nuevo."}
				</p>
			)}
			<Button type="submit" disabled={join.isPending || name.trim() === ""}>
				Entrar
			</Button>
		</form>
	);
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col gap-8 px-6 pt-12 pb-10">
			<div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
				<Images className="size-6" aria-hidden />
			</div>
			{children}
		</main>
	);
}
