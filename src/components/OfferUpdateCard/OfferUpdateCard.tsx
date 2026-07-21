import React from "react"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"

import TagRedIcon from "assets/icons/tag-red.svg"

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
  /** Pre-formatted message time, shown inline ("· 11:27 PM"). */
  time?: string
}

const grey = { fontSize: 11, lineHeight: 14, color: "#8C8C8C" } as const

/**
 * Slim thread marker for a price revision — the rich display lives in the
 * chat header's offer strip + history sheet; the thread only records WHEN it
 * happened, in the same quiet register as the other system lines.
 *
 * Bidi: every segment is its OWN Text node with unambiguous content (a digit
 * run, a lone arrow, a single word) — mixed-script strings ("→ 60 جنية")
 * get internally reordered by the bidi engine. The row mirrors naturally
 * under force-RTL, and the arrow flips per language so the progression reads
 * old → new in English and old ← new (right-to-left) in Arabic.
 */
const OfferUpdateCard: React.FC<Props> = ({ previous, next, time }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  return (
    <DmView className="flex-row items-center justify-center px-[24]">
      <TagRedIcon width={12} height={12} />
      <DmText className="ml-[5] font-custom400" style={grey}>
        {`${t("offer_updated")} · `}
      </DmText>
      <DmText
        className="font-custom400"
        style={{
          fontSize: 11,
          lineHeight: 14,
          color: "#B3B3B3",
          textDecorationLine: "line-through",
        }}
      >
        {`${previous}`}
      </DmText>
      <DmText
        className="font-custom600"
        style={{ fontSize: 11, lineHeight: 14, color: "#6A6A6A" }}
      >
        {isAr ? " ← " : " → "}
      </DmText>
      <DmText
        className="font-custom600"
        style={{ fontSize: 11, lineHeight: 14, color: "#6A6A6A" }}
      >
        {`${next}`}
      </DmText>
      <DmText
        className="font-custom600"
        style={{ fontSize: 11, lineHeight: 14, color: "#6A6A6A" }}
      >
        {` ${t("EGP")}`}
      </DmText>
      {time ? (
        <DmText className="font-custom400" style={grey}>
          {` · ${time}`}
        </DmText>
      ) : null}
    </DmView>
  )
}

export default OfferUpdateCard
