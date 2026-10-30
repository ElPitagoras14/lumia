import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, Share2 } from "lucide-react";
import { useState } from "react";
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
	const sort: PhotoSort = search.sort ?? "upload";

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
				<BackLink />
				{album.isPending ? (
					<Skeleton className="h-8 w-2/3" />
				) : (
					<div>
						<h1 className="text-xl leading-tight font-semibold break-words">
							{album.data.title}
						</h1>
						<p className="text-sm text-muted-foreground">
							{photoCount} de {MAX_PHOTOS_PER_ALBUM} fotos
						</p>
					</div>
				)}
			</header>

			<section className="flex flex-col gap-2">
				<div className="flex gap-2">
					<Button
						className="flex-1"
						disabled={
							album.isPending || photos.isPending || remainingSlots <= 0
						}
						onClick={() => setUploadOpen(true)}
					>
						<ImagePlus aria-hidden />
						Subir fotos
					</Button>
					<Button
						variant="outline"
						className="flex-1"
						disabled={album.isPending}
						onClick={() => setShareOpen(true)}
					>
						<Share2 aria-hidden />
						Compartir
					</Button>
				</div>
				{remainingSlots <= 0 && (
					<p className="text-[0.8125rem] text-muted-foreground">
						El álbum está lleno.
					</p>
				)}
			</section>

			<nav className="flex gap-2" aria-label="Vista del álbum">
				<Button
					className="flex-1"
					variant={view === "photos" ? "default" : "outline"}
					aria-current={view === "photos" ? "page" : undefined}
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
				</Button>
				<Button
					className="flex-1"
					variant={view === "results" ? "default" : "outline"}
					aria-current={view === "results" ? "page" : undefined}
					disabled={album.isPending}
					onClick={() => go({ view: "results" })}
				>
					Resultados
				</Button>
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
					onSort={(next) => go({ sort: next === "upload" ? undefined : next })}
					onOpenParticipant={(participant) => go({ participant })}
					onCloseParticipant={() => go({ participant: undefined })}
					onShare={() => setShareOpen(true)}
				/>
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

function BackLink() {
	return (
		<Link
			to="/"
			className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<ArrowLeft className="size-4" aria-hidden />
			Mis álbumes
		</Link>
	);
}
