import React, { useCallback, useMemo, useRef, useState } from "react"

// Components
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context"
import { FlatList, I18nManager } from "react-native"
import LoadingOverlay from "components/LoadingOverlay/LoadingOverlay"
import AnimatedSelectCategory from "components/AnimatedSelectCategory"
import FoodMenuItemRow from "components/FoodMenuItemRow"

// Hooks & Redux
import { useTranslation } from "react-i18next"
import { useGetProMenuQuery } from "services/api"
import { useTypedSelector } from "store"
import { cartCount, cartSubtotal } from "store/cart/slice"

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
  const { proId, serviceCategoryId, serviceId, proName, categoryName, address } =
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

  const cart = useTypedSelector((state) => state.cart)
  const basketVisible = cart.proId === proId && cart.items.length > 0
  const basketCount = cartCount(cart.items)
  const basketTotal = cartSubtotal(cart.items)

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
      })
    },
    [navigation, proId, serviceCategoryId, serviceId, proName, categoryName, address]
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
            />
          ))}
        </DmView>
      </DmView>
    )
  }

  const deliveryLine = useMemo(() => {
    if (!menu) return ""
    const parts: string[] = []
    parts.push(
      menu.deliveryCharge
        ? t("delivery_fee_egp", { fee: menu.deliveryCharge })
        : t("free_delivery")
    )
    if (menu.deliveryCharge && menu.freeDeliveryThreshold) {
      parts.push(t("free_over_egp", { amount: menu.freeDeliveryThreshold }))
    }
    return parts.join(" · ")
  }, [menu, t])

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
          {!!deliveryLine && (
            <DmView className="px-[16] py-[8] bg-grey36">
              <DmText className="text-12 leading-[16px] font-custom500 text-center">
                {deliveryLine}
              </DmText>
            </DmView>
          )}
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
            className="mt-[10]"
            onScrollToIndexFailed={() => {}}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: 60 + insets.bottom + (basketVisible ? 70 : 0),
            }}
          />
        </DmView>
      )}

      {/* View Basket bar */}
      {basketVisible && (
        <DmView
          className="absolute left-[16] right-[16]"
          style={{ bottom: insets.bottom + 16 }}
        >
          <DmView
            className="h-[48] rounded-12 bg-red flex-row items-center justify-between px-[16]"
            style={styles.basketShadow}
            onPress={() => navigation.navigate("FoodCartScreen")}
          >
            <DmView className="w-[24] h-[24] rounded-full bg-white items-center justify-center">
              <DmText className="text-13 leading-[16px] font-custom700 text-red">
                {basketCount}
              </DmText>
            </DmView>
            <DmText className="text-15 leading-[19px] font-custom700 text-white">
              {t("view_basket")}
            </DmText>
            <DmText className="text-14 leading-[18px] font-custom600 text-white">
              {basketTotal.toFixed(2)} {t("EGP")}
            </DmText>
          </DmView>
        </DmView>
      )}
    </SafeAreaView>
  )
}

export default FoodMenuScreen
