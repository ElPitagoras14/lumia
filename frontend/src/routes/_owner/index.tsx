import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Images, LogOut, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type Album,
	createAlbum,
	deleteAlbum,
	listAlbums,
	logout,
} from "@/lib/api";

export const Route = createFileRoute("/_owner/")({ component: Home });

function Home() {
	const { user } = Route.useRouteContext();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [creating, setCreating] = useState(false);
	const [toDelete, setToDelete] = useState<Album | null>(null);

	const albums = useQuery({ queryKey: ["albums"], queryFn: listAlbums });

	const signOut = useMutation({
		mutationFn: logout,
		onSuccess: async () => {
			// Nothing cached about the owner may outlive the session.
			queryClient.clear();
			await navigate({ to: "/login" });
		},
	});

	const remove = useMutation({
		mutationFn: (album: Album) => deleteAlbum(album.id),
		onSuccess: async (_data, album) => {
			queryClient.removeQueries({ queryKey: ["albums", album.id] });
			await queryClient.invalidateQueries({ queryKey: ["albums"] });
			setToDelete(null);
		},
	});

	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col gap-4 px-4 pt-4 pb-28">
			<header className="flex items-center justify-between gap-3">
				<p className="min-w-0 truncate font-semibold tracking-tight">
					<span translate="no">Lumia</span>
					<span className="sr-only">, sesión de {user.email}</span>
				</p>
				<Button
					variant="ghost"
					className="-mr-2 h-11 shrink-0 px-3 text-muted-foreground"
					title={user.email}
					disabled={signOut.isPending}
					onClick={() => signOut.mutate()}
				>
					<LogOut aria-hidden />
					Cerrar sesión
				</Button>
			</header>

			<section className="flex flex-col gap-5">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">Tus álbumes</h1>
					{albums.data && albums.data.length > 0 && (
						<p className="text-[0.8125rem] text-muted-foreground">
							{albumSummary(albums.data)}
						</p>
					)}
				</div>

				{albums.isPending && (
					<div className="flex flex-col gap-5">
						<Skeleton className="h-40 rounded-xl" />
						<Skeleton className="h-40 rounded-xl" />
					</div>
				)}

				{albums.isError && (
					<p role="alert" className="text-sm text-destructive">
						No se pudieron cargar tus álbumes. Inténtalo de nuevo en un momento.
					</p>
				)}

				{albums.data?.length === 0 && (
					<Card>
						<CardContent className="flex flex-col gap-1 text-center">
							<p className="font-medium">Todavía no tienes álbumes</p>
							<p className="text-sm text-muted-foreground">
								Crea uno con “Nuevo álbum” para subir tus primeras fotos.
							</p>
						</CardContent>
					</Card>
				)}

				<ul className="flex flex-col gap-6">
					{albums.data?.map((album) => (
						<li key={album.id}>
							<AlbumCard album={album} onDelete={() => setToDelete(album)} />
						</li>
					))}
				</ul>
			</section>

			{/* Bottom-right, in the thumb's reach, like "Subir fotos" in an album. */}
			<div className="pointer-events-none fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-end px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
				<Button
					className="pointer-events-auto h-14 gap-2.5 rounded-2xl px-5 text-[0.9375rem] font-bold shadow-lg"
					onClick={() => setCreating(true)}
				>
					<Plus className="size-5" aria-hidden />
					Nuevo álbum
				</Button>
			</div>

			<CreateAlbumDialog open={creating} onOpenChange={setCreating} />

			<AlertDialog
				open={toDelete !== null}
				onOpenChange={(open) => {
					if (!open) setToDelete(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Borrar “{toDelete?.title}”?</AlertDialogTitle>
						<AlertDialogDescription>
							Se borrarán también sus fotos y los votos que hayan recibido. No
							se puede deshacer.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{remove.isError && (
						<p role="alert" className="text-sm text-destructive">
							No se pudo borrar el álbum. Inténtalo de nuevo.
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={remove.isPending}
							onClick={(event) => {
								// Keep the dialog open until the request ends.
								event.preventDefault();
								if (toDelete) remove.mutate(toDelete);
							}}
						>
							Borrar álbum
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}

function AlbumCard({
	album,
	onDelete,
}: {
	album: Album;
	onDelete: () => void;
}) {
	return (
		<article className="relative">
			<Link
				to="/albums/$albumId"
				params={{ albumId: String(album.id) }}
				className="group flex flex-col gap-2.5 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				<CoverMosaic urls={album.coverUrls} />
				{/* Right padding leaves room for the delete button over this row. */}
				<div className="min-w-0 pr-12">
					<p className="truncate font-semibold">{album.title}</p>
					<p className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
						{album.photoCount === 1 ? "1 foto" : `${album.photoCount} fotos`}
						{album.shareToken && (
							<>
								<span aria-hidden>·</span>
								<span
									aria-hidden
									className="size-1.5 rounded-full bg-primary"
								/>
								Enlace activo
							</>
						)}
					</p>
				</div>
			</Link>
			<Button
				variant="ghost"
				size="icon"
				className="absolute right-0 bottom-0 size-11 text-muted-foreground"
				aria-label={`Borrar el álbum ${album.title}`}
				onClick={onDelete}
			>
				<Trash2 aria-hidden />
			</Button>
		</article>
	);
}

// The light table's view of an album: the first photo large, the next two
// stacked beside it. Fewer photos fill the same frame instead of leaving gaps.
function CoverMosaic({ urls }: { urls: string[] }) {
	const [main, ...rest] = urls;
	if (!main) {
		return (
			<div className="flex h-40 flex-col items-center justify-center gap-1.5 rounded-xl bg-muted text-muted-foreground">
				<Images aria-hidden />
				<span className="text-[0.8125rem]">Sin fotos todavía</span>
			</div>
		);
	}
	return (
		<div
			className={`grid h-40 gap-0.5 overflow-hidden rounded-xl bg-muted ${
				rest.length > 0 ? "grid-cols-[2fr_1fr]" : ""
			}`}
		>
			<img src={main} alt="" className="size-full object-cover" />
			{rest.length > 0 && (
				<div className="grid min-h-0 gap-0.5">
					{rest.map((url) => (
						<img
							key={url}
							src={url}
							alt=""
							loading="lazy"
							className="size-full min-h-0 object-cover"
						/>
					))}
				</div>
			)}
		</div>
	);
}

function albumSummary(albums: Album[]) {
	const shared = albums.filter((album) => album.shareToken).length;
	const count = albums.length === 1 ? "1 álbum" : `${albums.length} álbumes`;
	if (shared === 0) return count;
	return `${count} · ${shared} con enlace activo`;
}

function CreateAlbumDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [title, setTitle] = useState("");

	const create = useMutation({
		mutationFn: () => createAlbum(title),
		onSuccess: async (album) => {
			await queryClient.invalidateQueries({ queryKey: ["albums"] });
			setTitle("");
			onOpenChange(false);
			await navigate({
				to: "/albums/$albumId",
				params: { albumId: String(album.id) },
			});
		},
	});

	function submit(event: FormEvent) {
		event.preventDefault();
		create.mutate();
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					create.reset();
					setTitle("");
				}
				onOpenChange(next);
			}}
		>
			<DialogContent>
				<form onSubmit={submit} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>Nuevo álbum</DialogTitle>
						<DialogDescription>
							Ponle un nombre; después podrás subir las fotos.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label htmlFor="album-title">Nombre</Label>
						<Input
							id="album-title"
							name="title"
							required
							maxLength={100}
							autoComplete="off"
							value={title}
							onChange={(event) => setTitle(event.target.value)}
						/>
					</div>
					{create.isError && (
						<p role="alert" className="text-sm text-destructive">
							No se pudo crear el álbum. Revisa el nombre e inténtalo de nuevo.
						</p>
					)}
					<DialogFooter>
						<Button
							type="submit"
							disabled={create.isPending || title.trim() === ""}
						>
							Crear álbum
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
