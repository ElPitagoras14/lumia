import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Trash2, X } from "lucide-react";
import { useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { deleteParticipant, type ParticipantTally } from "@/lib/api";

interface ResultsByPersonProps {
	albumId: number;
	participants: ParticipantTally[];
	photoCount: number;
	onOpen: (participantId: number) => void;
	onDeleted: (participantId: number) => void;
}

export function ResultsByPerson({
	albumId,
	participants,
	photoCount,
	onOpen,
	onDeleted,
}: ResultsByPersonProps) {
	const queryClient = useQueryClient();
	const [toDelete, setToDelete] = useState<ParticipantTally | null>(null);

	const remove = useMutation({
		mutationFn: (participant: ParticipantTally) =>
			deleteParticipant(albumId, participant.id),
		// Not optimistic: it is destructive and rare, so the answer is awaited.
		// Invalidating "albums" recalculates these results and the album's
		// participant count.
		onSuccess: async (_data, participant) => {
			await queryClient.invalidateQueries({ queryKey: ["albums"] });
			onDeleted(participant.id);
			setToDelete(null);
		},
	});

	return (
		<>
			<ul className="flex flex-col gap-3">
				{participants.map((participant) => {
					const pending = photoCount - participant.ratedCount;
					const percent =
						photoCount > 0 ? (participant.ratedCount / photoCount) * 100 : 0;
					return (
						<li key={participant.id} className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => onOpen(participant.id)}
								className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
							>
								<span
									aria-hidden
									className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-semibold"
								>
									{participant.name.charAt(0).toUpperCase()}
								</span>
								<span className="flex min-w-0 flex-1 flex-col gap-1.5">
									<span className="flex items-center justify-between gap-2">
										<strong className="truncate text-sm">
											{participant.name}
										</strong>
										<span className="shrink-0 text-[0.8125rem] text-muted-foreground">
											{participant.ratedCount} de {photoCount}
										</span>
									</span>
									<Progress
										value={percent}
										aria-label={`${participant.name} calificó ${participant.ratedCount} de ${photoCount} fotos`}
									/>
									<span className="flex items-center gap-3 text-[0.8125rem]">
										<span className="flex items-center gap-1 text-primary">
											<Heart className="size-3.5" aria-hidden />
											{participant.approvedCount}
										</span>
										<span className="flex items-center gap-1 text-destructive">
											<X className="size-3.5" aria-hidden />
											{participant.rejectedCount}
										</span>
										<span className="text-muted-foreground">
											{pending === 0
												? "Terminó"
												: pending === 1
													? "1 pendiente"
													: `${pending} pendientes`}
										</span>
									</span>
								</span>
							</button>
							<Button
								variant="ghost"
								size="icon"
								aria-label={`Eliminar a ${participant.name} y sus votos`}
								onClick={() => setToDelete(participant)}
							>
								<Trash2 aria-hidden />
							</Button>
						</li>
					);
				})}
			</ul>

			<AlertDialog
				open={toDelete !== null}
				onOpenChange={(open) => {
					if (!open) {
						setToDelete(null);
						remove.reset();
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>¿Eliminar a {toDelete?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							Se borrarán también todos sus votos. No se puede deshacer. Si
							vuelve a abrir el enlace, tendrá que entrar de nuevo con su
							nombre.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{remove.isError && (
						<p role="alert" className="text-sm text-destructive">
							No se pudo eliminar al participante. Inténtalo de nuevo.
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={remove.isPending}
							onClick={(event) => {
								event.preventDefault();
								if (toDelete) remove.mutate(toDelete);
							}}
						>
							Eliminar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
