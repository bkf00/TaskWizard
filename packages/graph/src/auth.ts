type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

export async function getGraphAppToken(): Promise<string> {
  const tenantId = process.env.GRAPH_TENANT_ID ?? process.env.ENTRA_ID_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID ?? process.env.ENTRA_ID_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET ?? process.env.ENTRA_ID_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Graph credentials are not configured.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Graph token request failed: ${response.status} ${await response.text()}`);
  }

  const token = (await response.json()) as TokenResponse;
  return token.access_token;
}

