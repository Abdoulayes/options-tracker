import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";

// Protection des routes du groupe (dashboard) — spec technique 13.2. Les
// groupes de routes Next.js sont transparents au niveau de l'URL : la
// protection est donc implémentée en liste blanche de routes publiques,
// tout le reste (dont les futures pages du groupe (dashboard)) nécessitant
// une session complète (post-2FA).
const PUBLIC_PATHS = ["/", "/login", "/register"];
const TWO_FACTOR_PATHS = ["/2fa/setup", "/2fa/verify"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const session = req.auth;

  if (TWO_FACTOR_PATHS.includes(pathname)) {
    // Une session partielle (post mot de passe, pré-2FA) suffit pour accéder
    // aux écrans de setup/vérification du 2FA.
    if (!session?.user?.id) {
      return NextResponse.redirect(new URL("/login", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!session?.twoFactorVerified) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
