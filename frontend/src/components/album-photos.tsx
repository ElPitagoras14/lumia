import type { UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { deletePhoto, type Photo } from "@/lib/api";

interface AlbumPhotosProps {
	albumId: number;
	photos: UseQueryResult<Photo[]>;
}

export function AlbumPhotos({ albumId, photos }: AlbumPhotosProps) {
	const queryClient = useQueryClient();
	const [toDelete, setToDelete] = useState<Photo | null>(null);
	// The grid is a light table: a photo opens large, and deleting lives
	// there instead of on every thumbnail, where a scroll could brush it.
	const [viewing, setViewing] = useState<{
		photo: Photo;
		number: number;
	} | null>(null);

	const remove = useMutation({
		mutationFn: (photo: Photo) => deletePhoto(albumId, photo.id),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["albums"] });
			setToDelete(null);
		},
	});

	return (
		<section className="pb-24">
			{photos.isPending && (
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
					<li key={photo.id}>
						<button
							type="button"
							aria-label={`Ver la foto ${index + 1}`}
							onClick={() => setViewing({ photo, number: index + 1 })}
							className="block w-full rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						>
							<img
								src={photo.urls.thumb}
								alt=""
								loading="lazy"
								className="aspect-square w-full rounded-lg bg-muted object-cover"
							/>
						</button>
					</li>
				))}
			</ul>

			<Dialog
				open={viewing !== null}
				onOpenChange={(open) => {
					if (!open) setViewing(null);
				}}
			>
				<DialogContent className="gap-3 p-3">
					{viewing && (
						<>
							<img
								src={viewing.photo.urls.viewer}
								alt={`Foto ${viewing.number}`}
								className="max-h-[70svh] w-full rounded-lg bg-muted object-contain"
							/>
							<div className="flex items-center justify-between gap-3 px-1 pb-1">
								<div className="flex flex-col gap-0.5">
									<DialogTitle>Foto {viewing.number}</DialogTitle>
									<DialogDescription>
										Sus votos están en Resultados.
									</DialogDescription>
								</div>
								<Button
									variant="destructive"
									onClick={() => {
										setToDelete(viewing.photo);
										setViewing(null);
									}}
								>
									<Trash2 aria-hidden />
									Borrar
								</Button>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>

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
							Se borrarán también los votos que haya recibido. No se puede
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
		</section>
	);
}
