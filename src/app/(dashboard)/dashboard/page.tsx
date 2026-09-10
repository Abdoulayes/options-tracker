import { auth, signOut } from "@/lib/auth-config";

// Placeholder du groupe (dashboard) pour le Lot 1 — sert uniquement à
// valider la protection de route par le proxy (aucune logique métier,
// cf. exclusions du Lot 1). Les pages réelles du dashboard arrivent aux
// lots suivants.
export default async function DashboardPlaceholderPage() {
  const session = await auth();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <h1 className="text-2xl font-semibold">
        Dashboard (placeholder — Lot 1)
      </h1>
      <p className="text-muted-foreground">
        Connecté en tant que {session?.user?.email}.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
