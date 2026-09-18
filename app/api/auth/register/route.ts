import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { email?: unknown; password?: unknown; displayName?: unknown }
      | null;

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: "Email, password and display name are required." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (displayName.length < 2) {
      return NextResponse.json({ error: "Display name must be at least 2 characters." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        password: hash,
        displayName,
        name: displayName,
        credits: 3,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/auth/register]", msg);
    return NextResponse.json({ error: "Something went wrong creating your account." }, { status: 500 });
  }
}
