import React from "react"
import { DimensionValue } from "react-native"
import { useTranslation } from "react-i18next"

import { DmText, DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

import StarIcon from "assets/icons/star.svg"

import styles from "./styles"

interface Props {
  rate: number
  reviewsCount?: number
  itemSize?: number
  className?: string
  showFullReviewText?: boolean
}

const RateComponent: React.FC<Props> = ({
  rate,
  reviewsCount,
  itemSize = 12,
  className,
  showFullReviewText = false,
}) => {
  const { t } = useTranslation()

  const renderStar = (item: number) => {
    const itemWidth =
      Number(rate).toFixed(1) === item.toFixed(1)
        ? "100%"
        : Number(rate).toFixed(1) > item.toFixed(1)
          ? "100%"
          : Number(rate.toFixed(1).toString()[0]) === item - 1
            ? Number(
                rate.toFixed(1).toString()[
                  rate.toFixed(1).toString().length - 1
                ]
              ) *
                10 +
              "%"
            : "0%"

    return (
      <DmView
        className="bg-grey14 mr-[5]"
        style={{ width: itemSize, height: itemSize }}
      >
        <DmView
          className="bg-red6 h-full"
          style={{ width: itemWidth as DimensionValue }}
        >
          <StarIcon
            width={itemSize}
            height={itemSize}
            fill={colors.white}
            strokeWidth={0}
          />
        </DmView>
      </DmView>
    )
  }

  if (!rate && reviewsCount !== undefined && reviewsCount === 0 && !showFullReviewText) {
    return (
      <DmView className={`flex-row items-center ${className || ""}`}>
        <DmText className="text-11 leading-[14px] font-custom500 text-grey" style={styles.italic}>
          {t("new_on_tappler")}
        </DmText>
      </DmView>
    )
  }

  return (
    <DmView className={`flex-row items-center ${className || ""}`}>
      <DmView className="flex-row items-center">
        {[1, 2, 3, 4, 5].map((item) => (
          <DmView key={item}>{renderStar(item)}</DmView>
        ))}
      </DmView>
      {reviewsCount !== undefined ? (
        showFullReviewText ? (
          <>
            <DmText className="ml-[5] text-13 leading-[16px] font-custom600">
              {`${rate % 1 === 0 ? rate : rate.toFixed(1)} ${t("of")} 5`}
            </DmText>
            <DmText className="ml-[5] text-13 leading-[16px] font-custom500">
              {`(${reviewsCount} ${reviewsCount === 1 ? t("review_singular") : t("reviews")})`}
            </DmText>
          </>
        ) : (
          <>
            <DmText className="ml-[3] text-11 leading-[14px] font-custom500">
              {`${rate % 1 === 0 ? rate : rate.toFixed(1)} ${t("of")} 5`}
            </DmText>
            <DmText className="ml-[3] text-11 leading-[14px] font-custom500 text-grey">
              ({reviewsCount})
            </DmText>
          </>
        )
      ) : (
        <DmText className={`ml-[5] ${showFullReviewText ? "text-13 leading-[16px]" : "text-11 leading-[14px]"} font-custom500`}>
          {rate % 1 === 0 ? rate : rate.toFixed(1)} {t("of")} 5
        </DmText>
      )}
    </DmView>
  )
}

export default React.memo(RateComponent)
