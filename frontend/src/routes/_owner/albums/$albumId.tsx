import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Share2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { AlbumPhotos } from "@/components/album-photos";
import {
	AlbumResults,
	type ResultsGrouping,
} from "@/components/results/album-results";
import type { PhotoSort } from "@/components/results/results-by-photo";
import { ShareAlbumDialog } from "@/components/share-album-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadPhotosDialog } from "@/components/upload-photos-dialog";
import {
	getAlbum,
	isApiError,
	listPhotos,
	MAX_PHOTOS_PER_ALBUM,
} from "@/lib/api";

// Which view is showing lives in the URL so a reload and the back button land
// where expected. Defaults are left out of the URL, and an unknown value
// falls back to the default instead of failing.
export const Route = createFileRoute("/_owner/albums/$albumId")({
	validateSearch: z.object({
		view: z.enum(["photos", "results"]).optional().catch(undefined),
		by: z.enum(["photo", "person"]).optional().catch(undefined),
		sort: z.enum(["upload", "liked"]).optional().catch(undefined),
		participant: z.number().int().optional().catch(undefined),
	}),
	component: AlbumScreen,
});

function AlbumScreen() {
	const { albumId: rawId } = Route.useParams();
	const albumId = Number(rawId);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const [uploadOpen, setUploadOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);

	const view = search.view ?? "photos";
	const by: ResultsGrouping = search.by ?? "photo";
	// Unset lets the results pick: most liked once there are votes.
	const sort: PhotoSort | undefined = search.sort;

	// Each change is a new history entry, so back closes the detail and
	// steps from "Resultados" to "Fotos".
	function go(next: Partial<typeof search>) {
		void navigate({ search: (prev) => ({ ...prev, ...next }) });
	}

	const album = useQuery({
		queryKey: ["albums", albumId],
		queryFn: () => getAlbum(albumId),
		retry: false,
	});
	const photos = useQuery({
		queryKey: ["albums", albumId, "photos"],
		queryFn: () => listPhotos(albumId),
		enabled: album.isSuccess,
	});

	const photoCount = photos.data?.length ?? 0;
	const remainingSlots = MAX_PHOTOS_PER_ALBUM - photoCount;
	const albumFull = photos.isSuccess && remainingSlots <= 0;
	// Once there are photos and no link, sharing is the next step, so it takes
	// the honey and the floating upload button steps down (One Light Rule).
	const shareIsNext =
		album.isSuccess && photoCount > 0 && album.data.shareToken === null;

	if (album.isError) {
		return (
			<main className="mx-auto flex min-h-svh max-w-md flex-col gap-4 px-4 py-6">
				<BackLink />
				<p role="alert" className="text-sm text-destructive">
					{isApiError(album.error, "not_found")
						? "Este álbum no existe."
						: "No se pudo cargar el álbum. Inténtalo de nuevo en un momento."}
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 px-4 py-6">
			<header className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<BackLink />
					<Button
						variant={shareIsNext ? "default" : "outline"}
						disabled={album.isPending}
						onClick={() => setShareOpen(true)}
					>
						<Share2 aria-hidden />
						Compartir
					</Button>
				</div>
				{album.isPending ? (
					<Skeleton className="h-8 w-2/3" />
				) : (
					<div className="flex flex-col gap-1">
						<h1 className="text-2xl leading-tight font-semibold tracking-tight break-words">
							{album.data.title}
						</h1>
						<p className="flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-muted-foreground">
							<span>
								{photoCount} de {MAX_PHOTOS_PER_ALBUM} fotos
							</span>
							<span aria-hidden>·</span>
							{album.data.shareToken ? (
								<span className="flex items-center gap-1.5">
									<span
										aria-hidden
										className="size-1.5 rounded-full bg-primary"
									/>
									Enlace activo
								</span>
							) : (
								<span>Sin enlace</span>
							)}
							{album.data.participantCount > 0 && (
								<>
									<span aria-hidden>·</span>
									<span>
										{album.data.participantCount === 1
											? "1 persona"
											: `${album.data.participantCount} personas`}
									</span>
								</>
							)}
						</p>
						{albumFull && (
							<p className="text-[0.8125rem] text-muted-foreground">
								El álbum está lleno.
							</p>
						)}
					</div>
				)}
			</header>

			<nav className="flex border-b border-border" aria-label="Vista del álbum">
				<TabLink
					active={view === "photos"}
					onClick={() =>
						go({
							view: undefined,
							by: undefined,
							sort: undefined,
							participant: undefined,
						})
					}
				>
					Fotos
				</TabLink>
				<TabLink
					active={view === "results"}
					disabled={album.isPending}
					onClick={() => go({ view: "results" })}
				>
					Resultados
				</TabLink>
			</nav>

			{view === "photos" ? (
				<AlbumPhotos albumId={albumId} photos={photos} />
			) : (
				<AlbumResults
					albumId={albumId}
					by={by}
					sort={sort}
					participantId={search.participant}
					onBy={(next) =>
						go({
							by: next === "photo" ? undefined : next,
							sort: undefined,
							participant: undefined,
						})
					}
					onSort={(next) => go({ sort: next })}
					onOpenParticipant={(participant) => go({ participant })}
					onCloseParticipant={() => go({ participant: undefined })}
					onShare={() => setShareOpen(true)}
				/>
			)}

			{view === "photos" && photos.isSuccess && remainingSlots > 0 && (
				<div className="pointer-events-none fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-end px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
					<Button
						variant={shareIsNext ? "outline" : "default"}
						className="pointer-events-auto h-14 gap-2.5 rounded-2xl px-5 text-[0.9375rem] font-bold shadow-lg"
						onClick={() => setUploadOpen(true)}
					>
						<Plus className="size-5" aria-hidden />
						Subir fotos
					</Button>
				</div>
			)}

			<UploadPhotosDialog
				albumId={albumId}
				remainingSlots={remainingSlots}
				open={uploadOpen}
				onOpenChange={setUploadOpen}
			/>

			{album.isSuccess && (
				<ShareAlbumDialog
					album={album.data}
					open={shareOpen}
					onOpenChange={setShareOpen}
				/>
			)}
		</main>
	);
}

// Navigation between views, so it is a nav item and not an action button.
function TabLink({
	active,
	disabled,
	onClick,
	children,
}: {
	active: boolean;
	disabled?: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-current={active ? "page" : undefined}
			disabled={disabled}
			onClick={onClick}
			className={`-mb-px flex-1 border-b-[3px] py-3 text-[0.9375rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 ${
				active
					? "border-foreground text-foreground"
					: "border-transparent text-muted-foreground hover:text-foreground"
			}`}
		>
			{children}
		</button>
	);
}

function BackLink() {
	return (
		<Link
			to="/"
			className="inline-flex h-11 w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<ArrowLeft className="size-4" aria-hidden />
			Mis álbumes
		</Link>
	);
}
