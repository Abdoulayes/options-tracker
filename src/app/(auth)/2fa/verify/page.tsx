"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const codeInputClassName =
  "h-9 rounded-lg border border-input bg-input/30 px-3 text-center text-sm tracking-widest text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function TwoFactorVerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        if (response.status === 429) {
          setError(
            "Trop de tentatives échouées. Réessayez dans quelques minutes.",
          );
        } else {
          setError(data?.error ?? "Code incorrect.");
        }
        return;
      }

      router.push("/dashboard");
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
      <h1 className="text-xl font-semibold text-foreground">
        Vérification 2FA
      </h1>
      <p className="text-sm text-muted-foreground">
        Saisissez le code à 6 chiffres généré par votre application
        d&apos;authentification.
      </p>

      <input
        type="text"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        required
        autoFocus
        placeholder="123456"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className={codeInputClassName}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Vérification..." : "Valider"}
      </Button>
    </form>
  );
}
