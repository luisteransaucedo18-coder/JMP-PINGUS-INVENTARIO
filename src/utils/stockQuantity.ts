/** Matches numeric(14,3) in inventory; rejects values that PostgreSQL would round. */
export function validStockQuantity(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value < 100000000000
    && Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001;
}

export function validRollLength(value: number): boolean {
  return validStockQuantity(value) && value > 0 && value <= 100000;
}
