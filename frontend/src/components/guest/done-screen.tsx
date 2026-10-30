import { Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GuestPhoto } from "@/lib/api";

// The closing mosaic shows at most this many of the photos the guest liked.
const MAX_LIKED_SHOWN = 6;

interface DoneScreenProps {
	name: string;
	title: string;
	total: number;
	liked: number;
	disliked: number;
	likedPhotos: GuestPhoto[];
	onReview: () => void;
}

export function DoneScreen({
	name,
	title,
	total,
	liked,
	disliked,
	likedPhotos,
	onReview,
}: DoneScreenProps) {
	const shown = likedPhotos.slice(0, MAX_LIKED_SHOWN);
	const more = likedPhotos.length - shown.length;

	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col gap-8 px-6 pt-4 pb-10">
			<header className="flex h-11 items-center">
				<p translate="no" className="font-semibold tracking-tight">
					Lumia
				</p>
			</header>

			<div className="flex flex-col gap-2">
				<h1 className="text-2xl leading-tight font-bold tracking-tight break-words">
					¡Listo, {name}!
				</h1>
				<p className="text-base text-muted-foreground">
					{total === 1
						? "Calificaste la foto de "
						: `Calificaste las ${total} fotos de `}
					{title}. Tus votos ya le llegaron a quien creó el álbum.
				</p>
			</div>

			{/* The payoff: what the guest picked, back on the table. */}
			{shown.length > 0 && (
				<section
					className="flex flex-col gap-2.5"
					aria-labelledby="liked-title"
				>
					<h2 id="liked-title" className="text-base font-semibold">
						Te gustaron
					</h2>
					<ul className="grid grid-cols-3 gap-1.5">
						{shown.map((photo) => (
							<li key={photo.id}>
								<img
									src={photo.urls.thumb}
									alt=""
									className="aspect-square w-full rounded-lg bg-muted object-cover"
								/>
							</li>
						))}
					</ul>
					{more > 0 && (
						<p className="text-[0.8125rem] text-muted-foreground">
							{more === 1 ? "Y 1 más." : `Y ${more} más.`}
						</p>
					)}
				</section>
			)}

			<p className="flex items-center gap-3 text-sm tabular-nums">
				<span className="flex items-center gap-1.5">
					<Heart className="size-4 text-primary" aria-hidden />
					<strong className="font-semibold">{liked}</strong>
					{liked === 1 ? "me gusta" : "me gustan"}
				</span>
				<span aria-hidden className="text-muted-foreground">
					·
				</span>
				<span className="flex items-center gap-1.5">
					<X className="size-4 text-destructive" aria-hidden />
					<strong className="font-semibold">{disliked}</strong>
					{disliked === 1 ? "no me gusta" : "no me gustan"}
				</span>
			</p>

			<div className="mt-auto flex flex-col gap-3">
				<Button size="lg" onClick={onReview}>
					Revisar mis votos
				</Button>
				<span className="text-center text-[0.8125rem] text-muted-foreground">
					Puedes volver con este mismo enlace y cambiar tus votos cuando
					quieras.
				</span>
			</div>
		</main>
	);
}
