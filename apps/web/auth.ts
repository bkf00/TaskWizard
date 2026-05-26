import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const tenantId = process.env.ENTRA_ID_TENANT_ID ?? process.env.GRAPH_TENANT_ID;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    MicrosoftEntraID({
      clientId: process.env.ENTRA_ID_CLIENT_ID ?? process.env.GRAPH_CLIENT_ID,
      clientSecret: process.env.ENTRA_ID_CLIENT_SECRET ?? process.env.GRAPH_CLIENT_SECRET,
      issuer: tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : undefined,
      authorization: {
        params: {
          scope: "openid profile email offline_access User.Read"
        }
      }
    })
  ]
});
