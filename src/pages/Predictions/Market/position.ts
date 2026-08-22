// what a sale is worth measured against what it cost. showing only the proceeds made a
// position bought at 55% and quoted at 96% read as a loss to the player holding it.

// the slice of the position being sold. `spent` is the KP that actually left the wallet
// for the shares still held, so a partial sale carries its share of it.
export const paidFor = (spent: number, shares: number, held: number) =>
  held > 0 ? Math.round((spent * Math.min(Math.max(shares, 0), held)) / held) : 0;

export interface SaleResult {
  profit: number;
  pct: number;
}

// null while there is no quote yet: a blank row is honest, a zero is not
export const profitOf = (proceeds: number | null, paid: number): SaleResult | null => {
  if (proceeds === null) return null;
  const profit = proceeds - paid;
  return { profit, pct: paid > 0 ? Math.round((profit / paid) * 100) : 0 };
};
