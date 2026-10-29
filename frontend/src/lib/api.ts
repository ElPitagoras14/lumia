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
