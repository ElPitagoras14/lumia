import { useQuery } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAlbumResults } from "@/lib/api";
import { ParticipantVotes } from "./participant-votes";
import { ResultsByPerson } from "./results-by-person";
import { type PhotoSort, ResultsByPhoto } from "./results-by-photo";

export type ResultsGrouping = "photo" | "person";

interface AlbumResultsProps {
	albumId: number;
	by: ResultsGrouping;
	sort: PhotoSort;
	participantId: number | undefined;
	onBy: (by: ResultsGrouping) => void;
	onSort: (sort: PhotoSort) => void;
	onOpenParticipant: (participantId: number) => void;
	onCloseParticipant: () => void;
	onShare: () => void;
}

const GROUPINGS: { value: ResultsGrouping; label: string }[] = [
	{ value: "photo", label: "Por foto" },
	{ value: "person", label: "Por persona" },
];

export function AlbumResults({
	albumId,
	by,
	sort,
	participantId,
	onBy,
	onSort,
	onOpenParticipant,
	onCloseParticipant,
	onShare,
}: AlbumResultsProps) {
	const results = useQuery({
		queryKey: ["albums", albumId, "results"],
		queryFn: () => getAlbumResults(albumId),
	});

	if (results.isPending) {
		return (
			<div className="flex flex-col gap-3">
				<Skeleton className="h-16 rounded-lg" />
				<Skeleton className="h-16 rounded-lg" />
				<Skeleton className="h-16 rounded-lg" />
			</div>
		);
	}

	if (results.isError) {
		return (
			<p role="alert" className="text-sm text-destructive">
				No se pudieron cargar los resultados. Inténtalo de nuevo en un momento.
			</p>
		);
	}

	const { summary, photos, participants } = results.data;

	if (summary.participantCount === 0) {
		return (
			<div className="flex flex-col items-center gap-3 py-8 text-center">
				<p className="text-sm text-muted-foreground">
					Todavía no entró nadie a votar. Comparte el álbum para empezar a
					recibir votos.
				</p>
				<Button variant="outline" onClick={onShare}>
					<Share2 aria-hidden />
					Compartir
				</Button>
			</div>
		);
	}

	const percent =
		summary.possibleVotes > 0
			? Math.round((summary.voteCount / summary.possibleVotes) * 100)
			: 0;

	return (
		<div className="flex flex-col gap-4">
			<dl className="grid grid-cols-3 gap-2 text-center">
				<div className="flex flex-col rounded-lg bg-muted p-2">
					<dd className="text-lg font-semibold">{summary.participantCount}</dd>
					<dt className="text-[0.8125rem] text-muted-foreground">
						{summary.participantCount === 1 ? "persona" : "personas"}
					</dt>
				</div>
				<div className="flex flex-col rounded-lg bg-muted p-2">
					<dd className="text-lg font-semibold">{summary.voteCount}</dd>
					<dt className="text-[0.8125rem] text-muted-foreground">
						de {summary.possibleVotes} votos
					</dt>
				</div>
				<div className="flex flex-col rounded-lg bg-muted p-2">
					<dd className="text-lg font-semibold">{percent} %</dd>
					<dt className="text-[0.8125rem] text-muted-foreground">completado</dt>
				</div>
			</dl>

			<nav className="flex gap-2" aria-label="Agrupar resultados">
				{GROUPINGS.map(({ value, label }) => (
					<Button
						key={value}
						variant={by === value ? "default" : "outline"}
						size="sm"
						aria-current={by === value ? "page" : undefined}
						onClick={() => onBy(value)}
					>
						{label}
					</Button>
				))}
			</nav>

			{by === "photo" ? (
				<ResultsByPhoto
					photos={photos}
					participantCount={summary.participantCount}
					sort={sort}
					onSort={onSort}
				/>
			) : (
				<ResultsByPerson
					albumId={albumId}
					participants={participants}
					photoCount={photos.length}
					onOpen={onOpenParticipant}
					onDeleted={(deletedId) => {
						if (deletedId === participantId) onCloseParticipant();
					}}
				/>
			)}

			<ParticipantVotes
				albumId={albumId}
				participant={participants.find((p) => p.id === participantId)}
				photoCount={photos.length}
				onClose={onCloseParticipant}
			/>
		</div>
	);
}
