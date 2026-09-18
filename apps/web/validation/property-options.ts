export function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(result) || result < min || result > max) throw new Error(`Expected integer ${min}..${max}; received ${value}`);
  return result;
}
export const propertyOptions = {
  seed: boundedInteger(process.env.FUZZ_SEED, 20260918, -2147483648, 2147483647),
  numRuns: boundedInteger(process.env.FUZZ_RUNS, 60, 1, 100),
  ...(process.env.FUZZ_PATH ? { path: process.env.FUZZ_PATH } : {}),
  verbose: true as const,
};
