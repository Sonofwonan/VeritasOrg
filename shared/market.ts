import { z } from "zod";

// Deliberately suspended until a licensed provider and execution-price policy
// are approved. Stored holding prices are not a fallback market-data source.
export const MARKET_TRADING_ENABLED = false;
export const MARKET_TRADING_NOTICE =
  "Trading is paused until verified market pricing is available. No orders can be placed.";
export const marketUnavailableSchema = z.object({
  code: z.literal("MARKET_DATA_UNAVAILABLE"),
  reason: z.literal("NO_APPROVED_PROVIDER"),
  tradingEnabled: z.literal(false),
  message: z.literal(MARKET_TRADING_NOTICE),
}).strict();
export const MARKET_UNAVAILABLE = marketUnavailableSchema.parse({
  code: "MARKET_DATA_UNAVAILABLE",
  reason: "NO_APPROVED_PROVIDER",
  tradingEnabled: MARKET_TRADING_ENABLED,
  message: MARKET_TRADING_NOTICE,
});
