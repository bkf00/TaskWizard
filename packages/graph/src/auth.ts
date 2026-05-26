import { getGraphCredentialConfig } from "./config";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

export async function getGraphAppToken(): Promise<string> {
  const credentials = getGraphCredentialConfig();

  if (!credentials) {
    throw new Error("Graph credentials are not configured.");
  }

  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  const response = await fetch(`https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`, {
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
