# TASK: Add Credentials Auth (Email/Password + Display Name)

## Overview
Add email+password signup/login as an alternative to Google OAuth. Capture a `displayName` for all users (shown to other users in the system).

## DB Schema (ALREADY DONE — do not modify prisma/schema.prisma)
- `User.displayName String?` — already added and pushed
- `User.password String?` — already added and pushed

## Package (ALREADY INSTALLED)
- `bcryptjs` and `@types/bcryptjs` are already installed

## Files to Create / Modify

### 1. `auth.ts` (MODIFY)
Replace the current Google-only auth config with one that supports both Google and Credentials.

Key requirements:
- Keep Google provider
- Add Credentials provider:
  - fields: email, password
  - On authorize: look up user by email, verify bcrypt hash, return user or null
  - Return { id, email, displayName, name, image, credits } from authorize
- Switch to JWT session strategy (required for Credentials provider with PrismaAdapter)
- Update callbacks:
  - `jwt` callback: on first call (trigger === "signIn"), load user from DB and store id, displayName, credits on token
  - `session` callback: copy token.id, token.displayName, token.credits onto session.user
- For Google sign-in, auto-set displayName from user.name if displayName is null (in signIn callback or jwt callback)

```typescript
// auth.ts target shape (pseudocode)
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Google({ ... }),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        // find user, verify password, return user object or null
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        // user object available on first sign-in
        token.id = user.id;
        // fetch displayName and credits from DB
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { displayName: true, credits: true } });
        token.displayName = dbUser?.displayName ?? user.name ?? null;
        token.credits = dbUser?.credits ?? 0;
        // If Google user and no displayName yet, save it
        if (!dbUser?.displayName && user.name) {
          await prisma.user.update({ where: { id: user.id }, data: { displayName: user.name } });
          token.displayName = user.name;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.displayName = token.displayName as string | null;
      session.user.credits = token.credits as number;
      return session;
    },
  },
});
```

### 2. `types/next-auth.d.ts` (CREATE)
Extend NextAuth types to include displayName and credits on session.user and JWT token:

```typescript
import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      displayName?: string | null;
      credits?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    displayName?: string | null;
    credits?: number;
  }
}
```

### 3. `app/api/auth/register/route.ts` (CREATE)
POST endpoint for new email/password account creation.

Request body: `{ email, password, displayName }`

Logic:
- Validate: all fields required, email format, password min 8 chars, displayName min 2 chars
- Check if user with that email already exists → 409 if so
- Hash password with `bcrypt.hash(password, 12)`
- Create user: `prisma.user.create({ data: { email, password: hash, displayName, name: displayName, credits: 3 } })`
- Return `{ success: true }` with 201
- On error: return `{ error: "..." }` with appropriate status

### 4. `app/login/page.tsx` (CREATE)
Custom login page. Route: `/login`

Design matches site style:
- Dark bg `#05071a`, Orbitron font
- Two tabs: "Google" and "Email"
- **Google tab**: shows the existing "Sign in with Google" button (calls `signIn("google")`)
- **Email tab**: shows a form with fields for email + password + (sign up only: display name + confirm password) + a Sign In / Create Account toggle link

Sign In mode (email tab):
- Fields: Email, Password
- Button: "SIGN IN"
- On submit: call `signIn("credentials", { email, password, redirect: false })`, if error show message, if success redirect to `/dashboard`
- Link: "Don't have an account? Create one"

Sign Up mode (email tab):
- Fields: Display Name, Email, Password, Confirm Password
- Button: "CREATE ACCOUNT"
- On submit: POST to `/api/auth/register`, then auto sign-in with credentials, redirect to `/dashboard`
- Link: "Already have an account? Sign in"

Display name helper text: "This is what other players will see"

Error handling: show inline error messages (bad password, email taken, etc.)

Loading states on buttons.

### 5. Update `app/page.tsx` (MODIFY)
Change both "Sign In with Google" buttons to instead open the login page.

Change:
```tsx
onClick={() => signIn("google")}
```
To:
```tsx
onClick={() => router.push("/login")}
```

Also update the button label from "Sign In with Google · Free" to "Get Started · Free" in the bottom CTA.
And the hero button from "Sign In to Start Forging" to "Get Started · Free"

### 6. Update `components/Nav.tsx` (MODIFY)
Change the nav "Sign In" button from `signIn("google")` to `router.push("/login")` (import `useRouter`).

## Style Conventions
- `"use client"` at top of client components
- Dark bg `#05071a`, Orbitron font via `font-orbitron` class
- Consistent with existing auth UI (same card style as dashboard, forge page)
- Mobile-friendly, inputs ≥ 44px touch targets
- Tailwind + inline style for glow/color effects

## ACCEPTANCE
- User can sign up with email + display name + password → account created, auto signed in, redirected to dashboard
- User can sign in with email + password
- User can still sign in with Google (and gets displayName set from their Google name)
- Session includes displayName and credits
- Landing page and nav buttons route to /login instead of directly calling signIn("google")
- No TypeScript errors

## CONTEXT
- NextAuth v5 (next-auth@5.x), @auth/prisma-adapter
- PrismaAdapter is used — JWT strategy must be used alongside Credentials (PrismaAdapter + Credentials requires JWT, not database sessions)
- Repo: /home/agentuser/game-forge
- The `prisma` client is at `@/lib/prisma`
- Stack: Next.js 15 app router, TypeScript, Tailwind
