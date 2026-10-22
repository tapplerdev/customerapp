import React from "react"
import { DimensionValue } from "react-native"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"

import StarIcon from "assets/icons/star.svg"

import styles from "./styles"
import { Text, a } from "@tappler/shared/src/ds"

interface Props {
  rate: number
  reviewsCount?: number
  itemSize?: number
  showFullReviewText?: boolean
}

const RateComponent: React.FC<Props> = ({
  rate,
  reviewsCount,
  itemSize = 12,
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
        style={[styles.container, { width: itemSize, height: itemSize }]}
      >
        <DmView
          style={[styles.iconWrap, a.h_full, { width: itemWidth as DimensionValue }]}
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
      <DmView style={[a.flex_row, a.items_center]}>
        <Text size={11} weight="medium" leading="tight" style={[styles.newOnTappler, styles.italic]}>
          {t("new_on_tappler")}
        </Text>
      </DmView>
    )
  }

  return (
    <DmView style={[a.flex_row, a.items_center]}>
      <DmView style={[a.flex_row, a.items_center]}>
        {[1, 2, 3, 4, 5].map((item) => (
          <DmView key={item}>{renderStar(item)}</DmView>
        ))}
      </DmView>
      {reviewsCount !== undefined ? (
        showFullReviewText ? (
          <>
            <Text size={13} weight="semibold" leading="tight" style={styles.text}>
              {`${rate % 1 === 0 ? rate : rate.toFixed(1)} ${t("of")} 5`}
            </Text>
            <Text size={13} weight="medium" leading="tight" style={styles.text}>
              {`(${reviewsCount} ${reviewsCount === 1 ? t("review_singular") : t("reviews")})`}
            </Text>
          </>
        ) : (
          <>
            <Text size={11} weight="medium" leading="tight" style={styles.text2}>
              {`${rate % 1 === 0 ? rate : rate.toFixed(1)} ${t("of")} 5`}
            </Text>
            <Text size={11} weight="medium" leading="tight" style={styles.text3}>
              ({reviewsCount})
            </Text>
          </>
        )
      ) : (
        <Text size={showFullReviewText ? 13 : 11} weight="medium" leading="tight" style={styles.text}>
          {rate % 1 === 0 ? rate : rate.toFixed(1)} {t("of")} 5
        </Text>
      )}
    </DmView>
  )
}

export default React.memo(RateComponent)
