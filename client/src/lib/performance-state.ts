// The ledger currently has no verified quote provenance, prior-close prices,
// opening-period valuations, or reconciled performance cash-flow history.
// Numeric currentPrice/purchasePrice fields alone are not evidence of returns:
// the trading routes populate them using simulated prices.
export const PERFORMANCE_UNAVAILABLE = {
  ytd: "Verified opening valuations and complete cash-flow history are not available.",
  day: "Verified current and previous-close prices are not available.",
  holdings: "Stored prices are unverified; investment gains cannot be confirmed.",
  explanation: "Investment performance is unavailable until verified prices and valuation history are available. Deposits are not investment gains; fee overdrafts are account liabilities, not investment returns.",
} as const;
