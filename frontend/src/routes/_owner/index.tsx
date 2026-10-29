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
		<main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 px-4 py-6">
			<header className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
						<Images aria-hidden />
					</div>
					<div className="min-w-0">
						<h1 className="text-lg leading-tight font-semibold">Lumia</h1>
						<p className="truncate text-sm text-muted-foreground">
							{user.email}
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					className="h-11 shrink-0"
					disabled={signOut.isPending}
					onClick={() => signOut.mutate()}
				>
					<LogOut aria-hidden />
					Cerrar sesión
				</Button>
			</header>

			<section className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-xl font-semibold">Tus álbumes</h2>
					<Button className="h-11" onClick={() => setCreating(true)}>
						<Plus aria-hidden />
						Nuevo álbum
					</Button>
				</div>

				{albums.isPending && (
					<div className="flex flex-col gap-3">
						<Skeleton className="h-24 rounded-xl" />
						<Skeleton className="h-24 rounded-xl" />
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
								Crea uno para subir tus primeras fotos.
							</p>
						</CardContent>
					</Card>
				)}

				<ul className="flex flex-col gap-3">
					{albums.data?.map((album) => (
						<li key={album.id}>
							<AlbumCard album={album} onDelete={() => setToDelete(album)} />
						</li>
					))}
				</ul>
			</section>

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
		<Card className="relative flex-row items-center gap-3 p-3">
			<Link
				to="/albums/$albumId"
				params={{ albumId: String(album.id) }}
				className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
			>
				{album.coverUrl ? (
					<img
						src={album.coverUrl}
						alt=""
						className="size-18 shrink-0 rounded-lg object-cover"
					/>
				) : (
					<div className="grid size-18 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
						<Images aria-hidden />
					</div>
				)}
				<div className="min-w-0">
					<p className="truncate font-medium">{album.title}</p>
					<p className="text-sm text-muted-foreground">
						{album.photoCount === 1 ? "1 foto" : `${album.photoCount} fotos`}
					</p>
				</div>
			</Link>
			<Button
				variant="ghost"
				size="icon-lg"
				className="size-11 shrink-0"
				aria-label={`Borrar el álbum ${album.title}`}
				onClick={onDelete}
			>
				<Trash2 aria-hidden />
			</Button>
		</Card>
	);
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
							className="h-12 px-3.5"
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
							className="h-11"
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
