// Test d'intégration : endpoint /api/ibkr/option-quote avec réponse Gateway
// simulée (mock) — Lot 5, cotation à la demande pour une échéance choisie
// dans le calculateur de rendement. Même patron que
// tests/integration/options-chain.test.ts (Lot 4) : seul le client Gateway
// est mocké, l'authentification passe par la base PostgreSQL locale.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/auth/user-service";

const TEST_EMAIL = "lot5-integration-test@example.com";

vi.mock("@/lib/auth-config", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/ibkr-gateway/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ibkr-gateway/client")
  >("@/lib/ibkr-gateway/client");
  return {
    ...actual,
    getOptionContractInfo: vi.fn(),
    getMarketDataSnapshot: vi.fn(),
  };
});

const { auth } = await import("@/lib/auth-config");
const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const { getOptionContractInfo, getMarketDataSnapshot } = await import(
  "@/lib/ibkr-gateway/client"
);
const { GET } = await import("@/app/api/ibkr/option-quote/route");

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

function futureMaturityDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
}

describe("GET /api/ibkr/option-quote (Lot 5)", () => {
  beforeEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("renvoie la cotation du contrat correspondant au strike/côté/échéance demandés", async () => {
    const maturityDate = futureMaturityDate(14);
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: user.email },
      twoFactorVerified: true,
      expires: "2099-01-01",
    });

    // Le mois résout plusieurs échéances (weeklies) : seule celle demandée
    // doit être retenue, quel que soit l'ordre du tableau.
    vi.mocked(getOptionContractInfo).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        {
          conid: 111,
          right: "P",
          strike: 150,
          maturityDate: futureMaturityDate(7),
        },
        { conid: 211, right: "P", strike: 150, maturityDate },
        { conid: 212, right: "C", strike: 150, maturityDate },
      ],
    });

    vi.mocked(getMarketDataSnapshot).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        {
          conid: 211,
          "84": "1.80",
          "86": "1.95",
          "31": "1.85",
          "7308": "-0.22",
        },
      ],
    });

    const request = new Request(
      `http://localhost/api/ibkr/option-quote?conid=265598&expiration=SEP26&strike=150&right=P&maturityDate=${maturityDate}`,
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.quote.conid).toBe(211);
    expect(body.quote.maturityDate).toBe(maturityDate);
    expect(body.quote.bid).toBe(1.8);
    expect(body.quote.ask).toBe(1.95);
    expect(body.quote.delta).toBe(-0.22);
  });

  it("renvoie 404 quand aucun contrat ne correspond à l'échéance demandée", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: user.email },
      twoFactorVerified: true,
      expires: "2099-01-01",
    });

    vi.mocked(getOptionContractInfo).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        {
          conid: 111,
          right: "P",
          strike: 150,
          maturityDate: futureMaturityDate(7),
        },
      ],
    });

    const request = new Request(
      `http://localhost/api/ibkr/option-quote?conid=265598&expiration=SEP26&strike=150&right=P&maturityDate=${futureMaturityDate(30)}`,
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("no_contract");
    expect(getMarketDataSnapshot).not.toHaveBeenCalled();
  });

  it("normalise une erreur Gateway sans exposer le détail brut", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: user.email },
      twoFactorVerified: true,
      expires: "2099-01-01",
    });

    vi.mocked(getOptionContractInfo).mockResolvedValue({
      ok: false,
      latencyMs: 1,
      error: { kind: "network", message: "Le Gateway IBKR est injoignable." },
    });

    const request = new Request(
      `http://localhost/api/ibkr/option-quote?conid=265598&expiration=SEP26&strike=150&right=P&maturityDate=${futureMaturityDate(7)}`,
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("network");
    expect(body.message).not.toMatch(/stack|Error:/i);
  });

  it("rejette une requête avec des paramètres invalides", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: user.email },
      twoFactorVerified: true,
      expires: "2099-01-01",
    });

    const request = new Request(
      "http://localhost/api/ibkr/option-quote?conid=265598&expiration=SEP26&strike=150&right=X&maturityDate=20260101",
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(getOptionContractInfo).not.toHaveBeenCalled();
  });

  it("rejette une requête non authentifiée", async () => {
    mockedAuth.mockResolvedValue(null);

    const request = new Request(
      `http://localhost/api/ibkr/option-quote?conid=265598&expiration=SEP26&strike=150&right=P&maturityDate=${futureMaturityDate(7)}`,
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
