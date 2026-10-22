import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"
import CachedImage from "@tappler/shared/src/components/CachedImage"

import styles from "./styles"
import {
  effectiveUnitPrice,
  formatMoney,
  hasDiscount,
} from "store/cart/slice"
import { FoodMenuItemType } from "types/food"
import { useTranslation } from "react-i18next"
import colors from "@tappler/shared/src/styles/colors"
import PlusIcon from "assets/icons/plus.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"
import { Text, Button, a, px } from "@tappler/shared/src/ds"

interface Props {
  item: FoodMenuItemType
  onPress?: (item: FoodMenuItemType) => void
  // Total quantity of this menu item across cart lines — drives the image
  // overlay: 0 → the proapp "+" badge, >0 → the [trash | qty | +] strip
  cartQty?: number
  onQuickAdd?: (item: FoodMenuItemType) => void
  onQuickRemove?: (item: FoodMenuItemType) => void
}

// Customer variant of proapp's FoodMenuSectionMenuItem: same row layout and
// image badges; out-of-stock dims via opacity (no color-matrix dep here) and
// the pro-side stock/rejection affordances are dropped.
const FoodMenuItemRow: React.FC<Props> = ({
  item,
  onPress,
  cartQty = 0,
  onQuickAdd,
  onQuickRemove,
}) => {
  const { t } = useTranslation()
  const outOfStock = item.inStock === false
  const hasPrice = Number(item.price) > 0

  return (
    <DmView
      style={[a.px_16, a.pt_20, styles.container]}
      onPress={onPress && !outOfStock ? () => onPress(item) : undefined}
    >
      <DmView
        style={[a.flex_row, a.justify_between, outOfStock ? styles.outOfStock : undefined]}
      >
        <DmView style={[a.flex_1, a.justify_between]}>
          <DmView>
            <Text size={14} weight="semibold">
              {item.name}
            </Text>
            <Text
              size={13}
              leading={px(15)}
              style={styles.text}
              numberOfLines={4}
            >
              {item.description}
            </Text>
          </DmView>
          <DmView style={[styles.row, a.flex_row, a.items_center]}>
            {hasPrice ? (
              <>
                <Text size={13} weight="semibold" leading="tight">
                  {formatMoney(effectiveUnitPrice(item))} {t("EGP")}
                </Text>
                {hasDiscount(item) && (
                  <Text size={13} leading="tight" color="secondary" style={[a.ml_10, styles.eGP]}>
                    {formatMoney(Number(item.price))} {t("EGP")}
                  </Text>
                )}
              </>
            ) : (
              <Text size={14} weight="semibold" color="secondary">
                {t("price_on_selection")}
              </Text>
            )}
            <DmView style={[a.flex_1, a.items_end]}>
              {item.isPreOrderOnly && (
                <Button
                  title={t("pre_order")}
                  size={px(20)}
                  shape="r4"
                  paddingX={8}
                  variant="rose"
                  label={11}
                  labelWeight="bold"
                  labelInset={0}
                  style={styles.button}
                />
              )}
            </DmView>
          </DmView>
        </DmView>
        <DmView style={[styles.box, a.items_center, a.justify_end, styles.img]}>
          <CachedImage
            uri={item.photo || undefined}
            style={styles.img}
            resizeMode="cover"
            withSkeleton
          />
          {!outOfStock && (
            <DmView style={[a.absolute, styles.box2, a.items_center]}>
              {cartQty > 0 ? (
                <DmView
                  style={[a.flex_row, a.items_center, styles.row2, a.px_8, styles.badgeShadow]}
                >
                  <DmView
                    style={[styles.iconWrap, a.items_center, a.justify_center]}
                    onPress={() => onQuickRemove?.(item)}
                  >
                    <TrashRedIcon width={15} height={15} />
                  </DmView>
                  <Text size={14} weight="bold" leading="tight" style={a.mx_12}>
                    {cartQty}
                  </Text>
                  <DmView
                    style={[styles.iconWrap, a.items_center, a.justify_center]}
                    onPress={() => onQuickAdd?.(item)}
                  >
                    <PlusIcon
                      color={colors.grey13}
                      width={17}
                      height={17}
                      strokeWidth={2.5}
                    />
                  </DmView>
                </DmView>
              ) : (
                <DmView
                  style={[a.items_center, a.justify_center, styles.iconWrap2, styles.badgeShadow]}
                  onPress={() => onQuickAdd?.(item)}
                >
                  <PlusIcon
                    color={colors.black}
                    width={18}
                    height={18}
                    strokeWidth={2.5}
                  />
                </DmView>
              )}
            </DmView>
          )}
        </DmView>
      </DmView>
      {outOfStock && (
        <Text size={14} weight="semibold" color="brand" style={a.mt_12}>
          {t("out_of_stock")}
        </Text>
      )}
    </DmView>
  )
}

export default React.memo(FoodMenuItemRow)
