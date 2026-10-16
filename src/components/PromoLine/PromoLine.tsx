import React from "react"
import SharedPromoLine from "@tappler/shared/src/components/PromoLine"

interface PromoLineProps {
  promoMessage: string
  className?: string
}

// The promo line banner is tappler-shared's, the one copy the pro app draws
// too, so the pro's previews of their card match what customers see here. It
// has no margins of its own, as this one didn't: callers place it. The props
// are typed here because this app's tsc can't see the shared file's types.
const PromoLine: React.FC<PromoLineProps> = ({ promoMessage, className }) => (
  <SharedPromoLine promoMessage={promoMessage} className={className} />
)

export default PromoLine
