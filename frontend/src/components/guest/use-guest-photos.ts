import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
	type GuestPhoto,
	getGuestPhotos,
	isApiError,
	ratePhoto,
} from "@/lib/api";

export type VoteFilter = "all" | "liked" | "disliked" | "pending";

export function filterPhotos(photos: GuestPhoto[], filter: VoteFilter) {
	switch (filter) {
		case "liked":
			return photos.filter((photo) => photo.approved === true);
		case "disliked":
			return photos.filter((photo) => photo.approved === false);
		case "pending":
			return photos.filter((photo) => photo.approved === null);
		default:
			return photos;
	}
}

/**
 * The guest's photos with their own votes, and the vote action. The server is
 * the only source of progress: everything else (what is pending, the counts,
 * whether the deck is finished) is derived from this one list.
 */
export function useGuestPhotos(token: string) {
	const queryClient = useQueryClient();
	const queryKey = ["shared", token, "photos"] as const;
	const [voteError, setVoteError] = useState<string | null>(null);

	const query = useQuery({
		queryKey,
		queryFn: () => getGuestPhotos(token),
		retry: false,
	});

	const setApproved = (photoId: number, approved: boolean | null) =>
		queryClient.setQueryData<GuestPhoto[]>(queryKey, (current) =>
			current?.map((photo) =>
				photo.id === photoId ? { ...photo, approved } : photo,
			),
		);

	const rate = useMutation({
		mutationFn: (vote: { photoId: number; approved: boolean }) =>
			ratePhoto(token, vote.photoId, vote.approved),
		// Optimistic, so the deck moves on without waiting for the network.
		onMutate: async ({ photoId, approved }) => {
			setVoteError(null);
			await queryClient.cancelQueries({ queryKey });
			const previous = queryClient
				.getQueryData<GuestPhoto[]>(queryKey)
				?.find((photo) => photo.id === photoId)?.approved;
			setApproved(photoId, approved);
			return { previous: previous ?? null };
		},
		// Only the photo that failed goes back: reverting the whole list would
		// also undo votes still in flight for other photos.
		onError: (error, { photoId }, context) => {
			setApproved(photoId, context?.previous ?? null);
			if (isApiError(error, "unauthenticated")) {
				// The cookie is gone: the album asks for the name again.
				void queryClient.invalidateQueries({ queryKey: ["shared", token] });
				setVoteError("Tu sesión en este álbum expiró. Entra de nuevo.");
			} else if (isApiError(error, "not_found")) {
				// The owner deleted the photo or revoked the link.
				void queryClient.invalidateQueries({ queryKey: ["shared", token] });
				setVoteError("Esa foto ya no está disponible.");
			} else {
				setVoteError("No se pudo guardar tu voto. Inténtalo de nuevo.");
			}
		},
		onSuccess: (photo) => {
			queryClient.setQueryData<GuestPhoto[]>(queryKey, (current) =>
				current?.map((item) => (item.id === photo.id ? photo : item)),
			);
		},
	});

	const photos = query.data ?? [];
	const counts = {
		all: photos.length,
		liked: photos.filter((photo) => photo.approved === true).length,
		disliked: photos.filter((photo) => photo.approved === false).length,
		pending: photos.filter((photo) => photo.approved === null).length,
	};

	return {
		query,
		photos,
		counts,
		rated: counts.all - counts.pending,
		voteError,
		vote: (photoId: number, approved: boolean) =>
			rate.mutate({ photoId, approved }),
	};
}
