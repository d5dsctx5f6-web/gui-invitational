// Engine-wide config: the handicap allowance knob. PRODUCT_SPEC §5 / Addendum A #1 —
// 100% (full handicap) both formats. Structured so a per-format override is a config
// change, not a code change, if that's ever needed.

export type RoundFormat = "shamble" | "four_ball";

export interface AllowanceConfig {
  default: number;
  byFormat?: Partial<Record<RoundFormat, number>>;
}

/** Addendum A #1: 100% both formats. */
export const DEFAULT_ALLOWANCE: AllowanceConfig = { default: 1 };

export function resolveAllowance(
  config: AllowanceConfig,
  format?: RoundFormat,
): number {
  const override = format ? config.byFormat?.[format] : undefined;
  return override ?? config.default;
}
