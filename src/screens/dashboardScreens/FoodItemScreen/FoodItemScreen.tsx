import React, { useCallback, useMemo, useState } from "react"

// Components
import {
  ActionBtn,
  DmChecbox,
  DmText,
  DmView,
} from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { ScrollView } from "react-native"
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
import clsx from "clsx"
import styles from "./styles"
import colors from "@tappler/shared/src/styles/colors"
import CloseIcon from "assets/icons/close.svg"
import PlusIcon from "assets/icons/plus.svg"
import MinusIcon from "assets/icons/minus.svg"

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
      <DmView key={option.id ?? index} className="mt-[16.5]">
        <DmView className="flex-row items-center justify-between">
          <DmText className="text-14 leading-[18px] font-custom600">
            {option.name}
          </DmText>
          <DmView
            className={clsx(
              "py-[3] px-[15] rounded-14 bg-pink1",
              !option.isRequired && "bg-grey36"
            )}
          >
            <DmText
              className={clsx(
                "text-11 leading-[16px] font-custom400 text-red",
                !option.isRequired && "text-black"
              )}
            >
              {t(option.isRequired ? "required" : "optional")}
            </DmText>
          </DmView>
        </DmView>
        <DmText className="mt-[10] mb-[14] text-11 leading-[14px] font-custom400 text-grey2">
          {renderChoiceLimitText(option)}
        </DmText>
        {option.choices.map((choice, idx) => {
          const isChecked = selectedChoices.some((c) => c.name === choice.name)
          return (
            <DmView
              key={choice.id ?? idx}
              className={clsx(
                "mt-[14] flex-row items-center justify-between",
                idx === 0 && "mt-[0]"
              )}
            >
              <DmText className="flex-1 text-13 leading-[16px] font-custom400">
                {choice.name}
              </DmText>
              <DmView className="flex-row items-center">
                {!!Number(choice.price) && (
                  <>
                    {hasDiscount(choice) && (
                      <DmText className="mx-[10] text-13 leading-[16px] font-custom400 text-red">
                        + {formatMoney(effectiveUnitPrice(choice))} {t("EGP")}
                      </DmText>
                    )}
                    <DmText
                      className={clsx(
                        "text-13 leading-[16px] font-custom400",
                        hasDiscount(choice) && "line-through"
                      )}
                    >
                      + {choice.price} {t("EGP")}
                    </DmText>
                  </>
                )}
                <DmChecbox
                  className="ml-[10]"
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
      <SafeAreaView className="flex-1 bg-white">
        <LoadingOverlay />
      </SafeAreaView>
    )
  }

  if (!menuItem) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-[40]">
        <DmText className="text-16 font-custom600 text-grey3 text-center">
          {t("menu_unavailable")}
        </DmText>
        <ActionBtn
          title={t("back")}
          className="mt-[20] h-[41] px-[40]"
          onPress={() => navigation.goBack()}
        />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView
      className="flex-1 bg-white justify-between"
      edges={["bottom"]}
      style={{ paddingBottom: insets.bottom > 45 ? 0 : 45 - insets.bottom }}
    >
      <DmView
        className="absolute left-[18] w-[28] h-[28] rounded-full bg-white items-center justify-center"
        style={[styles.closeButton, { top: (insets.top || 35) + 10 }]}
        onPress={() => navigation.goBack()}
      >
        <CloseIcon fill={colors.red} />
      </DmView>
      <ScrollView
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
        <DmView className="px-[14]">
          <DmText className="text-18 leading-[22px] font-custom600 mt-[16]">
            {menuItem.name}
          </DmText>
          <DmView className="mt-[8] flex-row items-center">
            {Number(menuItem.price) > 0 ? (
              <>
                {hasDiscount(menuItem) && (
                  <DmText className="text-18 leading-[22px] font-custom500">
                    {formatMoney(effectiveUnitPrice(menuItem))} {t("EGP")}
                  </DmText>
                )}
                <DmText
                  className={clsx(
                    "text-18 leading-[22px] font-custom500",
                    hasDiscount(menuItem) &&
                      "ml-[17] text-grey2 font-custom400 line-through"
                  )}
                >
                  {menuItem.price} {t("EGP")}
                </DmText>
              </>
            ) : (
              <DmText className="text-18 leading-[22px] font-custom500 text-grey2">
                {t("price_on_selection")}
              </DmText>
            )}
          </DmView>
          {!!menuItem.description && (
            <DmText className="my-[8] text-13 leading-[20px] font-custom400">
              {menuItem.description}
            </DmText>
          )}
        </DmView>
        {menuItem.isPreOrderOnly && (
          <DmView className="flex-row items-center py-[9] px-[14] border-t-grey35 border-b-grey35 border-t-0.5 border-b-0.5">
            <ActionBtn
              title={
                menuItem.leadTimeHours
                  ? t("pre_order_with_notice", { hours: menuItem.leadTimeHours })
                  : t("pre_order")
              }
              className="h-[20] self-auto bg-red2 rounded-4 px-[8]"
              textClassName="text-11 leading-[14px] font-custom700 text-white"
            />
            <DmText className="flex-1 ml-[7] text-14 leading-[18px] font-custom600">
              {t("item_prepared_on_order_only")}
            </DmText>
          </DmView>
        )}
        <DmView className="px-[14]">
          {(menuItem.options || []).map(renderOption)}
        </DmView>
      </ScrollView>
      <DmView className="bg-white px-[28]" style={styles.footerShadow}>
        <DmView className="mt-[24] flex-row items-center justify-center">
          <DmView
            onPress={count > 1 ? () => setCount(count - 1) : undefined}
            className={clsx(
              "items-center justify-center w-[23] h-[23] border-1 rounded-full",
              count <= 1 && "opacity-40"
            )}
          >
            <MinusIcon />
          </DmView>
          <DmText className="px-[32] text-17 leading-[21px] font-custom700">
            {count}
          </DmText>
          <DmView
            onPress={count < 30 ? () => setCount(count + 1) : undefined}
            className="items-center justify-center w-[23] h-[23] border-1 border-red rounded-full"
          >
            <PlusIcon color={colors.red} />
          </DmView>
        </DmView>
        <ActionBtn
          disable={missingRequired}
          title={t("add_to_cart_for_egp_count", {
            price: formatMoney(totalPrice * count),
          })}
          className={clsx("mt-[23] h-[41]", missingRequired && "opacity-50")}
          textClassName="text-13 leading-[16px] font-custom600"
          onPress={missingRequired ? undefined : handleAddToCart}
        />
      </DmView>
    </SafeAreaView>
  )
}

export default FoodItemScreen
