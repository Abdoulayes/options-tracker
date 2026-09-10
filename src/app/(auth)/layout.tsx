import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-12 text-foreground">
      {children}
    </main>
  );
}
