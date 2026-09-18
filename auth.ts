import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Credentials provider requires JWT sessions (database sessions are incompatible).
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        // Assigned to a variable so the extra fields don't trip excess-property checks.
        const authedUser = {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          displayName: user.displayName,
          credits: user.credits,
        };
        return authedUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;

        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { displayName: true, credits: true },
        });
        token.displayName = dbUser?.displayName ?? null;
        token.credits = dbUser?.credits ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.displayName = (token.displayName as string | null | undefined) ?? null;
        session.user.credits = (token.credits as number | undefined) ?? 0;
      }
      return session;
    },
  },
});
