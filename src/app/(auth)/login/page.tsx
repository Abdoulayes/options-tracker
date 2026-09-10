"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const inputClassName =
  "h-9 rounded-lg border border-input bg-input/30 px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function LoginPage() {
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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect.");
        return;
      }

      const session = await getSession();
      router.push(session?.twoFactorEnabled ? "/2fa/verify" : "/2fa/setup");
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
      <h1 className="text-xl font-semibold text-foreground">Connexion</h1>

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
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={inputClassName}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Connexion..." : "Se connecter"}
      </Button>

      <p className="text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <a
          href="/register"
          className="text-primary underline-offset-4 hover:underline"
        >
          Créer un compte
        </a>
      </p>
    </form>
  );
}
