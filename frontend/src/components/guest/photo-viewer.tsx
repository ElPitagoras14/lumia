import { ChevronLeft, ChevronRight, Heart, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { GuestPhoto } from "@/lib/api";

interface PhotoViewerProps {
	// The list the viewer was opened from; previous and next move within it.
	photos: GuestPhoto[];
	photoId: number;
	error: string | null;
	onVote: (photoId: number, approved: boolean) => void;
	onNavigate: (photoId: number) => void;
	onClose: () => void;
}

export function PhotoViewer({
	photos,
	photoId,
	error,
	onVote,
	onNavigate,
	onClose,
}: PhotoViewerProps) {
	const index = photos.findIndex((photo) => photo.id === photoId);
	const photo = photos[index];
	const previous = photos[index - 1];
	const next = photos[index + 1];
	const preloaded = useRef<HTMLImageElement[]>([]);

	// Warms the neighbours' large variant, like the deck does for its cards.
	const previousId = previous?.id;
	const nextId = next?.id;
	// biome-ignore lint/correctness/useExhaustiveDependencies: only the neighbours' ids matter, not the photos array.
	useEffect(() => {
		preloaded.current = [previous, next]
			.filter((item) => item !== undefined)
			.map((item) => Object.assign(new Image(), { src: item.urls.viewer }));
	}, [previousId, nextId]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") onClose();
			else if (event.key === "ArrowLeft" && previous) onNavigate(previous.id);
			else if (event.key === "ArrowRight" && next) onNavigate(next.id);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	if (!photo) return null;

	const status =
		photo.approved === null
			? "Todavía no votaste esta foto."
			: `Votaste: ${photo.approved ? "me gusta" : "no me gusta"}. Puedes cambiarlo.`;

	return (
		<main className="mx-auto flex h-svh max-w-md flex-col gap-3 px-4 pt-4 pb-6">
			<header className="flex items-center justify-between">
				<Button
					variant="ghost"
					size="icon"
					aria-label="Cerrar"
					onClick={onClose}
				>
					<X aria-hidden />
				</Button>
				<span className="text-sm font-medium" aria-live="polite">
					{index + 1} / {photos.length}
				</span>
				<span className="size-8" aria-hidden />
			</header>

			<div className="flex min-h-0 flex-1 items-center gap-1">
				<Button
					variant="ghost"
					size="icon"
					aria-label="Foto anterior"
					disabled={!previous}
					onClick={() => previous && onNavigate(previous.id)}
				>
					<ChevronLeft aria-hidden />
				</Button>
				<div className="flex h-full min-w-0 flex-1 items-center justify-center">
					<img
						key={photo.id}
						src={photo.urls.viewer}
						alt={`Foto ${index + 1}`}
						className="max-h-full max-w-full rounded-lg object-contain"
					/>
				</div>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Foto siguiente"
					disabled={!next}
					onClick={() => next && onNavigate(next.id)}
				>
					<ChevronRight aria-hidden />
				</Button>
			</div>

			<div className="flex flex-col gap-3">
				<span className="text-center text-sm text-muted-foreground">
					{status}
				</span>
				{error && (
					<p role="alert" className="text-center text-sm text-destructive">
						{error}
					</p>
				)}
				<div className="grid grid-cols-2 gap-3">
					<Button
						variant={photo.approved === false ? "default" : "outline"}
						size="lg"
						aria-pressed={photo.approved === false}
						onClick={() => onVote(photo.id, false)}
					>
						<X aria-hidden />
						No me gusta
					</Button>
					<Button
						variant={photo.approved === true ? "default" : "outline"}
						size="lg"
						aria-pressed={photo.approved === true}
						onClick={() => onVote(photo.id, true)}
					>
						<Heart aria-hidden />
						Me gusta
					</Button>
				</div>
			</div>
		</main>
	);
}
