import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Images } from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { DoneScreen } from "@/components/guest/done-screen";
import { MyVotes } from "@/components/guest/my-votes";
import { PhotoViewer } from "@/components/guest/photo-viewer";
import {
	filterPhotos,
	useGuestPhotos,
} from "@/components/guest/use-guest-photos";
import { VoteDeck } from "@/components/guest/vote-deck";
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
// token in the path is the only credential. Which screen is showing lives in
// the URL so the back button, a reload and a shared link all land where
// expected; an unknown value falls back to the default instead of failing.
export const Route = createFileRoute("/a/$token")({
	validateSearch: z.object({
		view: z.enum(["deck", "votes"]).optional().catch(undefined),
		filter: z
			.enum(["all", "liked", "disliked", "pending"])
			.optional()
			.catch(undefined),
		photo: z.number().int().optional().catch(undefined),
	}),
	component: GuestAlbum,
});

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
				<AskName
					token={token}
					title={album.title}
					photoCount={album.photoCount}
				/>
			</Shell>
		);
	}

	return <Voting token={token} title={album.title} name={participant.name} />;
}

function Voting({
	token,
	title,
	name,
}: {
	token: string;
	title: string;
	name: string;
}) {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { query, photos, counts, rated, voteError, vote } =
		useGuestPhotos(token);

	const view = search.view ?? "deck";
	const filter = search.filter ?? "all";

	// Each change is a new history entry, except moving between photos in the
	// viewer: back should close it, not step through every photo seen.
	function go(next: Partial<typeof search>, replace = false) {
		void navigate({ search: (prev) => ({ ...prev, ...next }), replace });
	}

	if (query.isPending) {
		return (
			<Shell>
				<p className="text-sm text-muted-foreground" role="status">
					Cargando fotos…
				</p>
			</Shell>
		);
	}

	if (query.isError) {
		return (
			<Shell>
				<div className="flex flex-col gap-2">
					<h1 className="text-xl leading-tight font-semibold">
						No se pudieron cargar las fotos
					</h1>
					<p role="alert" className="text-sm text-muted-foreground">
						Inténtalo de nuevo en un momento.
					</p>
					<Button variant="outline" onClick={() => void query.refetch()}>
						Reintentar
					</Button>
				</div>
			</Shell>
		);
	}

	// A photo the owner deleted leaves the URL pointing at nothing: ignore it.
	if (search.photo !== undefined && photos.some((p) => p.id === search.photo)) {
		const source = view === "votes" ? filterPhotos(photos, filter) : photos;
		// Voting a photo from the "pending" filter takes it out of that filter;
		// the viewer then moves within the whole album instead of losing it.
		const list = source.some((p) => p.id === search.photo) ? source : photos;
		return (
			<PhotoViewer
				photos={list}
				photoId={search.photo}
				error={voteError}
				onVote={vote}
				onNavigate={(photo) => go({ photo }, true)}
				onClose={() => go({ photo: undefined })}
			/>
		);
	}

	if (view === "votes") {
		return (
			<MyVotes
				title={title}
				photos={photos}
				counts={counts}
				filter={filter}
				onFilter={(next) => go({ filter: next }, true)}
				onOpenPhoto={(photo) => go({ photo })}
				onBack={() => go({ view: undefined, filter: undefined })}
			/>
		);
	}

	if (photos.length === 0) {
		return (
			<Shell>
				<div className="flex flex-col gap-2">
					<h1 className="text-xl leading-tight font-semibold break-words">
						{title}
					</h1>
					<p className="text-sm text-muted-foreground">
						Este álbum todavía no tiene fotos. Vuelve en un rato.
					</p>
				</div>
			</Shell>
		);
	}

	if (counts.pending === 0) {
		return (
			<DoneScreen
				name={name}
				title={title}
				total={counts.all}
				liked={counts.liked}
				disliked={counts.disliked}
				onReview={() => go({ view: "votes" })}
			/>
		);
	}

	return (
		<VoteDeck
			title={title}
			participantName={name}
			photos={photos}
			rated={rated}
			error={voteError}
			onVote={vote}
			onOpenVotes={() => go({ view: "votes", filter: undefined })}
			onOpenPhoto={(photo) => go({ photo })}
		/>
	);
}

function AskName({
	token,
	title,
	photoCount,
}: {
	token: string;
	title: string;
	photoCount: number;
}) {
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
				<p className="text-sm text-muted-foreground">Te invitaron a votar</p>
				<h1 className="text-xl leading-tight font-semibold break-words">
					{title}
				</h1>
				<p className="text-base">
					{photoCount === 1 ? "1 foto." : `${photoCount} fotos.`} Desliza a la
					derecha las que te gusten y a la izquierda las que no.
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="guest-name">¿Cómo te llamas?</Label>
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
			<div className="flex flex-col gap-3">
				<Button type="submit" disabled={join.isPending || name.trim() === ""}>
					Empezar a votar
				</Button>
				<span className="text-center text-[0.8125rem] text-muted-foreground">
					No necesitas crear una cuenta. Tu avance se guarda.
				</span>
			</div>
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
