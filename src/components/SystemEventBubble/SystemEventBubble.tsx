import React from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import colors from "@tappler/shared/src/styles/colors"

const RADIUS = 12
const TAIL = 2

/**
 * A system event the other side must not miss, rendered as a real chat bubble
 * in Tappler red rather than the quiet red line it used to be — same treatment
 * as OfferUpdateCard, and for the same reason: as a centred grey/red note it
 * read as chrome and got skimmed past.
 *
 * Positioning is owned by MessageComponent. The tail corner is squared on the
 * same PHYSICAL corner in both languages, so the radii are pre-flipped for
 * Arabic — native force-RTL swaps borderBottomLeft/Right underneath us.
 */
const SystemEventBubble: React.FC<{
  textKey: string
  time?: string
  /** Set when the event is the OTHER party's doing, so the bubble sits on the
   *  incoming side and its tail points that way too. A tail on the wrong
   *  corner is what makes a correctly-placed bubble still look misattributed.
   *
   *  This existed in the pro app and not here, which is how a restaurant
   *  cancelling ended up rendering on the CUSTOMER's own side — reading as
   *  though they had cancelled it themselves. */
  incoming?: boolean
}> = ({ textKey, time, incoming = false }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const tailLeft = incoming ? !isAr : isAr

  return (
    <DmView
      className="overflow-hidden py-[8] px-[14]"
      style={{
        backgroundColor: colors.red,
        borderTopLeftRadius: RADIUS,
        borderTopRightRadius: RADIUS,
        borderBottomLeftRadius: tailLeft ? TAIL : RADIUS,
        borderBottomRightRadius: tailLeft ? RADIUS : TAIL,
      }}
    >
      <DmText
        className="text-13 leading-[17px] font-custom600 text-white"
        style={{ textAlign: "left" }}
      >
        {t(textKey)}
      </DmText>
      {time ? (
        <DmText
          className="mt-[3] text-10 leading-[13px] font-custom400"
          style={{ color: "rgba(255,255,255,0.75)", textAlign: "left" }}
        >
          {time}
        </DmText>
      ) : null}
    </DmView>
  )
}

export default SystemEventBubble
