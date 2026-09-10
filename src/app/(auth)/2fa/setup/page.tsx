"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface TwoFactorSetupData {
  qrCodeDataUrl: string;
  secret: string;
}

const codeInputClassName =
  "h-9 rounded-lg border border-input bg-input/30 px-3 text-center text-sm tracking-widest text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/2fa/setup", { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(
            data?.error ?? "Impossible de générer le secret 2FA.",
          );
        }
        return response.json() as Promise<TwoFactorSetupData>;
      })
      .then((data) => {
        if (!cancelled) setSetupData(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
        setError(data?.error ?? "Code incorrect.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold text-foreground">
        Configuration du 2FA
      </h1>
      <p className="text-sm text-muted-foreground">
        Scannez ce QR code avec votre application d&apos;authentification
        (Google Authenticator, Authy, 1Password), puis saisissez le code à 6
        chiffres généré pour confirmer.
      </p>

      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      {setupData && (
        <>
          {/* Image data URI générée côté serveur — pas d'optimisation next/image nécessaire */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setupData.qrCodeDataUrl}
            alt="QR code de configuration 2FA"
            className="size-48 self-center rounded-lg bg-white p-2"
          />
          <p className="break-all text-center text-xs text-muted-foreground">
            Clé manuelle : {setupData.secret}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              {pending ? "Vérification..." : "Activer le 2FA"}
            </Button>
          </form>
        </>
      )}

      {!setupData && !loadError && (
        <p className="text-sm text-muted-foreground">
          Génération du QR code...
        </p>
      )}
    </div>
  );
}
