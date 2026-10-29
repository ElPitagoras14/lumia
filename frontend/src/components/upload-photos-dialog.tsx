import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ImagePlus, Loader2, X } from "lucide-react";
import {
	type ChangeEvent,
	type DragEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
	ACCEPTED_PHOTO_TYPES,
	isApiError,
	MAX_PHOTO_BYTES,
	MAX_PHOTOS_PER_ALBUM,
	uploadPhoto,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// ready: chosen, waiting for the Subir button. invalid: rejected before
// sending and never retried. failed: the server refused or the request broke;
// pressing Subir again retries it.
type ItemState = "ready" | "uploading" | "done" | "failed" | "invalid";

interface Item {
	key: number;
	file: File;
	// Local preview, so a thumbnail shows before the server has the photo.
	previewUrl: string | null;
	state: ItemState;
	progress: number;
	error?: string;
}

// The server's messages are written for a log, so what the owner reads is
// chosen from the stable code.
function uploadErrorText(error: unknown): string {
	if (isApiError(error, "album_full")) {
		return `El álbum ya tiene el máximo de ${MAX_PHOTOS_PER_ALBUM} fotos.`;
	}
	if (isApiError(error, "validation_failed")) {
		return "Solo se aceptan imágenes JPEG, PNG o WebP de hasta 20 MiB.";
	}
	if (isApiError(error, "not_found")) {
		return "El álbum ya no existe.";
	}
	return "No se pudo subir. Inténtalo de nuevo.";
}

function formatSize(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function UploadPhotosDialog({
	albumId,
	remainingSlots,
	open,
	onOpenChange,
}: {
	albumId: number;
	// How many more photos the album takes, as the gallery knows it.
	remainingSlots: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const fileInput = useRef<HTMLInputElement>(null);
	const nextKey = useRef(0);
	const [items, setItems] = useState<Item[]>([]);
	const [uploading, setUploading] = useState(false);
	const [dragging, setDragging] = useState(false);

	// The upload loop and the unmount cleanup read the latest list from here
	// instead of the one they closed over.
	const itemsRef = useRef(items);
	itemsRef.current = items;
	useEffect(
		() => () => {
			for (const item of itemsRef.current) {
				if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
			}
		},
		[],
	);

	const pending = items.filter(
		(item) => item.state === "ready" || item.state === "failed",
	);
	const done = items.filter((item) => item.state === "done").length;
	const slotsLeft =
		remainingSlots -
		items.filter((item) => item.state === "ready" || item.state === "uploading")
			.length -
		items.filter((item) => item.state === "failed").length;

	function patch(key: number, change: Partial<Item>) {
		setItems((current) =>
			current.map((item) => (item.key === key ? { ...item, ...change } : item)),
		);
	}

	function remove(key: number) {
		const item = itemsRef.current.find((candidate) => candidate.key === key);
		if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
		setItems((current) => current.filter((candidate) => candidate.key !== key));
	}

	function addFiles(files: File[]) {
		if (uploading || files.length === 0) return;
		// The same checks as the server, only to answer before sending.
		let slots = slotsLeft;
		const added = files.map((file): Item => {
			const base = {
				key: nextKey.current++,
				file,
				previewUrl: ACCEPTED_PHOTO_TYPES.includes(file.type)
					? URL.createObjectURL(file)
					: null,
				progress: 0,
			};
			if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
				return {
					...base,
					state: "invalid",
					error: "Solo se aceptan imágenes JPEG, PNG o WebP.",
				};
			}
			if (file.size > MAX_PHOTO_BYTES) {
				return { ...base, state: "invalid", error: "Pesa más de 20 MiB." };
			}
			if (slots <= 0) {
				return {
					...base,
					state: "invalid",
					error: `El álbum ya tiene el máximo de ${MAX_PHOTOS_PER_ALBUM} fotos.`,
				};
			}
			slots -= 1;
			return { ...base, state: "ready" };
		});
		setItems((current) => [...current, ...added]);
	}

	async function start() {
		const targets = itemsRef.current.filter(
			(item) => item.state === "ready" || item.state === "failed",
		);
		if (targets.length === 0) return;
		setUploading(true);
		// One at a time: every outcome is a plain status code, and the server's
		// single writer is not asked to take fifty uploads at once.
		for (const target of targets) {
			patch(target.key, { state: "uploading", progress: 0, error: undefined });
			try {
				await uploadPhoto(albumId, target.file, (progress) =>
					patch(target.key, { progress }),
				);
				patch(target.key, { state: "done", progress: 100 });
			} catch (error) {
				patch(target.key, { state: "failed", error: uploadErrorText(error) });
			}
			await queryClient.invalidateQueries({
				queryKey: ["albums", albumId, "photos"],
			});
		}
		await queryClient.invalidateQueries({ queryKey: ["albums"] });
		setUploading(false);
	}

	function handleOpenChange(next: boolean) {
		// Closing now would abandon a request that is still running.
		if (!next && uploading) return;
		if (!next) {
			for (const item of itemsRef.current) {
				if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
			}
			setItems([]);
			setDragging(false);
		}
		onOpenChange(next);
	}

	function onPick(event: ChangeEvent<HTMLInputElement>) {
		const files = Array.from(event.target.files ?? []);
		// So the same file can be picked again after it was removed.
		event.target.value = "";
		addFiles(files);
	}

	// The whole dialog is the drop target. Without preventDefault on every
	// drag event a file dropped a little off the zone would make the browser
	// open it and leave the app.
	function onDragOver(event: DragEvent) {
		event.preventDefault();
		if (!uploading) setDragging(true);
	}

	function onDragLeave(event: DragEvent) {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
			setDragging(false);
		}
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		setDragging(false);
		addFiles(Array.from(event.dataTransfer.files));
	}

	const zoneDisabled = uploading || slotsLeft <= 0;
	// Where there is room, a centered dialog you can drop files on; on a phone
	// a bottom drawer, which the thumb reaches and a swipe down closes.
	const isDesktop = useMediaQuery("(min-width: 768px)");

	const description = `JPEG, PNG o WebP, hasta 20 MiB cada una. Caben ${Math.max(slotsLeft, 0)} más en este álbum.`;

	const picker = (
		<>
			<input
				ref={fileInput}
				type="file"
				multiple
				accept={ACCEPTED_PHOTO_TYPES.join(",")}
				className="sr-only"
				tabIndex={-1}
				onChange={onPick}
				aria-label="Elegir fotos"
			/>
			{isDesktop ? (
				<button
					type="button"
					disabled={zoneDisabled}
					onClick={() => fileInput.current?.click()}
					className={cn(
						"flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
						dragging
							? "border-primary bg-primary/10"
							: "border-border hover:bg-muted/50",
						"disabled:pointer-events-none disabled:opacity-50",
					)}
				>
					<ImagePlus className="size-6 text-muted-foreground" aria-hidden />
					<p className="font-medium">
						{dragging ? "Suelta las fotos aquí" : "Arrastra tus fotos aquí"}
					</p>
					<p className="text-[0.8125rem] text-muted-foreground">
						o toca para elegirlas
					</p>
				</button>
			) : (
				// No drag-and-drop on a touch screen: the primary action is the
				// picker, and it steps back once there is something to upload.
				<Button
					variant={items.length > 0 ? "outline" : "default"}
					className="w-full"
					disabled={zoneDisabled}
					onClick={() => fileInput.current?.click()}
				>
					<ImagePlus aria-hidden />
					{items.length > 0 ? "Añadir más fotos" : "Elegir fotos"}
				</Button>
			)}
		</>
	);

	const list = items.length > 0 && (
		// data-vaul-no-drag: scrolling the list must not drag the drawer down.
		<ul
			data-vaul-no-drag
			className="flex max-h-[40svh] flex-col gap-2 overflow-y-auto"
			aria-live="polite"
		>
			{items.map((item) => (
				<ItemRow key={item.key} item={item} onRemove={() => remove(item.key)} />
			))}
		</ul>
	);

	const action =
		pending.length === 0 && !uploading && done > 0 ? (
			<Button
				className="w-full md:w-auto"
				onClick={() => handleOpenChange(false)}
			>
				Listo
			</Button>
		) : (
			<Button
				className="w-full md:w-auto"
				disabled={uploading || pending.length === 0}
				onClick={start}
			>
				{uploading && <Loader2 className="animate-spin" aria-hidden />}
				{uploading
					? "Subiendo…"
					: pending.length === 0
						? "Subir fotos"
						: pending.length === 1
							? "Subir 1 foto"
							: `Subir ${pending.length} fotos`}
			</Button>
		);

	if (isDesktop) {
		return (
			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent
					className="sm:max-w-md"
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
				>
					<DialogHeader>
						<DialogTitle>Subir fotos</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					{picker}
					{list}
					<DialogFooter>{action}</DialogFooter>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		// Not dismissible while a request runs: a swipe would abandon it.
		<Drawer
			open={open}
			onOpenChange={handleOpenChange}
			dismissible={!uploading}
		>
			<DrawerContent
				onDragOver={onDragOver}
				onDragLeave={onDragLeave}
				onDrop={onDrop}
			>
				<DrawerHeader className="text-left!">
					<DrawerTitle>Subir fotos</DrawerTitle>
					<DrawerDescription>{description}</DrawerDescription>
				</DrawerHeader>
				<div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-4">
					{picker}
					{list}
				</div>
				<DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">
					{action}
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

function ItemRow({ item, onRemove }: { item: Item; onRemove: () => void }) {
	return (
		<li className="flex items-center gap-3">
			{item.previewUrl ? (
				<img
					src={item.previewUrl}
					alt=""
					className="size-12 shrink-0 rounded-lg bg-muted object-cover"
				/>
			) : (
				<div className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
					<AlertCircle className="size-5" aria-hidden />
				</div>
			)}

			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<p className="truncate text-sm font-medium">{item.file.name}</p>
				{item.state === "uploading" && (
					<>
						<Progress
							value={item.progress}
							aria-label="Progreso de la subida"
						/>
						<p className="text-[0.8125rem] text-muted-foreground">
							{item.progress >= 100 ? "Guardando…" : `${item.progress} %`}
						</p>
					</>
				)}
				{item.state === "ready" && (
					<p className="text-[0.8125rem] text-muted-foreground">
						{formatSize(item.file.size)} · Lista para subir
					</p>
				)}
				{item.state === "done" && (
					<p className="text-[0.8125rem] text-muted-foreground">Completada</p>
				)}
				{(item.state === "failed" || item.state === "invalid") && (
					<p className="text-[0.8125rem] text-destructive">{item.error}</p>
				)}
			</div>

			{item.state === "done" && (
				<Check className="size-5 shrink-0 text-primary" aria-hidden />
			)}
			{item.state === "uploading" && (
				<Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
			)}
			{(item.state === "ready" ||
				item.state === "failed" ||
				item.state === "invalid") && (
				<Button
					variant="ghost"
					size="icon"
					className="shrink-0"
					aria-label={`Quitar ${item.file.name}`}
					onClick={onRemove}
				>
					<X aria-hidden />
				</Button>
			)}
		</li>
	);
}
