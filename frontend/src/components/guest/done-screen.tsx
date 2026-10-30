import { Heart, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DoneScreenProps {
	name: string;
	title: string;
	total: number;
	liked: number;
	disliked: number;
	onReview: () => void;
}

export function DoneScreen({
	name,
	title,
	total,
	liked,
	disliked,
	onReview,
}: DoneScreenProps) {
	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-8 px-6 py-10">
			<div className="grid size-12 place-items-center rounded-xl bg-primary text-primary-foreground">
				<Sun className="size-6" aria-hidden />
			</div>
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl leading-tight font-semibold break-words">
					¡Listo, {name}!
				</h1>
				<p className="text-base text-muted-foreground">
					{total === 1
						? "Calificaste la foto de "
						: `Calificaste las ${total} fotos de `}
					{title}.
				</p>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1 rounded-xl border p-4">
					<span className="flex items-center gap-2 text-2xl font-semibold">
						<Heart className="size-5 text-primary" aria-hidden />
						{liked}
					</span>
					<span className="text-[0.8125rem] text-muted-foreground">
						me gustan
					</span>
				</div>
				<div className="flex flex-col gap-1 rounded-xl border p-4">
					<span className="flex items-center gap-2 text-2xl font-semibold">
						<X className="size-5 text-destructive" aria-hidden />
						{disliked}
					</span>
					<span className="text-[0.8125rem] text-muted-foreground">
						no me gustan
					</span>
				</div>
			</div>
			<div className="flex flex-col gap-3">
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
