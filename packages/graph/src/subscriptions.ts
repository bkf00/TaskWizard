import { getGraphAppToken } from "./auth";

export type GraphSubscriptionRequest = {
  changeType: "created" | "updated" | "deleted" | "created,updated";
  notificationUrl: string;
  resource: string;
  expirationDateTime: string;
  clientState: string;
};

export type GraphSubscription = GraphSubscriptionRequest & {
  id: string;
};

export async function createGraphSubscription(input: GraphSubscriptionRequest): Promise<GraphSubscription> {
  const accessToken = await getGraphAppToken();
  const response = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Graph subscription create failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

export async function renewGraphSubscription(input: {
  subscriptionId: string;
  expirationDateTime: string;
}): Promise<GraphSubscription> {
  const accessToken = await getGraphAppToken();
  const response = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${input.subscriptionId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expirationDateTime: input.expirationDateTime })
  });

  if (!response.ok) {
    throw new Error(`Graph subscription renew failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

