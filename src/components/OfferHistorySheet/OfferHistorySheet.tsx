import React from "react"

import { ActivityIndicator } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"
import { useTranslation } from "react-i18next"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import moment from "moment"

import { useGetOfferHistoryQuery } from "services/api"
import colors from "@tappler/shared/src/styles/colors"
import TagRedIcon from "assets/icons/tag-red.svg"

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
        className="bg-white rounded-t-12 px-[16] pt-[18]"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <DmText
          className="text-16 leading-[20px] font-custom700 text-black mb-[12]"
          style={rtlText}
        >
          {t("offer_history_title")}
        </DmText>
        {isLoading ? (
          <DmView className="py-[24] items-center">
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
                className="flex-row items-center rounded-12 px-[12] py-[11] mb-[8]"
                style={{
                  backgroundColor: "#FAF9F7",
                  borderWidth: 1,
                  borderColor: "#E6E3DE",
                  opacity: isCurrent ? 1 : 0.85,
                }}
              >
                <TagRedIcon width={15} height={15} />
                <DmView className="ml-[10] flex-1">
                  {/* Row mirrors naturally under force-RTL: each Text is a
                      single atomic segment, so bidi can't reshuffle glyphs */}
                  <DmView
                    className="flex-row items-center"
                    style={{ alignSelf: "flex-start" }}
                  >
                    <DmText
                      className="font-custom700"
                      style={{
                        fontSize: 17,
                        lineHeight: 21,
                        color: isCurrent ? "#1A1A1A" : "#6A6A6A",
                      }}
                    >
                      {`${offer.ratePerHour} `}
                    </DmText>
                    <DmText
                      className="font-custom400"
                      style={{ fontSize: 11, lineHeight: 16, color: "#8C8C8C" }}
                    >
                      {t("EGP")}
                    </DmText>
                    {isCurrent && (
                      <DmView
                        className="ml-[6] rounded-8 px-[6] py-[1]"
                        style={{ backgroundColor: "#E1F5EE" }}
                      >
                        <DmText
                          className="font-custom600"
                          style={{
                            fontSize: 9.5,
                            lineHeight: 13,
                            letterSpacing: 0.5,
                            color: "#0F6E56",
                          }}
                        >
                          {t("current").toUpperCase()}
                        </DmText>
                      </DmView>
                    )}
                  </DmView>
                  <DmText
                    className="mt-[2] font-custom400"
                    style={{
                      fontSize: 11,
                      lineHeight: 14,
                      color: "#8C8C8C",
                      textAlign: "left",
                    }}
                  >
                    {moment(offer.createdAt).format("DD/MM · h:mm A")}
                  </DmText>
                </DmView>
                {delta != null && delta !== 0 ? (
                  <DmView
                    className="rounded-10 px-[8] py-[2]"
                    style={{ backgroundColor: "#E1F5EE" }}
                  >
                    <DmText
                      className="font-custom400"
                      style={{ fontSize: 11, lineHeight: 15, color: "#0F6E56" }}
                    >
                      {`${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${t("EGP")}`}
                    </DmText>
                  </DmView>
                ) : isFirst ? (
                  <DmText
                    className="font-custom400"
                    style={{ fontSize: 10.5, lineHeight: 14, color: "#B3B3B3" }}
                  >
                    {t("first_offer")}
                  </DmText>
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
