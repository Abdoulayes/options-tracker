import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/validation-schemas/auth-schemas";
import { createUser, findUserByEmail } from "@/lib/auth/user-service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides." },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email." },
      { status: 409 },
    );
  }

  await createUser(email, password);

  return NextResponse.json({ success: true }, { status: 201 });
}
