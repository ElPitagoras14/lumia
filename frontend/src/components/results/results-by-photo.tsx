import { ArrowDownUp, Heart, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import type { PhotoTally } from "@/lib/api";

export type PhotoSort = "upload" | "liked";

// Below this many voters a "winner" is noise: one person's taste, often a
// many-way tie. The ranking still shows, without crowning anyone.
const MIN_VOTERS_FOR_REVEAL = 3;
// A tie for first shows at most this many photos in its grid; the others
// lead the list right below with the same count.
const MAX_TIED_SHOWN = 6;

interface ResultsByPhotoProps {
	photos: PhotoTally[];
	participantCount: number;
	// Unset means the default: most liked first once there are votes, since
	// that is what the owner comes to see; upload order before that.
	sort: PhotoSort | undefined;
	onSort: (sort: PhotoSort) => void;
}

interface NumberedPhoto {
	photo: PhotoTally;
	// The photo's place in the album, not in the sorted list.
	number: number;
}

function pendingNote(pending: number) {
	if (pending === 0) return "Todos votaron";
	return pending === 1 ? "1 pendiente" : `${pending} pendientes`;
}

function likesOf(count: number, participantCount: number) {
	return `${count} de ${participantCount} ${
		participantCount === 1 ? "persona" : "personas"
	}`;
}

export function ResultsByPhoto({
	photos,
	participantCount,
	sort,
	onSort,
}: ResultsByPhotoProps) {
	const [open, setOpen] = useState<NumberedPhoto | null>(null);

	const numbered = photos.map((photo, index) => ({ photo, number: index + 1 }));
	const hasLikes = photos.some((photo) => photo.approvedCount > 0);
	const effectiveSort = sort ?? (hasLikes ? "liked" : "upload");
	// Array.sort is stable, so ties keep the upload order.
	const shown =
		effectiveSort === "liked"
			? [...numbered].sort(
					(a, b) => b.photo.approvedCount - a.photo.approvedCount,
				)
			: numbered;

	// The reveal: in "most liked" order the leaders leave the list and take
	// the table. A single leader is shown large; a tie shows every photo that
	// shares first place, so none of them reads as second.
	const topCount = shown[0]?.photo.approvedCount ?? 0;
	const tooFewVoters = participantCount < MIN_VOTERS_FOR_REVEAL;
	const allLeaders =
		effectiveSort === "liked" && hasLikes && !tooFewVoters
			? shown.filter((item) => item.photo.approvedCount === topCount)
			: [];
	const leaders = allLeaders.slice(0, MAX_TIED_SHOWN);
	const top = leaders.length === 1 ? leaders[0] : undefined;
	const rest = shown.slice(leaders.length);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex justify-end">
				<Button
					variant={effectiveSort === "liked" ? "selected" : "outline"}
					aria-pressed={effectiveSort === "liked"}
					onClick={() => onSort(effectiveSort === "liked" ? "upload" : "liked")}
				>
					<ArrowDownUp aria-hidden />
					Más gustadas
				</Button>
			</div>

			{effectiveSort === "liked" && hasLikes && tooFewVoters && (
				<p className="text-sm text-muted-foreground">
					Aún hay pocos votos para elegir una favorita:{" "}
					{participantCount === 1
						? "votó 1 persona"
						: `votaron ${participantCount} personas`}
					. Comparte el enlace con más gente.
				</p>
			)}

			{photos.length === 0 && (
				<p className="py-6 text-center text-sm text-muted-foreground">
					Este álbum todavía no tiene fotos.
				</p>
			)}

			{top && (
				<button
					type="button"
					onClick={() => setOpen(top)}
					className="group flex flex-col gap-2.5 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
				>
					<img
						src={top.photo.deckUrl}
						alt={`Foto ${top.number}`}
						className="aspect-[4/3] w-full rounded-xl bg-muted object-cover"
					/>
					<span className="flex items-baseline justify-between gap-3">
						<span className="flex flex-col">
							<span className="text-[0.8125rem] text-muted-foreground">
								La más gustada
							</span>
							<strong className="text-lg font-semibold">
								Foto {top.number}
							</strong>
						</span>
						<span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
							<Heart className="size-4" aria-hidden />
							{likesOf(top.photo.approvedCount, participantCount)}
						</span>
					</span>
				</button>
			)}

			{leaders.length > 1 && (
				<section className="flex flex-col gap-2.5" aria-labelledby="tied-title">
					<div className="flex items-baseline justify-between gap-3">
						<h2 id="tied-title" className="text-base font-semibold">
							{allLeaders.length} fotos empatadas en primer lugar
						</h2>
						<span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary">
							<Heart className="size-4" aria-hidden />
							{likesOf(topCount, participantCount)}
						</span>
					</div>
					<ul className="grid grid-cols-3 gap-1.5">
						{leaders.map((item) => (
							<li key={item.photo.id}>
								<button
									type="button"
									onClick={() => setOpen(item)}
									aria-label={`Ver la foto ${item.number}`}
									className="block w-full rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
								>
									<img
										src={item.photo.thumbUrl}
										alt=""
										loading="lazy"
										className="aspect-square w-full rounded-lg bg-muted object-cover"
									/>
								</button>
							</li>
						))}
					</ul>
				</section>
			)}

			{rest.length > 0 && (
				<ul className="flex flex-col gap-1">
					{rest.map((item) => (
						<li key={item.photo.id}>
							<TallyRow
								item={item}
								participantCount={participantCount}
								onOpen={() => setOpen(item)}
							/>
						</li>
					))}
				</ul>
			)}

			<Dialog
				open={open !== null}
				onOpenChange={(next) => {
					if (!next) setOpen(null);
				}}
			>
				<DialogContent className="gap-3 p-3">
					{open && (
						<>
							<img
								src={open.photo.deckUrl}
								alt={`Foto ${open.number}`}
								className="max-h-[70svh] w-full rounded-lg bg-muted object-contain"
							/>
							<div className="flex flex-col gap-1 px-1 pb-1">
								<DialogTitle>Foto {open.number}</DialogTitle>
								<DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
									<span className="flex items-center gap-1 text-primary">
										<Heart className="size-3.5" aria-hidden />
										{open.photo.approvedCount} me gusta
									</span>
									<span className="flex items-center gap-1 text-destructive">
										<X className="size-3.5" aria-hidden />
										{open.photo.rejectedCount} no me gusta
									</span>
									<span>{pendingNote(open.photo.pendingCount)}</span>
								</DialogDescription>
							</div>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}

function TallyRow({
	item: { photo, number },
	participantCount,
	onOpen,
}: {
	item: NumberedPhoto;
	participantCount: number;
	onOpen: () => void;
}) {
	const approvedWidth =
		participantCount > 0 ? (photo.approvedCount / participantCount) * 100 : 0;
	const rejectedWidth =
		participantCount > 0 ? (photo.rejectedCount / participantCount) * 100 : 0;
	return (
		<button
			type="button"
			onClick={onOpen}
			aria-label={`Ver la foto ${number}: ${photo.approvedCount} me gusta, ${photo.rejectedCount} no me gusta, ${pendingNote(photo.pendingCount).toLowerCase()}`}
			className="flex w-full items-center gap-3 rounded-lg p-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			<img
				src={photo.thumbUrl}
				alt=""
				loading="lazy"
				className="size-16 shrink-0 rounded-lg bg-muted object-cover"
			/>
			<span className="flex min-w-0 flex-1 flex-col gap-1.5">
				<span className="flex items-center justify-between gap-2">
					<strong className="text-sm">Foto {number}</strong>
					<span className="flex items-center gap-3 text-sm">
						<span className="flex items-center gap-1 text-primary">
							<Heart className="size-3.5" aria-hidden />
							{photo.approvedCount}
						</span>
						<span className="flex items-center gap-1 text-destructive">
							<X className="size-3.5" aria-hidden />
							{photo.rejectedCount}
						</span>
					</span>
				</span>
				<span
					aria-hidden
					className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
				>
					<span className="bg-primary" style={{ width: `${approvedWidth}%` }} />
					{/* A tint, not a solid: a "no" must not be the loudest thing
					    in the list (DESIGN.md, Signal colors). */}
					<span
						className="bg-destructive/35"
						style={{ width: `${rejectedWidth}%` }}
					/>
				</span>
				<span className="text-[0.8125rem] text-muted-foreground">
					{pendingNote(photo.pendingCount)}
				</span>
			</span>
		</button>
	);
}
