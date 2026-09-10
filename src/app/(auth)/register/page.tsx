"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const inputClassName =
  "h-9 rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "Impossible de créer le compte.");
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(
          "Compte créé, mais la connexion automatique a échoué. Connectez-vous manuellement.",
        );
        router.push("/login");
        return;
      }

      router.push("/2fa/setup");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4"
    >
      <h1 className="text-xl font-semibold text-foreground">Créer un compte</h1>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-muted-foreground">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClassName}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-muted-foreground">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClassName}
        />
        <p className="text-xs text-muted-foreground">
          8 caractères minimum, au moins une lettre et un chiffre.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Création..." : "Créer le compte"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <a
          href="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Se connecter
        </a>
      </p>
    </form>
  );
}
