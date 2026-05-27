import { auth } from "./auth";

const localFallbackActorEmail = process.env.LOCAL_ACTOR_EMAIL ?? "approver@example.com";

export async function getCurrentActorEmail(fallbackActorEmail?: string | null): Promise<string> {
  const session = await auth();
  return session?.user?.email ?? fallbackActorEmail?.trim() ?? localFallbackActorEmail;
}

export async function getCurrentActor() {
  const session = await auth();
  return {
    email: session?.user?.email ?? localFallbackActorEmail,
    name: session?.user?.name ?? null,
    authenticated: Boolean(session?.user?.email)
  };
}
