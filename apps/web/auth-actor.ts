import { auth } from "./auth";

const localFallbackActorEmail = process.env.LOCAL_ACTOR_EMAIL ?? "approver@example.com";

async function safeAuth() {
  try {
    return await auth();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("outside a request scope")) return null;
    throw error;
  }
}

export async function getCurrentActorEmail(fallbackActorEmail?: string | null): Promise<string> {
  const session = await safeAuth();
  return session?.user?.email ?? fallbackActorEmail?.trim() ?? localFallbackActorEmail;
}

export async function getCurrentActor() {
  const session = await safeAuth();
  return {
    email: session?.user?.email ?? localFallbackActorEmail,
    name: session?.user?.name ?? null,
    authenticated: Boolean(session?.user?.email)
  };
}
