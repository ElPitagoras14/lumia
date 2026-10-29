import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMediaQuery } from "@/hooks/use-media-query";
import { type Album, generateShareLink } from "@/lib/api";

// Built in the browser: the backend cannot know which host the owner
// reached it through (localhost, a LAN address or a proxy).
export const shareUrl = (token: string) =>
	`${window.location.origin}/a/${token}`;

function participantsText(count: number): string {
	if (count === 0) return "Todavía no ha entrado nadie.";
	return count === 1 ? "1 persona entró." : `${count} personas entraron.`;
}

export function ShareAlbumDialog({
	album,
	open,
	onOpenChange,
}: {
	album: Album;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const linkInput = useRef<HTMLInputElement>(null);
	const resetCopied = useRef<number | undefined>(undefined);
	const [confirmingRevoke, setConfirmingRevoke] = useState(false);
	const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">(
		"idle",
	);
	// Where there is room, a centered dialog; on a phone a bottom drawer.
	const isDesktop = useMediaQuery("(min-width: 768px)");

	useEffect(() => () => window.clearTimeout(resetCopied.current), []);

	const generate = useMutation({
		mutationFn: () => generateShareLink(album.id),
		onSuccess: async (updated) => {
			queryClient.setQueryData(["albums", album.id], updated);
			await queryClient.invalidateQueries({
				queryKey: ["albums"],
				exact: true,
			});
			setCopyState("idle");
			setConfirmingRevoke(false);
		},
	});

	const url = album.shareToken ? shareUrl(album.shareToken) : null;

	async function copy() {
		if (!url) return;
		// `navigator.clipboard` only exists in a secure context, which plain
		// HTTP on a LAN address is not: select the link so it can be copied
		// by hand.
		try {
			await navigator.clipboard.writeText(url);
			setCopyState("copied");
			window.clearTimeout(resetCopied.current);
			resetCopied.current = window.setTimeout(() => setCopyState("idle"), 2000);
		} catch {
			linkInput.current?.focus();
			linkInput.current?.select();
			setCopyState("manual");
		}
	}

	const description = url
		? "Quien tenga el enlace puede calificar las fotos sin crear una cuenta."
		: "Crea un enlace para que otras personas califiquen las fotos sin crear una cuenta.";

	const body = url ? (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<Label htmlFor="share-link">Enlace del álbum</Label>
				<div className="flex gap-2">
					<Input
						id="share-link"
						ref={linkInput}
						readOnly
						value={url}
						className="min-w-0"
						onFocus={(event) => event.currentTarget.select()}
					/>
					<Button className=" shrink-0" onClick={copy}>
						{copyState === "copied" ? (
							<Check aria-hidden />
						) : (
							<Copy aria-hidden />
						)}
						{copyState === "copied" ? "Copiado" : "Copiar"}
					</Button>
				</div>
				<p
					role="status"
					className="min-h-5 text-[0.8125rem] text-muted-foreground"
				>
					{copyState === "manual" &&
						"Tu navegador no permite copiar desde aquí: el enlace quedó seleccionado, cópialo con Ctrl+C."}
				</p>
			</div>
			<p className="flex items-center gap-2 text-sm text-muted-foreground">
				<Users className="size-4 shrink-0" aria-hidden />
				{participantsText(album.participantCount)}
			</p>
			{generate.isError && (
				<p role="alert" className="text-sm text-destructive">
					No se pudo cambiar el enlace. Inténtalo de nuevo.
				</p>
			)}
			<Button
				variant="outline"
				disabled={generate.isPending}
				onClick={() => setConfirmingRevoke(true)}
			>
				Revocar y crear enlace nuevo
			</Button>
		</div>
	) : (
		<div className="flex flex-col gap-3">
			{generate.isError && (
				<p role="alert" className="text-sm text-destructive">
					No se pudo crear el enlace. Inténtalo de nuevo.
				</p>
			)}
			<Button
				className="w-full"
				disabled={generate.isPending}
				onClick={() => generate.mutate()}
			>
				<Link2 aria-hidden />
				Crear enlace
			</Button>
		</div>
	);

	function handleOpenChange(next: boolean) {
		if (!next) {
			generate.reset();
			setCopyState("idle");
		}
		onOpenChange(next);
	}

	return (
		<>
			{isDesktop ? (
				<Dialog open={open} onOpenChange={handleOpenChange}>
					<DialogContent className="sm:max-w-md">
						<DialogHeader>
							<DialogTitle>Compartir álbum</DialogTitle>
							<DialogDescription>{description}</DialogDescription>
						</DialogHeader>
						{body}
					</DialogContent>
				</Dialog>
			) : (
				<Drawer open={open} onOpenChange={handleOpenChange}>
					<DrawerContent>
						<DrawerHeader className="text-left!">
							<DrawerTitle>Compartir álbum</DrawerTitle>
							<DrawerDescription>{description}</DrawerDescription>
						</DrawerHeader>
						<div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
							{body}
						</div>
					</DrawerContent>
				</Drawer>
			)}

			{/* A sibling, not nested in the dialog or drawer, so the two layers
			don't fight over focus. */}
			<AlertDialog open={confirmingRevoke} onOpenChange={setConfirmingRevoke}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Revocar el enlace actual?</AlertDialogTitle>
						<AlertDialogDescription>
							El enlace actual dejará de funcionar. Quienes ya entraron
							conservan su nombre y sus votos al abrir el enlace nuevo.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={generate.isPending}
							onClick={(event) => {
								// Keep the dialog open until the request ends.
								event.preventDefault();
								generate.mutate();
							}}
						>
							Revocar y crear nuevo
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
