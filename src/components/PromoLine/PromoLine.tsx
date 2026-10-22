import React from "react"
import type { StyleProp, ViewStyle } from "react-native"

import SharedPromoLine from "@tappler/shared/src/components/PromoLine"
import { type NoShorthands } from "@tappler/shared/src/ds"

interface PromoLineProps {
  promoMessage: string
  /**
   * Where the banner sits, as a style. Like every twin it takes one key per
   * side or corner (see NoShorthands).
   */
  style?: StyleProp<ViewStyle & NoShorthands>
}

// The promo line banner is tappler-shared's, the one copy the pro app draws
// too, so the pro's previews of their card match what customers see here. It
// has no margins of its own, as this one didn't: callers place it. The props
// are typed here because this app's tsc can't see the shared file's types.
const PromoLine: React.FC<PromoLineProps> = ({ promoMessage, style }) => (
  <SharedPromoLine promoMessage={promoMessage} style={style} />
)

export default PromoLine
