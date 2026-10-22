import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import colors from "@tappler/shared/src/styles/colors"
import { Text, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

/**
 * Parses the structured system-message text the backend writes when a pro
 * revises their offer: "offer_updated:<old>:<new>". Returns null for any
 * other text so callers fall through to the plain system-text rendering.
 */
export const parseOfferUpdate = (
  text?: string | null
): { previous: number; next: number } | null => {
  if (!text || !text.startsWith("offer_updated:")) return null
  const [, prev, next] = text.split(":")
  const previous = Number(prev)
  const nextRate = Number(next)
  if (!isFinite(previous) || !isFinite(nextRate)) return null
  return { previous, next: nextRate }
}

interface Props {
  previous: number
  next: number
  /** Pre-formatted message time, shown inside the bubble. */
  time?: string
}

const RADIUS = 12
const TAIL = 2

/**
 * A price revision is an event the other side must NOT miss, so it renders as a
 * real chat bubble in Tappler red rather than the grey centred system note it
 * used to be (which read as noise and got skimmed past).
 *
 * Positioning is owned by MessageComponent, which pins it to the INCOMING side
 * here — the pro is the one who changed the price, so on the customer's screen
 * it belongs with the pro's messages. (The pro app pins its copy to the
 * outgoing side for the same reason, from the other direction.) The tail is
 * squared on the same PHYSICAL corner in both languages, so the radii are
 * pre-flipped for Arabic — native force-RTL swaps borderBottomLeft/Right
 * underneath us.
 *
 * Bidi: every segment is its OWN Text node with unambiguous content (a digit
 * run, a lone arrow, a single word) — mixed-script strings ("→ 60 جنية") get
 * internally reordered by the bidi engine. The amounts row mirrors naturally
 * under force-RTL, and the arrow flips per language so the progression reads
 * old → new in English and old ← new (right-to-left) in Arabic.
 */
const OfferUpdateCard: React.FC<Props> = ({ previous, next, time }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  // Incoming, so the tail sits on the physical LEFT — the inverse of an
  // outgoing bubble. Written against force-RTL, which swaps these two corners
  // in Arabic: !isAr lands on the physical left in both languages.
  const tailLeft = !isAr

  return (
    <DmView
      style={[a.overflow_hidden, a.py_8, a.px_14, {
        backgroundColor: colors.red,
        borderTopLeftRadius: RADIUS,
        borderTopRightRadius: RADIUS,
        borderBottomLeftRadius: tailLeft ? TAIL : RADIUS,
        borderBottomRightRadius: tailLeft ? RADIUS : TAIL,
      }]}
    >
      <Text
        size={12}
        weight="semibold"
        leading="tight"
        color="inverse"
        style={{ textAlign: "left" }}
      >
        {t("offer_updated")}
      </Text>

      <DmView style={[a.flex_row, styles.row]}>
        <Text size={13} leading={{ fixed: px(17) }} style={styles.text}>
          {`${previous}`}
        </Text>
        <Text size={13} leading={{ fixed: px(17) }} style={styles.text2}>
          {isAr ? "  ←  " : "  →  "}
        </Text>
        <Text size={15} weight="semibold" leading={{ fixed: px(19) }} style={styles.text3}>
          {`${next}`}
        </Text>
        <Text size={13} leading={{ fixed: px(17) }} style={[a.ml_4, styles.text2]}>
          {t("EGP")}
        </Text>
      </DmView>

      {time ? (
        <Text
          size={10}
          style={[styles.text4, { color: "rgba(255,255,255,0.75)", textAlign: "left" }]}
        >
          {time}
        </Text>
      ) : null}
    </DmView>
  )
}

export default OfferUpdateCard
