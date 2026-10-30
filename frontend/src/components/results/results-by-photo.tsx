import { ArrowDownUp, Heart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PhotoTally } from "@/lib/api";

export type PhotoSort = "upload" | "liked";

interface ResultsByPhotoProps {
	photos: PhotoTally[];
	participantCount: number;
	sort: PhotoSort;
	onSort: (sort: PhotoSort) => void;
}

function pendingNote(pending: number) {
	if (pending === 0) return "Todos votaron";
	return pending === 1 ? "1 pendiente" : `${pending} pendientes`;
}

export function ResultsByPhoto({
	photos,
	participantCount,
	sort,
	onSort,
}: ResultsByPhotoProps) {
	// The number is the photo's place in the album, not in the sorted list.
	const numbered = photos.map((photo, index) => ({ photo, number: index + 1 }));
	// Array.sort is stable, so ties keep the upload order.
	const shown =
		sort === "liked"
			? [...numbered].sort(
					(a, b) => b.photo.approvedCount - a.photo.approvedCount,
				)
			: numbered;

	return (
		<div className="flex flex-col gap-3">
			<div className="flex justify-end">
				<Button
					variant={sort === "liked" ? "default" : "outline"}
					size="sm"
					aria-pressed={sort === "liked"}
					onClick={() => onSort(sort === "liked" ? "upload" : "liked")}
				>
					<ArrowDownUp aria-hidden />
					Más gustadas
				</Button>
			</div>

			{photos.length === 0 ? (
				<p className="py-6 text-center text-sm text-muted-foreground">
					Este álbum todavía no tiene fotos.
				</p>
			) : (
				<ul className="flex flex-col gap-3">
					{shown.map(({ photo, number }) => {
						const approvedWidth =
							participantCount > 0
								? (photo.approvedCount / participantCount) * 100
								: 0;
						const rejectedWidth =
							participantCount > 0
								? (photo.rejectedCount / participantCount) * 100
								: 0;
						return (
							<li key={photo.id} className="flex items-center gap-3">
								<img
									src={photo.thumbUrl}
									alt=""
									loading="lazy"
									className="size-16 shrink-0 rounded-lg bg-muted object-cover"
								/>
								<div className="flex min-w-0 flex-1 flex-col gap-1.5">
									<div className="flex items-center justify-between gap-2">
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
									</div>
									<div
										role="img"
										aria-label={`${photo.approvedCount} me gusta, ${photo.rejectedCount} no me gusta, ${photo.pendingCount} pendientes`}
										className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
									>
										<span
											className="bg-primary"
											style={{ width: `${approvedWidth}%` }}
										/>
										<span
											className="bg-destructive"
											style={{ width: `${rejectedWidth}%` }}
										/>
									</div>
									<span className="text-[0.8125rem] text-muted-foreground">
										{pendingNote(photo.pendingCount)}
									</span>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
