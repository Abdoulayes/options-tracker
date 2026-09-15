// Test d'intégration : endpoint /api/ibkr/options-chain avec réponse
// Gateway simulée (mock) — Lot 4, cf. docs/3-decoupage-par-lots.md
// ("cas de test à livrer avec le code"). Seul le client Gateway est mocké ;
// l'authentification et la lecture des réglages utilisateur passent par la
// base PostgreSQL locale, comme les autres tests d'intégration du projet.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/auth/user-service";

const TEST_EMAIL = "lot4-integration-test@example.com";

vi.mock("@/lib/auth-config", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/ibkr-gateway/client", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ibkr-gateway/client")
  >("@/lib/ibkr-gateway/client");
  return {
    ...actual,
    searchTicker: vi.fn(),
    getOptionStrikes: vi.fn(),
    getOptionContractInfo: vi.fn(),
    getMarketDataSnapshot: vi.fn(),
  };
});

const { auth } = await import("@/lib/auth-config");
// `auth` de NextAuth est une fonction surchargée (session getter / middleware) ;
// on la remocke avec une signature simple pour ce test.
const mockedAuth = auth as unknown as ReturnType<typeof vi.fn>;
const {
  searchTicker,
  getOptionStrikes,
  getOptionContractInfo,
  getMarketDataSnapshot,
} = await import("@/lib/ibkr-gateway/client");
const { GET } = await import("@/app/api/ibkr/options-chain/route");

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

describe("GET /api/ibkr/options-chain (Lot 4)", () => {
  beforeEach(async () => {
    await cleanup();
    vi.clearAllMocks();
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("assemble la chaîne d'options à partir d'une réponse Gateway simulée", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: user.email },
      twoFactorVerified: true,
      expires: "2099-01-01",
    });

    vi.mocked(searchTicker).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        {
          conid: "265598",
          symbol: "AAPL",
          sections: [
            { secType: "STK" },
            { secType: "OPT", months: "SEP26;OCT26" },
          ],
        },
      ],
    });

    vi.mocked(getOptionStrikes).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: { call: [150], put: [150] },
    });

    vi.mocked(getOptionContractInfo).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        { conid: 111, right: "P", strike: 150, maturityDate: "20260918" },
        { conid: 112, right: "C", strike: 150, maturityDate: "20260918" },
      ],
    });

    vi.mocked(getMarketDataSnapshot).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        { conid: 265598, "31": "155.00" },
        {
          conid: 111,
          "84": "1.10",
          "86": "1.20",
          "31": "1.15",
          "87": "500",
          "7633": "1000",
          "7308": "-0.22",
        },
        {
          conid: 112,
          "84": "2.10",
          "86": "2.20",
          "31": "2.15",
          "87": "300",
          "7633": "800",
          "7308": "0.25",
        },
      ],
    });

    const request = new Request(
      "http://localhost/api/ibkr/options-chain?symbol=AAPL&conid=265598&expiration=SEP26",
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.expirations).toEqual(["SEP26", "OCT26"]);
    expect(body.selectedExpiration).toBe("SEP26");
    expect(body.availableMaturityDates).toEqual(["20260918"]);
    expect(body.selectedMaturityDate).toBe("20260918");
    expect(body.underlying).toEqual({ conid: 265598, last: 155 });
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].strike).toBe(150);
    expect(body.rows[0].put.bid).toBe(1.1);
    expect(body.rows[0].put.maturityDate).toBe("20260918");
    expect(body.rows[0].call.delta).toBe(0.25);
    expect(body.targetDeltaMin).toBeCloseTo(0.15);
    expect(body.targetDeltaMax).toBeCloseTo(0.3);
  });

  it("distingue plusieurs échéances hebdomadaires au sein d'un même mois", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: user.email },
      twoFactorVerified: true,
      expires: "2099-01-01",
    });

    vi.mocked(searchTicker).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        {
          conid: "265598",
          symbol: "AAPL",
          sections: [{ secType: "OPT", months: "SEP26" }],
        },
      ],
    });

    vi.mocked(getOptionStrikes).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: { call: [150], put: [150] },
    });

    // Deux échéances (deux vendredis) coexistent au strike 150 dans le même
    // mois "SEP26" — cas réel d'un sous-jacent avec options hebdomadaires.
    vi.mocked(getOptionContractInfo).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        { conid: 111, right: "P", strike: 150, maturityDate: "20260911" },
        { conid: 112, right: "C", strike: 150, maturityDate: "20260911" },
        { conid: 211, right: "P", strike: 150, maturityDate: "20260918" },
        { conid: 212, right: "C", strike: 150, maturityDate: "20260918" },
      ],
    });

    vi.mocked(getMarketDataSnapshot).mockResolvedValue({
      ok: true,
      latencyMs: 1,
      data: [
        { conid: 265598, "31": "155.00" },
        { conid: 111, "84": "1.00" },
        { conid: 112, "84": "1.50" },
        { conid: 211, "84": "1.80" },
        { conid: 212, "84": "2.30" },
      ],
    });

    // Sans maturityDate explicite : la plus proche (20260911) est retenue.
    const defaultRequest = new Request(
      "http://localhost/api/ibkr/options-chain?symbol=AAPL&conid=265598&expiration=SEP26",
    );
    const defaultBody = await (await GET(defaultRequest)).json();
    expect(defaultBody.availableMaturityDates).toEqual([
      "20260911",
      "20260918",
    ]);
    expect(defaultBody.selectedMaturityDate).toBe("20260911");
    expect(defaultBody.rows).toHaveLength(1);
    expect(defaultBody.rows[0].put.conid).toBe(111);
    expect(defaultBody.rows[0].put.bid).toBe(1.0);

    // Avec maturityDate explicite : l'autre échéance est retenue à la place.
    const explicitRequest = new Request(
      "http://localhost/api/ibkr/options-chain?symbol=AAPL&conid=265598&expiration=SEP26&maturityDate=20260918",
    );
    const explicitBody = await (await GET(explicitRequest)).json();
    expect(explicitBody.selectedMaturityDate).toBe("20260918");
    expect(explicitBody.rows[0].put.conid).toBe(211);
    expect(explicitBody.rows[0].put.bid).toBe(1.8);
  });

  it("normalise une erreur Gateway sans exposer le détail brut", async () => {
    const user = await createUser(TEST_EMAIL, "correct-horse-battery-1");
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: user.email },
      twoFactorVerified: true,
      expires: "2099-01-01",
    });

    vi.mocked(searchTicker).mockResolvedValue({
      ok: false,
      latencyMs: 1,
      error: {
        kind: "network",
        message: "Le Gateway IBKR est injoignable.",
      },
    });

    const request = new Request(
      "http://localhost/api/ibkr/options-chain?symbol=AAPL&conid=265598",
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("network");
    expect(body.message).not.toMatch(/stack|Error:/i);
  });

  it("rejette une requête non authentifiée", async () => {
    mockedAuth.mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/ibkr/options-chain?symbol=AAPL&conid=265598",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
