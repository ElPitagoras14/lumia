import axios, { type AxiosRequestConfig, isAxiosError } from "axios";

// The shape of every body the API sends: `data` on success, `error` on
// failure, and never both.
interface Envelope<T> {
	data: T | null;
	error: {
		code: string;
		message: string;
		field: string | null;
		requestId: string | null;
	} | null;
}

/**
 * A failure the API explained. Screens decide what to do from `code`, which
 * is stable, and never from `message`, which is written for a log.
 */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly field?: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export function isApiError(error: unknown, code?: string): error is ApiError {
	return (
		error instanceof ApiError && (code === undefined || error.code === code)
	);
}

// Same origin in every mode: nginx in containers, the Vite proxy natively.
const http = axios.create({ baseURL: "/api" });

async function request<T>(config: AxiosRequestConfig): Promise<T> {
	try {
		const response = await http.request<Envelope<T>>(config);
		return response.data.data as T;
	} catch (error) {
		const body = isAxiosError<Envelope<unknown>>(error)
			? error.response?.data
			: undefined;
		if (isAxiosError(error) && error.response && body?.error) {
			const { code, message, field } = body.error;
			throw new ApiError(
				error.response.status,
				code,
				message,
				field ?? undefined,
			);
		}
		// Not one of ours (the network is down, a gateway answered): let the
		// caller treat it as an unexpected failure.
		throw error;
	}
}

export interface User {
	id: number;
	email: string;
}

export const login = (email: string, password: string) =>
	request<User>({
		method: "post",
		url: "/auth/login",
		data: { email, password },
	});

export const logout = () =>
	request<null>({ method: "post", url: "/auth/logout" });

export const getMe = () => request<User>({ method: "get", url: "/auth/me" });

export interface Album {
	id: number;
	title: string;
	createdAt: string;
	photoCount: number;
	coverUrl: string | null;
	// Null while the album has no link; the link is `/a/<shareToken>`.
	shareToken: string | null;
	participantCount: number;
}

export interface SharedAlbum {
	album: { title: string; photoCount: number };
	// Null until this browser has joined the album with a name.
	participant: { name: string } | null;
}

export interface Photo {
	id: number;
	sizeBytes: number;
	createdAt: string;
	urls: { thumb: string; deck: string; viewer: string };
}

// Mirrors the backend's limits. They are only here to answer before sending;
// the server stays the authority and rejects anything outside them.
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTOS_PER_ALBUM = 50;
export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const listAlbums = () =>
	request<Album[]>({ method: "get", url: "/albums" });

export const getAlbum = (albumId: number) =>
	request<Album>({ method: "get", url: `/albums/${albumId}` });

export const createAlbum = (title: string) =>
	request<Album>({ method: "post", url: "/albums", data: { title } });

export const deleteAlbum = (albumId: number) =>
	request<null>({ method: "delete", url: `/albums/${albumId}` });

export const listPhotos = (albumId: number) =>
	request<Photo[]>({ method: "get", url: `/albums/${albumId}/photos` });

export const uploadPhoto = (
	albumId: number,
	file: File,
	onProgress?: (percent: number) => void,
) => {
	const data = new FormData();
	data.append("file", file);
	return request<Photo>({
		method: "post",
		url: `/albums/${albumId}/photos`,
		data,
		onUploadProgress: (event) => {
			if (event.total)
				onProgress?.(Math.round((event.loaded / event.total) * 100));
		},
	});
};

export const deletePhoto = (albumId: number, photoId: number) =>
	request<null>({
		method: "delete",
		url: `/albums/${albumId}/photos/${photoId}`,
	});

// Creates the album's link or replaces the current one: for the server,
// generating and revoking are the same operation.
export const generateShareLink = (albumId: number) =>
	request<Album>({ method: "post", url: `/albums/${albumId}/share` });

export const getSharedAlbum = (token: string) =>
	request<SharedAlbum>({ method: "get", url: `/share/${token}` });

export const joinSharedAlbum = (token: string, name: string) =>
	request<{ name: string }>({
		method: "post",
		url: `/share/${token}/participants`,
		data: { name },
	});
