import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      // 'repo' scope zaroori hai taaki private/public repos fetch ho sakein
      authorization: { params: { scope: "read:user user:email public_repo" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account }: any) {
      // Jab user pehli baar login kare, uska token JWT mein daal do
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: any) {
      // JWT se nikal kar session mein daal do taaki frontend/backend use kar sake
      session.accessToken = token.accessToken;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };