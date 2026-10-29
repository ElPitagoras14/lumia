import { queryOptions } from "@tanstack/react-query";
import { getMe } from "./api";

// The session lives in an HttpOnly cookie that scripts cannot read, so the
// server is the only source of truth about who is signed in. This cached
// answer is what the guards and screens share.
export const meQueryOptions = queryOptions({
	queryKey: ["me"],
	queryFn: getMe,
});

/**
 * Where to go after signing in. Only paths inside this app are accepted:
 * anything else (another site, a protocol-relative `//host`) would turn the
 * login page into an open redirect.
 */
export function safeRedirect(target: string | undefined): string {
	if (
		target?.startsWith("/") &&
		!target.startsWith("//") &&
		!target.includes("\\")
	) {
		return target;
	}
	return "/";
}
