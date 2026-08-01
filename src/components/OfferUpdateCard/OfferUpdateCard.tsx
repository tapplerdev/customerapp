import React from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import colors from "@tappler/shared/src/styles/colors"

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

const struck = {
  fontSize: 13,
  lineHeight: 17,
  color: "rgba(255,255,255,0.65)",
  textDecorationLine: "line-through",
  textDecorationColor: "rgba(255,255,255,0.65)",
} as const

const emphasis = { fontSize: 15, lineHeight: 19, color: "#FFFFFF" } as const
const connector = { fontSize: 13, lineHeight: 17, color: "rgba(255,255,255,0.9)" } as const

/**
 * A price revision is an event the other side must NOT miss, so it renders as a
 * real chat bubble in Tappler red rather than the grey centred system note it
 * used to be (which read as noise and got skimmed past).
 *
 * Positioning is owned by MessageComponent, which pins it to the own/system
 * side exactly like an outgoing bubble. The tail corner is squared on the same
 * PHYSICAL corner in both languages, so the radii are pre-flipped for Arabic —
 * native force-RTL swaps borderBottomLeft/Right underneath us.
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
  const tailLeft = isAr

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
        className="text-12 leading-[15px] font-custom600 text-white"
        style={{ textAlign: "left" }}
      >
        {t("offer_updated")}
      </DmText>

      <DmView className="flex-row items-baseline mt-[3]">
        <DmText className="font-custom400" style={struck}>
          {`${previous}`}
        </DmText>
        <DmText className="font-custom400" style={connector}>
          {isAr ? "  ←  " : "  →  "}
        </DmText>
        <DmText className="font-custom600" style={emphasis}>
          {`${next}`}
        </DmText>
        <DmText className="ml-[4] font-custom400" style={connector}>
          {t("EGP")}
        </DmText>
      </DmView>

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

export default OfferUpdateCard
