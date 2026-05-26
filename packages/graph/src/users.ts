import { encodeGraphPathSegment, graphRequest } from "./client";

export type EntraUserLookupResult =
  | { status: "found"; id: string; displayName: string | null; mail: string | null; userPrincipalName: string | null }
  | { status: "not_found"; email: string }
  | { status: "ambiguous"; email: string; matches: Array<{ id: string; displayName: string | null; mail: string | null; userPrincipalName: string | null }> };

type GraphUser = {
  id: string;
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
};

type GraphUserCollection = {
  value?: GraphUser[];
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function lookupEntraUserByEmail(email: string): Promise<EntraUserLookupResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) return { status: "not_found", email };

  const escaped = normalized.replace(/'/g, "''");
  const query = new URLSearchParams({
    "$select": "id,displayName,mail,userPrincipalName",
    "$filter": `mail eq '${escaped}' or userPrincipalName eq '${escaped}'`,
    "$top": "3"
  });

  const result = await graphRequest<GraphUserCollection>(`/users?${query.toString()}`);
  const matches = (result.value ?? []).filter((user) => {
    return normalizeEmail(user.mail ?? "") === normalized || normalizeEmail(user.userPrincipalName ?? "") === normalized;
  });

  if (matches.length === 0) return { status: "not_found", email: normalized };
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      email: normalized,
      matches: matches.map((user) => ({
        id: user.id,
        displayName: user.displayName ?? null,
        mail: user.mail ?? null,
        userPrincipalName: user.userPrincipalName ?? null
      }))
    };
  }

  const [user] = matches;
  return {
    status: "found",
    id: user.id,
    displayName: user.displayName ?? null,
    mail: user.mail ?? null,
    userPrincipalName: user.userPrincipalName ?? null
  };
}

export async function getEntraUser(userIdOrPrincipalName: string): Promise<GraphUser> {
  return graphRequest<GraphUser>(
    `/users/${encodeGraphPathSegment(userIdOrPrincipalName)}?$select=id,displayName,mail,userPrincipalName`
  );
}
