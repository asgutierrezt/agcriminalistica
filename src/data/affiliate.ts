/**
 * Amazon Associates (Amazon.com, US). The tracking tag is the only thing to
 * change if the account changes. Links are Amazon search links, which the
 * program allows; they keep working even if a specific edition goes out of
 * stock. Swap a `query` for an `asin` to deep-link a product.
 */
export const AMAZON_TAG = 'agcriminalist-20';

/** Amazon's required statement, word for word. */
export const AFFILIATE_DISCLOSURE = 'Como afiliado de Amazon, gano con las compras que cumplen los requisitos.';

export function amazonLink(item: { query?: string; asin?: string }) {
  if (item.asin) return `https://www.amazon.com/dp/${item.asin}?tag=${AMAZON_TAG}`;
  return `https://www.amazon.com/s?k=${encodeURIComponent(item.query ?? '')}&tag=${AMAZON_TAG}`;
}

/** rel/target for every affiliate link (Google requires rel="sponsored"). */
export const AFFILIATE_REL = 'sponsored nofollow noopener';
