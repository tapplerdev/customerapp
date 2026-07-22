import React from "react"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import CachedImage from "@tappler/shared/src/components/CachedImage"

import styles from "./styles"
import { FoodMenuItemType } from "types/food"
import { useTranslation } from "react-i18next"
import colors from "@tappler/shared/src/styles/colors"
import PlusIcon from "assets/icons/plus.svg"
import TrashRedIcon from "assets/icons/trash-red.svg"

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
      className="px-[16] pt-[20] pb-[23] border-b-0.5 border-b-grey14"
      onPress={onPress && !outOfStock ? () => onPress(item) : undefined}
    >
      <DmView
        className="flex-row justify-between"
        style={outOfStock ? styles.outOfStock : undefined}
      >
        <DmView className="flex-1 justify-between">
          <DmView>
            <DmText className="text-14 leading-[18px] font-custom600">
              {item.name}
            </DmText>
            <DmText
              className="mt-[5] text-13 leading-[15px] font-custom400"
              numberOfLines={4}
            >
              {item.description}
            </DmText>
          </DmView>
          <DmView className="mt-[13] flex-row items-center">
            {hasPrice ? (
              <>
                <DmText className="text-13 leading-[16px] font-custom600">
                  {item.discountPrice ? item.discountPrice : item.price}{" "}
                  {t("EGP")}
                </DmText>
                {!!item.discountPrice && (
                  <DmText className="ml-[10] text-13 leading-[16px] text-grey2 font-custom400 line-through">
                    {item.price} {t("EGP")}
                  </DmText>
                )}
              </>
            ) : (
              <DmText className="text-14 leading-[18px] font-custom600 text-grey2">
                {t("price_on_selection")}
              </DmText>
            )}
            <DmView className="flex-1 items-end">
              {item.isPreOrderOnly && (
                <ActionBtn
                  title={t("pre_order")}
                  className="h-[20] self-auto bg-red2 rounded-4 px-[8]"
                  classNameTextWrapper="mx-[0]"
                  textClassName="text-11 leading-[14px] font-custom700 text-white"
                />
              )}
            </DmView>
          </DmView>
        </DmView>
        <DmView
          className="ml-[21] overflow-hidden items-center justify-end"
          style={styles.img}
        >
          <CachedImage
            uri={item.photo || undefined}
            style={styles.img}
            resizeMode="cover"
            withSkeleton
          />
          {!outOfStock &&
            (cartQty > 0 ? (
              <DmView className="absolute bottom-[8] flex-row items-center bg-white rounded-3 px-[6] h-[26]">
                <DmView
                  className="w-[22] h-[26] items-center justify-center"
                  onPress={() => onQuickRemove?.(item)}
                >
                  <TrashRedIcon width={14} height={14} />
                </DmView>
                <DmText className="mx-[4] text-13 leading-[16px] font-custom700">
                  {cartQty}
                </DmText>
                <DmView
                  className="w-[22] h-[26] items-center justify-center"
                  onPress={() => onQuickAdd?.(item)}
                >
                  <PlusIcon
                    color={colors.red}
                    width={16}
                    height={16}
                    strokeWidth={2.5}
                  />
                </DmView>
              </DmView>
            ) : (
              <DmView
                className="absolute bottom-[8] items-center justify-center w-[30] h-[23] bg-white rounded-3"
                onPress={() => onQuickAdd?.(item)}
              >
                <PlusIcon
                  color={colors.black}
                  width={18}
                  height={18}
                  strokeWidth={2.5}
                />
              </DmView>
            ))}
        </DmView>
      </DmView>
      {outOfStock && (
        <DmText className="mt-[12] text-14 leading-[18px] font-custom600 text-red">
          {t("out_of_stock")}
        </DmText>
      )}
    </DmView>
  )
}

export default React.memo(FoodMenuItemRow)
