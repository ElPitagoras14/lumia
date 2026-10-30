import { Heart, LayoutGrid, X } from "lucide-react";
import {
	type PointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { GuestPhoto } from "@/lib/api";

// A drag past this share of the card's width votes; so does a quick flick.
const COMMIT_RATIO = 0.3;
const FLICK_SPEED = 0.5; // px per ms
const FLICK_MIN_DISTANCE = 40;
// Below this the gesture is a tap, which opens the viewer.
const TAP_SLOP = 6;
const PRELOAD_AHEAD = 2;
const LEAVE_FALLBACK_MS = 600;

interface VoteDeckProps {
	title: string;
	participantName: string;
	photos: GuestPhoto[];
	rated: number;
	error: string | null;
	onVote: (photoId: number, approved: boolean) => void;
	onOpenVotes: () => void;
	onOpenPhoto: (photoId: number) => void;
}

export function VoteDeck({
	title,
	participantName,
	photos,
	rated,
	error,
	onVote,
	onOpenVotes,
	onOpenPhoto,
}: VoteDeckProps) {
	const pending = photos.filter((photo) => photo.approved === null);
	const current = pending[0];
	const [leaving, setLeaving] = useState<{
		photo: GuestPhoto;
		approved: boolean;
		from: number;
	} | null>(null);
	const preloaded = useRef<HTMLImageElement[]>([]);
	const clearLeaving = useCallback(() => setLeaving(null), []);

	const reducedMotion =
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	function vote(approved: boolean, from = 0) {
		if (!current) return;
		if (!reducedMotion) setLeaving({ photo: current, approved, from });
		onVote(current.id, approved);
	}

	// Warms the next cards so they appear without a visible load. The URLs are
	// stable and nginx caches them, so this also warms the shared cache.
	const currentId = current?.id;
	// biome-ignore lint/correctness/useExhaustiveDependencies: the deck advances when the current card changes, not on every photos array.
	useEffect(() => {
		preloaded.current = pending
			.slice(1, 1 + PRELOAD_AHEAD)
			.map((photo) => Object.assign(new Image(), { src: photo.urls.deck }));
	}, [currentId]);

	// The same action as the buttons. Ignored while typing in a field.
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const target = event.target as HTMLElement | null;
			if (target?.closest("input, textarea, [contenteditable]")) return;
			if (event.key === "ArrowRight") vote(true);
			else if (event.key === "ArrowLeft") vote(false);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	});

	if (!current) return null;
	const total = photos.length;
	const position = photos.findIndex((photo) => photo.id === current.id) + 1;

	return (
		<main className="mx-auto flex h-svh max-w-md flex-col gap-4 px-4 pt-4 pb-6">
			<header className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 flex-col">
					<strong className="truncate text-base">{title}</strong>
					<span className="text-[0.8125rem] text-muted-foreground">
						Hola, {participantName}
					</span>
				</div>
				<Button variant="outline" size="sm" onClick={onOpenVotes}>
					<LayoutGrid aria-hidden />
					Mis votos
				</Button>
			</header>

			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between">
					<span className="text-[0.8125rem] text-muted-foreground">
						Tu avance
					</span>
					<span>
						<strong>{rated}</strong>{" "}
						<span className="text-[0.8125rem] text-muted-foreground">
							de {total}
						</span>
					</span>
				</div>
				<Progress
					value={(rated / total) * 100}
					aria-label="Fotos calificadas"
					getValueLabel={() => `${rated} de ${total}`}
				/>
			</div>

			<div className="relative min-h-0 flex-1">
				{pending[1] && (
					<div
						aria-hidden
						className="absolute inset-0 scale-95 overflow-hidden rounded-2xl bg-muted opacity-60"
					/>
				)}
				<DeckCard
					key={`card-${current.id}`}
					photo={current}
					label={`Foto ${position} de ${total}. Toca para ampliar`}
					caption={`Foto ${position}`}
					onCommit={vote}
					onOpen={() => onOpenPhoto(current.id)}
				/>
				{leaving && (
					<LeavingCard
						// Prefixed: the voted photo is briefly both the leaving card and
						// the current one, and sibling keys must differ.
						key={`leaving-${leaving.photo.id}`}
						photo={leaving.photo}
						approved={leaving.approved}
						from={leaving.from}
						onDone={clearLeaving}
					/>
				)}
			</div>

			{error && (
				<p role="alert" className="text-center text-sm text-destructive">
					{error}
				</p>
			)}

			<div className="flex items-center justify-center gap-6">
				<Button
					type="button"
					variant="outline"
					size="icon-lg"
					className="size-14 rounded-full"
					aria-label="No me gusta"
					onClick={() => vote(false)}
				>
					<X aria-hidden className="size-6" />
				</Button>
				<Button
					type="button"
					size="icon-lg"
					className="size-14 rounded-full"
					aria-label="Me gusta"
					onClick={() => vote(true)}
				>
					<Heart aria-hidden className="size-6" />
				</Button>
			</div>
			<p className="text-center text-[0.8125rem] text-muted-foreground">
				Desliza a la derecha si te gusta y a la izquierda si no
			</p>
		</main>
	);
}

