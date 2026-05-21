import { renewGraphSubscription } from "@repo/graph/subscriptions";

export async function renewSubscriptionIfNeeded(input: {
  subscriptionId: string;
  expiresAt: string;
  renewWithinHours?: number;
}): Promise<{ renewed: boolean; newExpiresAt?: string }> {
  const renewWithinMs = (input.renewWithinHours ?? 12) * 60 * 60 * 1000;
  const expiresAt = new Date(input.expiresAt).getTime();
  const now = Date.now();

  if (expiresAt - now > renewWithinMs) {
    return { renewed: false };
  }

  const newExpiration = new Date(now + 48 * 60 * 60 * 1000).toISOString();
  const renewed = await renewGraphSubscription({
    subscriptionId: input.subscriptionId,
    expirationDateTime: newExpiration
  });

  return { renewed: true, newExpiresAt: renewed.expirationDateTime };
}

