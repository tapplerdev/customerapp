import React from "react"
import PromoLine from "components/PromoLine/PromoLine"

// One of our components by file path, as at ProCard.tsx:274: NativeWind
// wraps it (review) and nothing here is a BUG. Probed as if it lived in
// src/, it is no call site of the twelve known at e30b19a.
export const ReviewOnly = () => (
  <PromoLine promoMessage="x" className="mt-[8]" />
)
