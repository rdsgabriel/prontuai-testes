import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      profile(profile) {
        if (profile.email.endsWith("@grupobrmed.com.br")) {
          return { ...profile, id: profile.sub };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
    callbackUrl: "/chat",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
