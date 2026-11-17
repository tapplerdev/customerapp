import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import { Text, a, color, px } from "@tappler/shared/src/ds"
import styles from "./styles"

const RADIUS = 12
const TAIL = 2

/**
 * A system event the other side must not miss, rendered as a real chat bubble
 * on the soft pink surface (brand.tintSoft) rather than the quiet red line it
 * used to be, and not in solid red: red is for action buttons, and a notice to
 * read should not look like one. Same surface as OfferUpdateCard.
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
  /** "alert" — an event that ENDS the request (expired, cancelled, declined):
   *  primary text. "progress" — a lifecycle step (a food order moving along):
   *  secondary text. Both sit on the same soft pink surface: red is reserved
   *  for action buttons, so a notice never carries it, and what tells the two
   *  apart is the text colour, not an alarm colour. */
  tone?: "alert" | "progress"
}> = ({ textKey, time, incoming = false, tone = "alert" }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const tailLeft = incoming ? !isAr : isAr
  const isAlert = tone === "alert"

  return (
    <DmView
      style={[
        a.overflow_hidden,
        a.py_8,
        a.px_14,
        {
          backgroundColor: color.brand.tintSoft,
          borderTopLeftRadius: RADIUS,
          borderTopRightRadius: RADIUS,
          borderBottomLeftRadius: tailLeft ? TAIL : RADIUS,
          borderBottomRightRadius: tailLeft ? RADIUS : TAIL,
        },
      ]}
    >
      <Text
        size={13}
        weight="semibold"
        leading={px(17)}
        color={isAlert ? "primary" : "secondary"}
        style={styles.left}
      >
        {t(textKey)}
      </Text>
      {time ? (
        <Text size={10} color="tertiary" style={[styles.text, styles.left]}>
          {time}
        </Text>
      ) : null}
    </DmView>
  )
}

export default SystemEventBubble
