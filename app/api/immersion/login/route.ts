import { AUTH_COOKIE, checkPassword, isAuthed, sessionToken } from "@/lib/immersion/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AGE = 60 * 60 * 24 * 180;

export async function GET(req: Request) {
  return Response.json({ authed: isAuthed(req) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.password !== "string" || !checkPassword(body.password)) {
    return Response.json({ ok: false, error: "Wrong password." }, { status: 401 });
  }
  return Response.json(
    { ok: true },
    {
      headers: {
        "set-cookie": `${AUTH_COOKIE}=${sessionToken()}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`,
      },
    },
  );
}

export async function DELETE() {
  return Response.json(
    { ok: true },
    { headers: { "set-cookie": `${AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` } },
  );
}
