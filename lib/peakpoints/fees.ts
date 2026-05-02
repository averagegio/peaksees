/** Fraction of Peakpoints flows retained by the platform (10%). */
export const PLATFORM_FEE_RATE = 0.1;

/** Gross USD cents paid → net Peakpoints credited (after deposit fee). */
export function peakpointsCreditAfterDepositFee(grossPaidCents: number): number {
  if (!Number.isFinite(grossPaidCents) || grossPaidCents <= 0) return 0;
  return Math.floor(grossPaidCents * (1 - PLATFORM_FEE_RATE));
}

/** Peakpoints removed from wallet → USD cents estimated for external payout (after withdraw fee). */
export function payoutCentsAfterWithdrawFee(peakpointsWithdrawnCents: number): number {
  if (!Number.isFinite(peakpointsWithdrawnCents) || peakpointsWithdrawnCents <= 0)
    return 0;
  return Math.floor(peakpointsWithdrawnCents * (1 - PLATFORM_FEE_RATE));
}
