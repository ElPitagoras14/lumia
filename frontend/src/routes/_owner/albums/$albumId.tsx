import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadPhotosDialog } from "@/components/upload-photos-dialog";
import {
	deletePhoto,
	getAlbum,
	isApiError,
	listPhotos,
	MAX_PHOTOS_PER_ALBUM,
	type Photo,
} from "@/lib/api";

export const Route = createFileRoute("/_owner/albums/$albumId")({
	component: AlbumScreen,
});

function AlbumScreen() {
	const { albumId: rawId } = Route.useParams();
	const albumId = Number(rawId);
	const queryClient = useQueryClient();
	const [uploadOpen, setUploadOpen] = useState(false);
	const [toDelete, setToDelete] = useState<Photo | null>(null);

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

	const remove = useMutation({
		mutationFn: (photo: Photo) => deletePhoto(albumId, photo.id),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["albums"] });
			setToDelete(null);
		},
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
						<h1 className="text-2xl leading-tight font-semibold break-words">
							{album.data.title}
						</h1>
						<p className="text-sm text-muted-foreground">
							{photoCount} de {MAX_PHOTOS_PER_ALBUM} fotos
						</p>
					</div>
				)}
			</header>

			<section className="flex flex-col gap-2">
				<Button
					className="h-12 w-full text-base"
					disabled={album.isPending || photos.isPending || remainingSlots <= 0}
					onClick={() => setUploadOpen(true)}
				>
					<ImagePlus aria-hidden />
					Subir fotos
				</Button>
				{remainingSlots <= 0 && (
					<p className="text-[0.8125rem] text-muted-foreground">
						El álbum está lleno.
					</p>
				)}
			</section>

			<section>
				{photos.isPending && album.isSuccess && (
					<div className="grid grid-cols-3 gap-2">
						{["a", "b", "c", "d", "e", "f"].map((id) => (
							<Skeleton key={id} className="aspect-square rounded-lg" />
						))}
					</div>
				)}
				{photos.isError && (
					<p role="alert" className="text-sm text-destructive">
						No se pudieron cargar las fotos. Inténtalo de nuevo en un momento.
					</p>
				)}
				{photos.data?.length === 0 && (
					<p className="text-center text-sm text-muted-foreground">
						Este álbum todavía no tiene fotos.
					</p>
				)}
				<ul className="grid grid-cols-3 gap-2">
					{photos.data?.map((photo, index) => (
						<li key={photo.id} className="relative">
							<img
								src={photo.urls.thumb}
								alt={`Foto ${index + 1}`}
								loading="lazy"
								className="aspect-square w-full rounded-lg bg-muted object-cover"
							/>
							<Button
								variant="secondary"
								size="icon-lg"
								className="absolute top-1 right-1 size-9 bg-background/80"
								aria-label={`Borrar la foto ${index + 1}`}
								onClick={() => setToDelete(photo)}
							>
								<Trash2 aria-hidden />
							</Button>
						</li>
					))}
				</ul>
			</section>

			<UploadPhotosDialog
				albumId={albumId}
				remainingSlots={remainingSlots}
				open={uploadOpen}
				onOpenChange={setUploadOpen}
			/>

			<AlertDialog
				open={toDelete !== null}
				onOpenChange={(open) => {
					if (!open) {
						setToDelete(null);
						remove.reset();
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Borrar esta foto?</AlertDialogTitle>
						<AlertDialogDescription>
							Se borrará también el voto que haya recibido. No se puede
							deshacer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{remove.isError && (
						<p role="alert" className="text-sm text-destructive">
							No se pudo borrar la foto. Inténtalo de nuevo.
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={remove.isPending}
							onClick={(event) => {
								event.preventDefault();
								if (toDelete) remove.mutate(toDelete);
							}}
						>
							Borrar foto
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
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
