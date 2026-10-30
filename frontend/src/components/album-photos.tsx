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
import { Skeleton } from "@/components/ui/skeleton";
import { deletePhoto, type Photo } from "@/lib/api";

interface AlbumPhotosProps {
	albumId: number;
	photos: UseQueryResult<Photo[]>;
}

export function AlbumPhotos({ albumId, photos }: AlbumPhotosProps) {
	const queryClient = useQueryClient();
	const [toDelete, setToDelete] = useState<Photo | null>(null);

	const remove = useMutation({
		mutationFn: (photo: Photo) => deletePhoto(albumId, photo.id),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["albums"] });
			setToDelete(null);
		},
	});

	return (
		<section>
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
					<li key={photo.id} className="relative">
						<img
							src={photo.urls.thumb}
							alt={`Foto ${index + 1}`}
							loading="lazy"
							className="aspect-square w-full rounded-lg bg-muted object-cover"
						/>
						<Button
							variant="secondary"
							size="icon"
							className="absolute top-1 right-1 bg-background/80"
							aria-label={`Borrar la foto ${index + 1}`}
							onClick={() => setToDelete(photo)}
						>
							<Trash2 aria-hidden />
						</Button>
					</li>
				))}
			</ul>

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
		</section>
	);
}
