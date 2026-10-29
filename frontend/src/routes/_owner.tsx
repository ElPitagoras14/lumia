import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { isApiError } from "@/lib/api";
import { meQueryOptions } from "@/lib/auth";

// Layout of the owner's area, without a path of its own: every route under
// `_owner/` goes through this guard, so none can be reached without a session.
export const Route = createFileRoute("/_owner")({
	beforeLoad: async ({ context, location }) => {
		try {
			const user = await context.queryClient.ensureQueryData(meQueryOptions);
			return { user };
		} catch (error) {
			if (isApiError(error, "unauthenticated")) {
				throw redirect({
					to: "/login",
					search: { redirect: location.href },
				});
			}
			throw error;
		}
	},
	component: Outlet,
});
