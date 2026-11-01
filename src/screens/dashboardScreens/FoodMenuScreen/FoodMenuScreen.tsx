import React, { useCallback, useEffect, useMemo } from "react"
import Animated from "react-native-reanimated"

// Components
import { DmView } from "@tappler/shared/src/components/UI"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import MenuSectionPills, {
  useSectionScrollSpy,
} from "@tappler/shared/src/components/MenuSectionPills"
import MenuStoreHeader from "@tappler/shared/src/components/MenuStoreHeader"
import FoodMenuItemRow from "components/FoodMenuItemRow"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { useGetProMenuQuery, useGetProProfileQuery } from "services/api"
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
import styles from "./styles"
import { Text, a as atoms } from "@tappler/shared/src/ds"

type Props = RootStackScreenProps<"FoodMenuScreen">


// The customer-side twin of proapp's FoodMenuStoreScreen preview: same
// header, section pills + item rows, but taps go to FoodItemScreen (real
// add-to-cart) and a View Basket bar rides the bottom once the cart has lines.
//
// #523 pass 2: the kitchen's collapsing header (shared MenuStoreHeader) sits
// over the list: the pro's profile photo as the cover, the kitchen's name,
// rating and delivery terms, folding into a compact bar as the menu scrolls,
// with the pills (shared with proapp) stuck under it. The pills follow the
// section in view and scroll the list to the one tapped, or to the one picked
// from their sections sheet. Both read `sections`, so a section with no items
// is in neither. The menu has no photo of its own, so the cover and rating
// come from the pro's profile (the same query ProProfileScreen reads, so it
// is usually cached); the name, the delivery terms and the menu draw first.
const FoodMenuScreen: React.FC<Props> = ({ route, navigation }) => {
  const { proId, serviceCategoryId, serviceId, proName, categoryName, fulfillmentMode = "delivery" } =
    route.params

  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const { data: menu, isLoading, isError } = useGetProMenuQuery({
    proId,
    serviceCategoryId,
  })
  const { data: pro } = useGetProProfileQuery({ proId, serviceCategoryId })

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

  const {
    activeIndex,
    select,
    scrollRef,
    scrollProps,
    sectionLayout,
    scrollY,
    header,
    onHeaderLayout,
  } = useSectionScrollSpy(sections.length)

  // The header: the card's name, else the kitchen's approved name, else
  // the generic title; the profile's photo and rating once it has loaded.
  const kitchenName =
    proName ||
    pro?.serviceScreenName ||
    (pro?.proType === "company" ? pro?.businessName : pro?.registeredName) ||
    t("food_menu")
  const rating = useMemo(
    () =>
      pro
        ? {
            rate: pro.reviewScore?.overallScore || 0,
            reviewsCount: pro.reviewScore?.reviewsCount || 0,
          }
        : null,
    [pro]
  )
  const fulfilment = useMemo(
    () =>
      menu
        ? {
            delivery: !!menu.isDeliveryEnabled,
            pickup: !!menu.isPickupEnabled,
            deliveryFee: menu.deliveryCharge,
            freeDeliveryOver: menu.freeDeliveryThreshold,
          }
        : null,
    [menu]
  )
  const goBack = useCallback(() => navigation.goBack(), [navigation])

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

  const renderSection = (item: FoodMenuSectionType, index: number) => {
    return (
      <DmView
        key={item.id}
        style={styles.container}
        onLayout={sectionLayout(index)}
      >
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

  const top = header?.height ?? 0
  const hasMenu = !isLoading && !isError && sections.length > 0

  // Its own element, so a cart change doesn't re-render the header.
  const pills = useMemo(
    () =>
      hasMenu ? (
        <MenuSectionPills
          titles={sectionTitles}
          activeIndex={activeIndex}
          onSelect={select}
        />
      ) : null,
    [hasMenu, sectionTitles, activeIndex, select]
  )

  return (
    <DmView style={[atoms.flex_1, styles.safeArea]}>
      {/* Reanimated's, so the header can read its offset on the UI thread
          (useSectionScrollSpy's scrollY). A member expression is invisible
          to components/scroll's guard, so it carries the wrapper's prop.
          Mounted in every state, so the header's offset always has a list
          to follow; loading and "unavailable" fill it under the header. */}
      <Animated.ScrollView
        ref={scrollRef}
        {...scrollProps}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: top + (hasMenu ? styles.listContent.paddingTop : 0),
            paddingBottom: 60 + insets.bottom + (basketVisible ? 70 : 0),
          },
        ]}
      >
        {isLoading ? (
          <DmView style={atoms.flex_1}>
            <LoadingOverlay />
          </DmView>
        ) : !hasMenu ? (
          <DmView
            style={[
              atoms.flex_1,
              atoms.items_center,
              atoms.justify_center,
              atoms.px_40,
            ]}
          >
            <Text size={16} weight="semibold" leading="legacy" color="tertiary" align="center">
              {t("menu_unavailable")}
            </Text>
          </DmView>
        ) : (
          sections.map(renderSection)
        )}
      </Animated.ScrollView>

      <MenuStoreHeader
        scrollY={scrollY}
        title={kitchenName}
        // undefined while the profile loads (a plain cover), null for none.
        photo={pro ? pro.profilePhoto || null : undefined}
        rating={rating}
        fulfilment={fulfilment}
        onBack={goBack}
        onLayoutChange={onHeaderLayout}
      >
        {pills}
      </MenuStoreHeader>

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
    </DmView>
  )
}

export default FoodMenuScreen
