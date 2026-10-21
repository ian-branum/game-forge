import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Preset avatar ids — mirrors the picker in components/ProfileModal.tsx. */
const AVATAR_IDS = [
  "avatar-1",
  "avatar-2",
  "avatar-3",
  "avatar-4",
  "avatar-5",
  "avatar-6",
  "avatar-7",
  "avatar-8",
] as const;

const MAX_DISPLAY_NAME = 40;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt truncates beyond 72 bytes

type ProfileBody = {
  displayName?: unknown;
  image?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
};

// GET /api/me/profile
// Lets the profile modal know whether to show the password section (OAuth-only
// users have no hash) without leaking the hash itself.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true, displayName: true, image: true, password: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    image: user.image,
    hasPassword: Boolean(user.password),
  });
}

// PATCH /api/me/profile
// Body: { displayName?, image?, currentPassword?, newPassword? }
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ProfileBody | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const has = (key: keyof ProfileBody) => Object.prototype.hasOwnProperty.call(body, key);

  const data: {
    displayName?: string;
    image?: string | null;
    password?: string;
  } = {};
  let passwordChanged = false;

  // ── Display name ───────────────────────────────────────────────────────────
  if (has("displayName")) {
    if (typeof body.displayName !== "string") {
      return NextResponse.json({ error: "Display name must be text." }, { status: 400 });
    }
    const displayName = body.displayName.trim();
    if (!displayName) {
      return NextResponse.json({ error: "Display name cannot be empty." }, { status: 400 });
    }
    if (displayName.length > MAX_DISPLAY_NAME) {
      return NextResponse.json(
        { error: `Display name must be ${MAX_DISPLAY_NAME} characters or fewer.` },
        { status: 400 }
      );
    }
    data.displayName = displayName;
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────
  if (has("image")) {
    if (body.image === null) {
      data.image = null; // clears the preset avatar
    } else if (typeof body.image === "string") {
      if (!(AVATAR_IDS as readonly string[]).includes(body.image)) {
        return NextResponse.json({ error: "Unknown avatar." }, { status: 400 });
      }
      data.image = body.image;
    } else {
      return NextResponse.json({ error: "Invalid avatar value." }, { status: 400 });
    }
  }

  // ── Password ───────────────────────────────────────────────────────────────
  const wantsPasswordChange = has("currentPassword") || has("newPassword");
  if (wantsPasswordChange) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    // OAuth-only accounts have no hash: skip the section entirely.
    if (user?.password) {
      const { currentPassword, newPassword } = body;
      if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
        return NextResponse.json(
          { error: "Current and new password are required." },
          { status: 400 }
        );
      }
      if (newPassword.length < MIN_PASSWORD || newPassword.length > MAX_PASSWORD) {
        return NextResponse.json(
          { error: `New password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters.` },
          { status: 400 }
        );
      }

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 400 }
        );
      }

      data.password = await bcrypt.hash(newPassword, 12);
      passwordChanged = true;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { displayName: true, image: true },
    });
    return NextResponse.json({
      displayName: updated.displayName,
      image: updated.image,
      passwordChanged,
    });
  } catch (err) {
    console.error("[PATCH /api/me/profile]", err);
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }
}