function VoteTag({
	approved,
	opacity,
}: {
	approved: boolean;
	opacity: number;
}) {
	const Icon = approved ? Heart : X;
	return (
		<span
			aria-hidden
			style={{ opacity }}
			className={`absolute top-4 flex items-center gap-1.5 rounded-lg border-2 bg-background/80 px-3 py-1 text-sm font-bold tracking-wide ${
				approved
					? "left-4 -rotate-6 border-primary text-primary"
					: "right-4 rotate-6 border-destructive text-destructive"
			}`}
		>
			<Icon className="size-4" />
			{approved ? "ME GUSTA" : "NO ME GUSTA"}
		</span>
	);
}

function DeckCard({
	photo,
	label,
	caption,
	onCommit,
	onOpen,
}: {
	photo: GuestPhoto;
	label: string;
	caption: string;
	onCommit: (approved: boolean, from: number) => void;
	onOpen: () => void;
}) {
	const cardRef = useRef<HTMLButtonElement>(null);
	const gesture = useRef({ startX: 0, startTime: 0, moved: false });
	const [dx, setDx] = useState(0);
	const [dragging, setDragging] = useState(false);

	function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
		event.currentTarget.setPointerCapture(event.pointerId);
		gesture.current = {
			startX: event.clientX,
			startTime: event.timeStamp,
			moved: false,
		};
		setDragging(true);
	}

	function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
		if (!dragging) return;
		const delta = event.clientX - gesture.current.startX;
		if (Math.abs(delta) > TAP_SLOP) gesture.current.moved = true;
		setDx(delta);
	}

	function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
		if (!dragging) return;
		setDragging(false);
		const width = cardRef.current?.offsetWidth ?? 1;
		const elapsed = Math.max(event.timeStamp - gesture.current.startTime, 1);
		const speed = Math.abs(dx) / elapsed;
		const far = Math.abs(dx) > width * COMMIT_RATIO;
		const flick = Math.abs(dx) > FLICK_MIN_DISTANCE && speed > FLICK_SPEED;
		if (far || flick) {
			onCommit(dx > 0, dx);
			return;
		}
		setDx(0);
	}

	function onPointerCancel() {
		setDragging(false);
		setDx(0);
		gesture.current.moved = false;
	}

	// A native button also clicks on Enter and Space. The click that follows
	// a drag is not a tap, so it is skipped; the flag is spent either way so a
	// later keyboard activation is not swallowed.
	function onClick() {
		const wasDrag = gesture.current.moved;
		gesture.current.moved = false;
		if (!wasDrag) onOpen();
	}

	const width = cardRef.current?.offsetWidth ?? 300;
	const strength = Math.min(Math.abs(dx) / (width * COMMIT_RATIO), 1);

	return (
		<button
			ref={cardRef}
			type="button"
			aria-label={label}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerUp}
			onPointerCancel={onPointerCancel}
			onClick={onClick}
			// pan-y keeps vertical scrolling for the page; only the horizontal
			// movement belongs to the card.
			style={{
				touchAction: "pan-y",
				transform: `translateX(${dx}px) rotate(${dx * 0.05}deg)`,
				transition: dragging ? "none" : "transform 200ms ease-out",
			}}
			className="absolute inset-0 cursor-grab overflow-hidden rounded-2xl bg-muted shadow-lg select-none active:cursor-grabbing"
		>
			<img
				src={photo.urls.deck}
				alt=""
				draggable={false}
				className="size-full object-cover"
			/>
			{dx > 0 && <VoteTag approved opacity={strength} />}
			{dx < 0 && <VoteTag approved={false} opacity={strength} />}
			<span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-4 pt-10 pb-3 text-sm text-white">
				<span>{caption}</span>
				<span>Toca para ampliar</span>
			</span>
		</button>
	);
}

// The card that was just voted, flying out from where it was released while
// the next one is already in place underneath.
function LeavingCard({
	photo,
	approved,
	from,
	onDone,
}: {
	photo: GuestPhoto;
	approved: boolean;
	from: number;
	onDone: () => void;
}) {
	const [go, setGo] = useState(false);
	useEffect(() => {
		const frame = requestAnimationFrame(() => setGo(true));
		// `transitionend` does not fire if the element stops rendering mid-way,
		// and a card left behind would sit over the deck.
		const fallback = setTimeout(onDone, LEAVE_FALLBACK_MS);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(fallback);
		};
	}, [onDone]);

	const direction = approved ? 1 : -1;
	return (
		<div
			aria-hidden
			onTransitionEnd={onDone}
			style={{
				transform: go
					? `translateX(${direction * 150}%) rotate(${direction * 20}deg)`
					: `translateX(${from}px) rotate(${from * 0.05}deg)`,
				transition: go ? "transform 250ms ease-in" : "none",
			}}
			className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-muted shadow-lg"
		>
			<img
				src={photo.urls.deck}
				alt=""
				draggable={false}
				className="size-full object-cover"
			/>
			<VoteTag approved={approved} opacity={1} />
		</div>
	);
}
