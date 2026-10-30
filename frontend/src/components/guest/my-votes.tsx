import { ChevronLeft, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GuestPhoto } from "@/lib/api";
import { filterPhotos, type VoteFilter } from "./use-guest-photos";

interface MyVotesProps {
	title: string;
	photos: GuestPhoto[];
	counts: Record<VoteFilter, number>;
	filter: VoteFilter;
	onFilter: (filter: VoteFilter) => void;
	onOpenPhoto: (photoId: number) => void;
	onBack: () => void;
}

// The vote filters show the same heart and cross as the marks on the
// thumbnails, which keeps the four 44px filters on one row.
const FILTERS: {
	value: VoteFilter;
	label: string;
	icon?: typeof Heart;
	tone?: string;
}[] = [
	{ value: "all", label: "Todas" },
	{ value: "liked", label: "Me gusta", icon: Heart, tone: "text-primary" },
	{
		value: "disliked",
		label: "No me gusta",
		icon: X,
		tone: "text-destructive",
	},
	{ value: "pending", label: "Pendientes" },
];

function stateLabel(approved: boolean | null) {
	if (approved === null) return "sin votar";
	return approved ? "me gusta" : "no me gusta";
}

export function MyVotes({
	title,
	photos,
	counts,
	filter,
	onFilter,
	onOpenPhoto,
	onBack,
}: MyVotesProps) {
	const shown = filterPhotos(photos, filter);

	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col gap-4 px-4 pt-4 pb-6">
			<header className="flex items-center gap-2">
				<Button
					variant="ghost"
					size="icon"
					aria-label={counts.pending > 0 ? "Volver al mazo" : "Volver"}
					onClick={onBack}
				>
					<ChevronLeft aria-hidden />
				</Button>
				<div className="flex min-w-0 flex-col">
					<h1 className="text-lg leading-tight font-semibold">Mis votos</h1>
					<span className="truncate text-[0.8125rem] text-muted-foreground">
						{title}
					</span>
				</div>
			</header>

			<div className="flex flex-wrap gap-2">
				{FILTERS.map(({ value, label, icon: Icon, tone }) => (
					<Button
						key={value}
						variant={filter === value ? "selected" : "outline"}
						aria-pressed={filter === value}
						title={Icon ? label : undefined}
						onClick={() => onFilter(value)}
					>
						{Icon ? (
							<>
								<Icon
									aria-hidden
									className={filter === value ? undefined : tone}
								/>
								<span className="sr-only">{label}</span>
							</>
						) : (
							label
						)}{" "}
						<span className="tabular-nums">{counts[value]}</span>
					</Button>
				))}
			</div>

			<p className="text-[0.8125rem] text-muted-foreground">
				Toca una foto para verla en grande y cambiar tu voto.
			</p>

			{shown.length === 0 ? (
				<p className="py-8 text-center text-sm text-muted-foreground">
					No hay fotos en esta categoría.
				</p>
			) : (
				<ul className="grid grid-cols-3 gap-2">
					{shown.map((photo) => {
						// The number is the photo's place in the album, not in the filter.
						const number = photos.indexOf(photo) + 1;
						const pending = photo.approved === null;
						return (
							<li key={photo.id}>
								<button
									type="button"
									aria-label={`Foto ${number}: ${stateLabel(photo.approved)}`}
									onClick={() => onOpenPhoto(photo.id)}
									className={`relative block aspect-square w-full overflow-hidden rounded-lg bg-muted ${
										pending ? "opacity-60 ring-1 ring-border ring-dashed" : ""
									}`}
								>
									<img
										src={photo.urls.thumb}
										alt=""
										loading="lazy"
										className="size-full object-cover"
									/>
									{photo.approved !== null && (
										<span
											aria-hidden
											className={`absolute right-1 bottom-1 grid size-6 place-items-center rounded-full bg-background/90 ${
												photo.approved ? "text-primary" : "text-destructive"
											}`}
										>
											{photo.approved ? (
												<Heart className="size-3.5" />
											) : (
												<X className="size-3.5" />
											)}
										</span>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			)}

			{counts.pending > 0 && (
				<Button size="lg" onClick={onBack}>
					Seguir votando · quedan {counts.pending}
				</Button>
			)}
		</main>
	);
}
