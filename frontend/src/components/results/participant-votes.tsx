import { useQuery } from "@tanstack/react-query";
import { Heart, X } from "lucide-react";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { getParticipantVotes, type ParticipantTally } from "@/lib/api";

interface ParticipantVotesProps {
	albumId: number;
	participant: ParticipantTally | undefined;
	photoCount: number;
	onClose: () => void;
}

function stateLabel(approved: boolean | null) {
	if (approved === null) return "sin votar";
	return approved ? "me gusta" : "no me gusta";
}

export function ParticipantVotes({
	albumId,
	participant,
	photoCount,
	onClose,
}: ParticipantVotesProps) {
	const votes = useQuery({
		queryKey: ["albums", albumId, "participants", participant?.id, "ratings"],
		queryFn: () => getParticipantVotes(albumId, participant?.id ?? 0),
		enabled: participant !== undefined,
	});

	return (
		<Drawer
			open={participant !== undefined}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DrawerContent>
				<DrawerHeader className="text-left!">
					<DrawerTitle>{participant?.name}</DrawerTitle>
					<DrawerDescription>
						{participant?.ratedCount} de {photoCount} fotos calificadas
					</DrawerDescription>
				</DrawerHeader>
				<div className="mx-auto max-h-[60svh] w-full max-w-md overflow-y-auto px-4 pb-6">
					{votes.isPending && (
						<div className="grid grid-cols-3 gap-2">
							{["a", "b", "c"].map((id) => (
								<Skeleton key={id} className="aspect-square rounded-lg" />
							))}
						</div>
					)}
					{votes.isError && (
						<p role="alert" className="text-sm text-destructive">
							No se pudieron cargar los votos. Inténtalo de nuevo en un momento.
						</p>
					)}
					<ul className="grid grid-cols-3 gap-2">
						{votes.data?.map((vote, index) => {
							const pending = vote.approved === null;
							return (
								<li
									key={vote.id}
									role="img"
									aria-label={`Foto ${index + 1}: ${stateLabel(vote.approved)}`}
									className={`relative aspect-square overflow-hidden rounded-lg bg-muted ${
										pending ? "opacity-60 ring-1 ring-border ring-dashed" : ""
									}`}
								>
									<img
										src={vote.thumbUrl}
										alt=""
										loading="lazy"
										className="size-full object-cover"
									/>
									{vote.approved !== null && (
										<span
											aria-hidden
											className={`absolute right-1 bottom-1 grid size-6 place-items-center rounded-full ${
												vote.approved
													? "bg-primary text-primary-foreground"
													: "bg-destructive text-white"
											}`}
										>
											{vote.approved ? (
												<Heart className="size-3.5" />
											) : (
												<X className="size-3.5" />
											)}
										</span>
									)}
								</li>
							);
						})}
					</ul>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
