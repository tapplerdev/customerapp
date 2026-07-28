import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

// Components
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { FlatList, I18nManager } from "react-native"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import AnimatedSelectCategory from "components/AnimatedSelectCategory"
import FoodMenuItemRow from "components/FoodMenuItemRow"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useGetProMenuQuery } from "services/api"
import { useTypedSelector } from "store"
import {
  addCartItem,
  cartCount,
  cartSubtotal,
  effectiveUnitPrice,
  formatMoney,
  selectDraft,
  setCartItemQuantity,
  sweepStaleCarts,
} from "store/cart/slice"

// Helpers & Types
import { RootStackScreenProps } from "navigation/types"
import { FoodMenuItemType, FoodMenuSectionType } from "types/food"

// Styles & Assets
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { Dimensions } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"

type Props = RootStackScreenProps<"FoodMenuScreen">

const SCREEN_WIDTH = Dimensions.get("window").width

// The customer-side twin of proapp's FoodMenuStoreScreen preview: same
// section tabs + item rows, but taps go to FoodItemScreen (real add-to-cart)
// and a View Basket bar rides the bottom once the cart has lines.
const FoodMenuScreen: React.FC<Props> = ({ route, navigation }) => {
  const { proId, serviceCategoryId, serviceId, proName, categoryName, address, fulfillmentMode = "delivery" } =
    route.params

  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)
  const [, setSelectedSectionIndex] = useState(0)
  const leftOffset = useSharedValue(0)

  const { data: menu, isLoading, isError } = useGetProMenuQuery({
    proId,
    serviceCategoryId,
  })

  const dispatch = useDispatch()
  const cart = useTypedSelector((state) => state.cart)

  // Drop abandoned drafts on entry (lazy TTL). Selectors below also filter
  // expired drafts at render time, so nothing stale can flash first.
  useEffect(() => {
    dispatch(sweepStaleCarts(Date.now()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // THIS pro's draft — drives the pill + thumbnail quantities. Other kitchens'
  // drafts stay untouched in the background (reachable by revisiting them).
  const draft = selectDraft(cart, proId, Date.now())

  const basketVisible = !!draft
  const basketCount = cartCount(draft?.items ?? [])
  const basketTotal = cartSubtotal(draft?.items ?? [])

  // Per-menu-item quantity across this draft's lines → thumbnail overlay
  const qtyByItemId = useMemo(() => {
    const map: Record<number, number> = {}
    for (const line of draft?.items ?? []) {
      map[line.menuItemId] = (map[line.menuItemId] || 0) + line.quantity
    }
    return map
  }, [draft])

  const sections = useMemo(() => {
    return (menu?.menuSections || [])
      .filter((section) => section.menuItems?.length > 0)
      .slice()
      .sort((a, b) => a.order - b.order)
  }, [menu?.menuSections])

  const sectionTitles = useMemo(
    () => sections.map((section) => section.title),
    [sections]
  )

  const itemWidth = useMemo(() => {
    return SCREEN_WIDTH / Math.max(sections.length, 3)
  }, [sections])

  const animatedLineStyle = useAnimatedStyle(() => {
    return {
      height: 2,
      backgroundColor: colors.red,
      width: itemWidth - 20,
      marginLeft: 10,
      transform: [
        {
          translateX: withTiming(leftOffset.value),
        },
      ],
    }
  }, [sections])

  const handlePressTab = (idx: number) => {
    leftOffset.value = idx * itemWidth * (I18nManager.isRTL ? -1 : 1)
    setSelectedSectionIndex(idx)
    flatListRef.current?.scrollToIndex({ index: idx, animated: true })
  }

  const handlePressItem = useCallback(
    (item: FoodMenuItemType) => {
      navigation.navigate("FoodItemScreen", {
        menuItemId: item.id,
        proId,
        serviceCategoryId,
        serviceId,
        proName,
        categoryName,
        address,
        fulfillmentMode,
      })
    },
    [navigation, proId, serviceCategoryId, serviceId, proName, categoryName, address, fulfillmentMode]
  )

  // Thumbnail "+": optionless items add straight to the cart (uid matches
  // the detail screen's no-options uid, so lines merge); items with option
  // groups need choices — open the detail instead.
  const handleQuickAdd = useCallback(
    (item: FoodMenuItemType) => {
      if (item.options?.length) {
        handlePressItem(item)
        return
      }
      dispatch(
        addCartItem({
          context: {
            proId,
            serviceCategoryId,
            serviceId,
            proName,
            categoryName,
            address: address ?? null,
            fulfillmentMode,
          },
          item: {
            uid: `${item.id}:`,
            menuItemId: item.id,
            name: item.name,
            price: effectiveUnitPrice(item),
            originalPrice: Number(item.price) || 0,
            quantity: 1,
            photo: item.photo,
            isPreOrderOnly: item.isPreOrderOnly,
          },
        })
      )
    },
    [dispatch, handlePressItem, proId, serviceCategoryId, serviceId, proName, categoryName, address, fulfillmentMode]
  )

  // Thumbnail trash/−: peel one off the LAST cart line of this item
  const handleQuickRemove = useCallback(
    (item: FoodMenuItemType) => {
      const lines = (draft?.items ?? []).filter(
        (line) => line.menuItemId === item.id
      )
      const last = lines[lines.length - 1]
      if (!last) return
      dispatch(
        setCartItemQuantity({
          proId,
          uid: last.uid,
          quantity: last.quantity - 1,
        })
      )
    },
    [dispatch, draft, proId]
  )

  const renderSection = ({ item }: { item: FoodMenuSectionType }) => {
    return (
      <DmView className="mb-[36.5]">
        <DmText className="mb-[20] px-[14] text-20 leading-[24px] font-custom600">
          {item.title}
        </DmText>
        <DmView>
          {item.menuItems.map((menuItem) => (
            <FoodMenuItemRow
              key={menuItem.id}
              item={menuItem}
              onPress={handlePressItem}
              cartQty={qtyByItemId[menuItem.id] || 0}
              onQuickAdd={handleQuickAdd}
              onQuickRemove={handleQuickRemove}
            />
          ))}
        </DmView>
      </DmView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <DmView className="flex-row items-center px-[12] py-[10] bg-white border-b-0.2 border-b-grey19">
        <DmView
          className="w-[32] h-[32] items-center justify-center"
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 leading-[20px] font-custom700">
            {t("food_menu")}
          </DmText>
          {!!proName && (
            <DmText className="mt-[2] text-12 leading-[15px] font-custom400 text-grey2">
              {proName}
            </DmText>
          )}
        </DmView>
        <DmView className="w-[32]" />
      </DmView>

      {isLoading ? (
        <LoadingOverlay />
      ) : isError || !sections.length ? (
        <DmView className="flex-1 items-center justify-center px-[40]">
          <DmText className="text-16 font-custom600 text-grey3 text-center">
            {t("menu_unavailable")}
          </DmText>
        </DmView>
      ) : (
        <DmView className="flex-1">
          <DmView style={styles.tabsWrapper}>
            <AnimatedSelectCategory
              categories={sectionTitles}
              setSelectedCategory={handlePressTab}
              textClassName="text-13 leading-[16px] font-custom500 text-center"
              showLines={false}
            />
            <DmView style={styles.tabsLine}>
              <Animated.View style={animatedLineStyle} />
            </DmView>
          </DmView>
          <FlatList
            ref={flatListRef}
            data={sections}
            renderItem={renderSection}
            keyExtractor={(section) => String(section.id)}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={() => {}}
            contentContainerStyle={{
              flexGrow: 1,
              paddingTop: 24,
              paddingBottom: 60 + insets.bottom + (basketVisible ? 70 : 0),
            }}
          />
        </DmView>
      )}

      {/* Pinned white footer with an upward shadow — the same shape as the
          Filters sheet's "Show results" bar, so the bottom of the app behaves
          consistently. The red bar is the button inside it. */}
      {basketVisible && (
        <DmView
          className="absolute left-0 right-0 bottom-0 px-[16] pt-[14] bg-white"
          style={[styles.basketShadow, { paddingBottom: insets.bottom + 12 }]}
        >
          <DmView
            className="h-[50] rounded-8 bg-red justify-center px-[12]"
            onPress={() => navigation.navigate("FoodCartScreen", { proId })}
          >
            {/* Centred across the WHOLE bar, not the gap between the badge and
                the total — those two differ in width, so centring in the
                leftover space put the label visibly off-centre. */}
            <DmText
              style={styles.basketLabel}
              className="text-center text-14 leading-[18px] font-custom600 text-white"
            >
              {t("view_basket")}
            </DmText>

            <DmView className="flex-row items-center justify-between">
              <DmView className="w-[30] h-[30] rounded-5 bg-white items-center justify-center">
                <DmText className="text-14 leading-[18px] font-custom600 text-black">
                  {basketCount}
                </DmText>
              </DmView>

              <DmText className="text-14 leading-[18px] font-custom600 text-white">
                {formatMoney(basketTotal)} {t("EGP")}
              </DmText>
            </DmView>
          </DmView>
        </DmView>
      )}
    </SafeAreaView>
  )
}

export default FoodMenuScreen
