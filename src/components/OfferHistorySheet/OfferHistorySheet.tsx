import React from "react"

import { ActivityIndicator } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import LegacyText from "@tappler/shared/src/components/LegacyText"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import moment from "moment"

import { useGetOfferHistoryQuery } from "services/api"
import colors from "@tappler/shared/src/styles/colors"
import TagRedIcon from "assets/icons/tag-red.svg"
import { Text, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

interface Props {
  isVisible: boolean
  onClose: () => void
  jobId?: number
  proId?: number
}

/**
 * The negotiation trail behind the chat header's offer strip: every offer the
 * pro has made on this job, newest first — current on top with a delta chip,
 * "first offer" anchoring the bottom. Same sheet on both apps.
 */
const OfferHistorySheet: React.FC<Props> = ({
  isVisible,
  onClose,
  jobId,
  proId,
}) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  // Under force-RTL "left" renders visually right for Arabic copy.
  const rtlText = { textAlign: "left" } as const

  // Unskipping on open re-subscribes, and refetchOnMountOrArgChange makes that
  // re-subscription refetch — so the sheet is fresh after every revise without
  // needing a cache tag.
  const { data, isLoading } = useGetOfferHistoryQuery(
    { jobId: jobId ?? 0, proId: proId ?? 0 },
    { skip: !isVisible || !jobId || !proId, refetchOnMountOrArgChange: true }
  )
  // Backend returns newest first (ORDER BY id DESC).
  const offers = data?.data ?? []

  return (
    <NativeActionSheet isVisible={isVisible} onClose={onClose}>
      <DmView
        style={[styles.list, a.px_16, a.pt_18, { paddingBottom: insets.bottom + 16 }]}
      >
        <Text
          size={16}
          weight="bold"
          style={[a.mb_12, rtlText]}
        >
          {t("offer_history_title")}
        </Text>
        {isLoading ? (
          <DmView style={[a.py_24, a.items_center]}>
            <ActivityIndicator size="small" color={colors.red} />
          </DmView>
        ) : (
          offers.map((offer, index) => {
            const previous = offers[index + 1]
            const delta =
              previous != null ? offer.ratePerHour - previous.ratePerHour : null
            const isCurrent = index === 0
            const isFirst = index === offers.length - 1
            return (
              <DmView
                key={offer.id}
                style={[a.flex_row, a.items_center, styles.container, a.px_12, a.mb_8, {
                  backgroundColor: "#FAF9F7",
                  borderWidth: 1,
                  borderColor: "#E6E3DE",
                  opacity: isCurrent ? 1 : 0.85,
                }]}
              >
                <TagRedIcon width={15} height={15} />
                <DmView style={[a.ml_10, a.flex_1]}>
                  {/* Row mirrors naturally under force-RTL: each Text is a
                      single atomic segment, so bidi can't reshuffle glyphs */}
                  <DmView
                    style={[a.flex_row, a.items_center, { alignSelf: "flex-start" }]}
                  >
                    <Text
                      size={px(17)}
                      weight="bold"
                      leading={{ fixed: px(21) }}
                      style={{ color: isCurrent ? "#1A1A1A" : "#6A6A6A" }}
                    >
                      {`${offer.ratePerHour} `}
                    </Text>
                    <Text
                      size={11}
                      leading={{ fixed: px(16) }}
                      style={{ color: "#8C8C8C" }}
                    >
                      {t("EGP")}
                    </Text>
                    {isCurrent && (
                      <DmView
                        style={[a.ml_6, styles.textWrap, a.px_6, { backgroundColor: "#E1F5EE" }]}
                      >
                        {/* 9.5 is off the ds scale: LegacyText, the bridge
                            pass 2 turns into Text */}
                        <LegacyText
                          weight="semibold"
                          style={{
                            fontSize: 9.5,
                            lineHeight: 13,
                            letterSpacing: 0.5,
                            color: "#0F6E56",
                          }}
                        >
                          {t("current").toUpperCase()}
                        </LegacyText>
                      </DmView>
                    )}
                  </DmView>
                  <Text
                    size={11}
                    leading="legacy"
                    style={[a.mt_2, { color: "#8C8C8C", textAlign: "left" }]}
                  >
                    {moment(offer.createdAt).format("DD/MM · h:mm A")}
                  </Text>
                </DmView>
                {delta != null && delta !== 0 ? (
                  <DmView
                    style={[styles.textWrap2, a.px_8, a.py_2, { backgroundColor: "#E1F5EE" }]}
                  >
                    <Text
                      size={11}
                      leading={{ fixed: px(15) }}
                      style={{ color: "#0F6E56" }}
                    >
                      {`${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${t("EGP")}`}
                    </Text>
                  </DmView>
                ) : isFirst ? (
                  // 10.5 is off the ds scale: LegacyText
                  <LegacyText
                    weight="regular"
                    style={{ fontSize: 10.5, lineHeight: 14, color: "#B3B3B3" }}
                  >
                    {t("first_offer")}
                  </LegacyText>
                ) : null}
              </DmView>
            )
          })
        )}
      </DmView>
    </NativeActionSheet>
  )
}

export default OfferHistorySheet
