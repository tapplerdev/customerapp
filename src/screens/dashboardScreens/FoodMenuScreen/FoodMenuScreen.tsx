import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"

// Components
import { DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import type { FlatList } from "react-native"
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
  useSharedValue,
} from "react-native-reanimated"
import { Dimensions } from "react-native"
import colors from "@tappler/shared/src/styles/colors"
import styles from "./styles"
import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { AppFlatList } from "components/scroll"
import { Text, a as atoms } from "@tappler/shared/src/ds"

type Props = RootStackScreenProps<"FoodMenuScreen">


// The customer-side twin of proapp's FoodMenuStoreScreen preview: same
// section tabs + item rows, but taps go to FoodItemScreen (real add-to-cart)
// and a View Basket bar rides the bottom once the cart has lines.
const FoodMenuScreen: React.FC<Props> = ({ route, navigation }) => {
  const { proId, serviceCategoryId, serviceId, proName, categoryName, fulfillmentMode = "delivery" } =
    route.params

  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)
  const [, setSelectedSectionIndex] = useState(0)

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

  // The underline lives in AnimatedSelectCategory now. It used to be drawn
  // here from SCREEN_WIDTH / sections.length, which only works while every tab
  // is the same width — and tabs are sized to their labels now so they are not.
  const handlePressTab = (idx: number) => {
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
        fulfillmentMode,
      })
    },
    [navigation, proId, serviceCategoryId, serviceId, proName, categoryName, fulfillmentMode]
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
            leadTimeHours: item.leadTimeHours,
          },
        })
      )
    },
    [dispatch, handlePressItem, proId, serviceCategoryId, serviceId, proName, categoryName, fulfillmentMode]
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
      <DmView style={styles.container}>
        <Text size={20} weight="semibold" leading="tight" style={[atoms.mb_20, atoms.px_14]}>
          {item.title}
        </Text>
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
    <SafeAreaView style={[atoms.flex_1, styles.safeArea]} edges={["top"]}>
      {/* Header */}
      <DmView style={[atoms.flex_row, atoms.items_center, atoms.px_12, atoms.py_10, styles.row]}>
        <DmView
          style={[styles.iconWrap, atoms.items_center, atoms.justify_center]}
          hitSlop={HIT_SLOP_DEFAULT}
          onPress={() => navigation.goBack()}
        >
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[atoms.flex_1, atoms.items_center]}>
          <Text size={16} weight="bold">
            {t("food_menu")}
          </Text>
          {!!proName && (
            <Text size={12} leading="tight" color="secondary" style={atoms.mt_2}>
              {proName}
            </Text>
          )}
        </DmView>
        <DmView style={styles.box} />
      </DmView>

      {isLoading ? (
        <LoadingOverlay />
      ) : isError || !sections.length ? (
        <DmView style={[atoms.flex_1, atoms.items_center, atoms.justify_center, atoms.px_40]}>
          <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
            {t("menu_unavailable")}
          </Text>
        </DmView>
      ) : (
        <DmView style={atoms.flex_1}>
          <DmView style={styles.tabsWrapper}>
            <AnimatedSelectCategory
              categories={sectionTitles}
              setSelectedCategory={handlePressTab}
              textType={{ size: 13, leading: "tight", weight: "medium" }}
            />
          </DmView>
          <AppFlatList
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
          style={[atoms.absolute, styles.boxWrap, atoms.px_16, atoms.pt_14, styles.basketShadow, { paddingBottom: insets.bottom + 12 }]}
        >
          <DmView
            style={[styles.box2, atoms.justify_center, atoms.px_12]}
            onPress={() => navigation.navigate("FoodCartScreen", { proId })}
          >
            {/* Centred across the WHOLE bar, not the gap between the badge and
                the total — those two differ in width, so centring in the
                leftover space put the label visibly off-centre. */}
            <Text
              style={styles.basketLabel}
              size={14}
              weight="semibold"
              color="inverse"
              align="center"
            >
              {t("view_basket")}
            </Text>

            <DmView style={[atoms.flex_row, atoms.items_center, atoms.justify_between]}>
              <DmView style={[styles.textWrap, atoms.items_center, atoms.justify_center]}>
                <Text size={14} weight="semibold">
                  {basketCount}
                </Text>
              </DmView>

              <Text size={14} weight="semibold" color="inverse">
                {formatMoney(basketTotal)} {t("EGP")}
              </Text>
            </DmView>
          </DmView>
        </DmView>
      )}
    </SafeAreaView>
  )
}

export default FoodMenuScreen
