import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Images, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { logout } from "@/lib/api";

export const Route = createFileRoute("/_owner/")({ component: Home });

// A skeleton: the albums arrive with their own change. What is already real
// here is the session, shown through the owner's email and the sign-out button.
function Home() {
	const { user } = Route.useRouteContext();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const signOut = useMutation({
		mutationFn: logout,
		onSuccess: async () => {
			// Nothing cached about the owner may outlive the session.
			queryClient.clear();
			await navigate({ to: "/login" });
		},
	});

	return (
		<main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 px-4 py-6">
			<header className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
						<Images aria-hidden />
					</div>
					<div className="min-w-0">
						<h1 className="text-lg leading-tight font-semibold">Lumia</h1>
						<p className="truncate text-sm text-muted-foreground">
							{user.email}
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					className="h-11 shrink-0"
					disabled={signOut.isPending}
					onClick={() => signOut.mutate()}
				>
					<LogOut aria-hidden />
					Cerrar sesión
				</Button>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Tus álbumes</CardTitle>
					<CardDescription>
						Aquí aparecerán los álbumes que crees, con sus fotos y los
						resultados de la votación.
					</CardDescription>
				</CardHeader>
			</Card>
		</main>
	);
}
