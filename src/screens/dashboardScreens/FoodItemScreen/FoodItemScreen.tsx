import React, { useCallback, useMemo, useState } from "react"

// Components
import { DmChecbox, DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import CachedImage from "@tappler/shared/src/components/CachedImage"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useGetProMenuQuery } from "services/api"
import {
  addCartItem,
  effectiveUnitPrice,
  formatMoney,
  hasDiscount,
} from "store/cart/slice"

// Helpers & Types
import { RootStackScreenProps } from "navigation/types"
import {
  CartSelectedOptionType,
  FoodOptionChoiceType,
  FoodOptionType,
} from "types/food"

// Styles & Assets
import styles from "./styles"
import colors from "@tappler/shared/src/styles/colors"
import CloseIcon from "assets/icons/close.svg"
import PlusIcon from "assets/icons/plus.svg"
import MinusIcon from "assets/icons/minus.svg"
import { AppScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"

type Props = RootStackScreenProps<"FoodItemScreen">

const effectiveChoicePrice = (choice: FoodOptionChoiceType): number =>
  effectiveUnitPrice(choice)

// Ported from proapp's PreviewScreen (item detail: photo, option groups,
// qty stepper) — with the mock "add to cart" replaced by the real cart slice
// dispatch. The item is read from the getProMenu cache (ids-in-params rule),
// which is warm because FoodMenuScreen just queried it.
const FoodItemScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    menuItemId,
    proId,
    serviceCategoryId,
    serviceId,
    proName,
    categoryName,
    fulfillmentMode = "delivery",
  } = route.params

  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()

  const { data: menu, isLoading } = useGetProMenuQuery({
    proId,
    serviceCategoryId,
  })

  const menuItem = useMemo(() => {
    for (const section of menu?.menuSections || []) {
      const found = section.menuItems?.find((item) => item.id === menuItemId)
      if (found) return found
    }
    return undefined
  }, [menu, menuItemId])

  const [count, setCount] = useState(1)
  // optionName -> selected choices (kept by server names — the same values
  // submitted and validated against the menu at job creation)
  const [selected, setSelected] = useState<
    Record<string, FoodOptionChoiceType[]>
  >({})

  const basePrice = useMemo(() => {
    if (!menuItem) return 0
    return effectiveUnitPrice(menuItem)
  }, [menuItem])

  const optionsPrice = useMemo(() => {
    return Object.values(selected).reduce(
      (sum, choices) =>
        sum + choices.reduce((s, choice) => s + effectiveChoicePrice(choice), 0),
      0
    )
  }, [selected])

  const totalPrice = basePrice + optionsPrice

  const missingRequired = useMemo(() => {
    return (menuItem?.options || []).some((option) => {
      if (!option.isRequired) return false
      const min = Math.max(Number(option.minQty) || 0, 1)
      return (selected[option.name]?.length || 0) < min
    })
  }, [menuItem, selected])

  const handleToggleChoice = useCallback(
    (option: FoodOptionType, choice: FoodOptionChoiceType) => {
      setSelected((prev) => {
        const current = prev[option.name] || []
        const exists = current.some((c) => c.name === choice.name)
        const maxQty = Number(option.maxQty) || 1

        let next: FoodOptionChoiceType[]
        if (exists) {
          next = current.filter((c) => c.name !== choice.name)
        } else if (maxQty <= 1) {
          // single-choice group: radio behavior
          next = [choice]
        } else if (current.length >= maxQty) {
          // full: replace the oldest pick (matches proapp behavior)
          next = [...current.slice(1), choice]
        } else {
          next = [...current, choice]
        }
        return { ...prev, [option.name]: next }
      })
    },
    []
  )

  const handleAddToCart = () => {
    if (!menuItem) return
    const selectedOptions: CartSelectedOptionType[] = Object.entries(selected)
      .filter(([, choices]) => choices.length > 0)
      .map(([optionName, choices]) => ({
        optionName,
        choices: choices.map((choice) => ({
          name: choice.name,
          price: effectiveChoicePrice(choice),
          originalPrice: Number(choice.price) || 0,
        })),
      }))

    // Same item + same choice combination merges into one line
    const uid = `${menuItem.id}:${selectedOptions
      .map((o) => `${o.optionName}=${o.choices.map((c) => c.name).sort().join("+")}`)
      .sort()
      .join("|")}`

    dispatch(
      addCartItem({
        context: {
          proId,
          serviceCategoryId,
          serviceId,
          proName,
          categoryName,
          fulfillmentMode,
        },
        item: {
          uid,
          menuItemId: menuItem.id,
          name: menuItem.name,
          price: basePrice,
          originalPrice: Number(menuItem.price) || 0,
          quantity: count,
          selectedOptions: selectedOptions.length ? selectedOptions : undefined,
          photo: menuItem.photo,
          isPreOrderOnly: menuItem.isPreOrderOnly,
          leadTimeHours: menuItem.leadTimeHours,
        },
      })
    )
    navigation.goBack()
  }

  const renderChoiceLimitText = (option: FoodOptionType) => {
    const min = Number(option.minQty) || 0
    const max = Number(option.maxQty) || 1
    if (option.isRequired) {
      if (min !== max && min !== 0) {
        if (min === 1) return t("choose_up_to_number", { number: max })
        return t("choose_min_number_max_number1", { min, max })
      }
      return t("choose_number", { number: max })
    }
    if (max > 1) return t("choose_up_to_number", { number: max })
    return t("choose_number", { number: max })
  }

  const renderOption = (option: FoodOptionType, index: number) => {
    const selectedChoices = selected[option.name] || []
    return (
      <DmView key={option.id ?? index} style={styles.container}>
        <DmView style={[a.flex_row, a.items_center, a.justify_between]}>
          <Text size={14} weight="semibold">
            {option.name}
          </Text>
          <DmView
            style={[
              styles.textWrap,
              !option.isRequired && styles.textWrapNotRequired,
            ]}
          >
            <Text
              size={11}
              leading="loose"
              color={option.isRequired ? "brand" : "primary"}
            >
              {t(option.isRequired ? "required" : "optional")}
            </Text>
          </DmView>
        </DmView>
        <Text size={11} leading="tight" color="secondary" style={[a.mt_10, a.mb_14]}>
          {renderChoiceLimitText(option)}
        </Text>
        {option.choices.map((choice, idx) => {
          const isChecked = selectedChoices.some((c) => c.name === choice.name)
          return (
            <DmView
              key={choice.id ?? idx}
              style={[
                a.mt_14,
                a.flex_row,
                a.items_center,
                a.justify_between,
                idx === 0 && a.mt_0,
              ]}
            >
              <Text size={13} leading="tight" style={a.flex_1}>
                {choice.name}
              </Text>
              <DmView style={[a.flex_row, a.items_center]}>
                {!!Number(choice.price) && (
                  <>
                    {hasDiscount(choice) && (
                      <Text size={13} leading="tight" color="brand" style={a.mx_10}>
                        + {formatMoney(effectiveUnitPrice(choice))} {t("EGP")}
                      </Text>
                    )}
                    <Text
                      size={13}
                      leading="tight"
                      style={hasDiscount(choice) ? styles.eGPChoice : undefined}
                    >
                      + {choice.price} {t("EGP")}
                    </Text>
                  </>
                )}
                <DmChecbox
                  style={a.ml_10}
                  variant={Number(option.maxQty) > 1 ? "square" : "circle"}
                  isChecked={isChecked}
                  onPress={() => handleToggleChoice(option, choice)}
                />
              </DmView>
            </DmView>
          )
        })}
      </DmView>
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[a.flex_1, styles.safeArea]}>
        <LoadingOverlay />
      </SafeAreaView>
    )
  }

  if (!menuItem) {
    return (
      <SafeAreaView style={[a.flex_1, styles.safeArea, a.items_center, a.justify_center, a.px_40]}>
        <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
          {t("menu_unavailable")}
        </Text>
        <Button
          title={t("back")}
          size={px(41)}
          paddingX={40}
          style={a.mt_20}
          onPress={() => navigation.goBack()}
        />
      </SafeAreaView>
    )
  }

  // The struck price's three looks all hang on this, read once.
  const menuItemDiscounted = hasDiscount(menuItem)

  return (
    <SafeAreaView
      edges={["bottom"]}
      style={[a.flex_1, styles.safeArea, a.justify_between, { paddingBottom: insets.bottom > 45 ? 0 : 45 - insets.bottom }]}
    >
      <DmView
        style={[a.absolute, styles.iconWrap, a.items_center, a.justify_center, styles.closeButton, { top: (insets.top || 35) + 10 }]}
        onPress={() => navigation.goBack()}
      >
        <CloseIcon fill={colors.red} />
      </DmView>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 14 }}
      >
        <DmView style={styles.photo}>
          <CachedImage
            uri={menuItem.photo || undefined}
            style={styles.photoImage}
            resizeMode="cover"
            withSkeleton
          />
        </DmView>
        <DmView style={a.px_14}>
          <Text size={18} weight="semibold" leading="tight" style={a.mt_16}>
            {menuItem.name}
          </Text>
          <DmView style={[a.mt_8, a.flex_row, a.items_center]}>
            {Number(menuItem.price) > 0 ? (
              <>
                {hasDiscount(menuItem) && (
                  <Text size={18} weight="medium" leading="tight">
                    {formatMoney(effectiveUnitPrice(menuItem))} {t("EGP")}
                  </Text>
                )}
                <Text
                  size={18}
                  weight={menuItemDiscounted ? "regular" : "medium"}
                  leading="tight"
                  color={menuItemDiscounted ? "secondary" : undefined}
                  style={
                    menuItemDiscounted ? styles.eGPStruck : undefined
                  }
                >
                  {menuItem.price} {t("EGP")}
                </Text>
              </>
            ) : (
              <Text size={18} weight="medium" leading="tight" color="secondary">
                {t("price_on_selection")}
              </Text>
            )}
          </DmView>
          {!!menuItem.description && (
            <Text size={13} leading="loose" style={a.my_8}>
              {menuItem.description}
            </Text>
          )}
        </DmView>
        {menuItem.isPreOrderOnly && (
          <DmView style={[a.flex_row, a.items_center, styles.row, a.px_14]}>
            <Button
              title={t("pre_order")}
              size={px(20)}
              shape="r4"
              variant="rose"
              label={11}
              labelWeight="bold"
              style={styles.button}
            />
            <Text size={14} weight="semibold" style={[a.flex_1, styles.itemPreparedOnOrderOnly]}>
              {t("item_prepared_on_order_only")}
            </Text>
          </DmView>
        )}
        <DmView style={a.px_14}>
          {(menuItem.options || []).map(renderOption)}
        </DmView>
      </AppScrollView>
      <DmView style={[styles.safeArea, a.px_28, styles.footerShadow]}>
        <DmView style={[a.mt_24, a.flex_row, a.items_center, a.justify_center]}>
          <DmView
            onPress={count > 1 ? () => setCount(count - 1) : undefined}
            style={[
              a.items_center,
              a.justify_center,
              styles.iconWrap2,
              a.border_1,
              count <= 1 && styles.iconWrapCount,
            ]}
          >
            <MinusIcon />
          </DmView>
          <Text size={px(17)} weight="bold" leading={px(21)} style={a.px_32}>
            {count}
          </Text>
          <DmView
            onPress={count < 30 ? () => setCount(count + 1) : undefined}
            style={[
              a.items_center,
              a.justify_center,
              styles.iconWrap3,
              a.border_1,
            ]}
          >
            <PlusIcon color={colors.red} />
          </DmView>
        </DmView>
        <Button
          disabled={missingRequired}
          title={t("add_to_cart_for_egp_count", {
            price: formatMoney(totalPrice * count),
          })}
          size={px(41)}
          label="sm"
          labelWeight="semibold"
          dim={missingRequired ? true : undefined}
          style={styles.button2}
          onPress={missingRequired ? undefined : handleAddToCart}
        />
      </DmView>
    </SafeAreaView>
  )
}

export default FoodItemScreen
