/**
 * Validates that a Stripe Checkout or Billing Portal redirect URL uses HTTPS
 * and belongs to an official stripe.com domain.
 */
export function isValidStripeRedirectUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "stripe.com" || parsed.hostname.endsWith(".stripe.com"))
    );
  } catch {
    return false;
  }
}
