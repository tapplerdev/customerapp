import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Animated,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
} from "react-native"
import NativeSheet from "@tappler/shared/src/components/NativeSheet/NativeSheet"
import { useFullSheetHeight } from "@tappler/shared/src/components/NativeSheet/useFullSheetHeight"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { AddressInfo } from "navigation/types"
import { useGetServicesQuery } from "services/api"
import { ServiceCategoryType } from "types/cms"

import SearchIcon from "assets/icons/search-black.svg"
import LocationRedIcon from "assets/icons/location-red.svg"
import CloseIcon from "assets/icons/close.svg"
import SkeletonLoader from "components/SkeletonLoader/SkeletonLoader"
import { AppFlatList } from "components/scroll"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

type FlatCategory = ServiceCategoryType & {
  serviceName: string
  serviceNameAr: string
  parentServiceId: number
}

interface SearchLocationModalProps {
  isVisible: boolean
  currentCategoryName: string
  currentAddress?: AddressInfo
  onSelectService: (categoryId: number, categoryName: string, serviceId: number) => void
  onChangeLocation: () => void
  onClose: () => void
}

const SearchLocationModal: React.FC<SearchLocationModalProps> = ({
  isVisible,
  currentCategoryName,
  currentAddress,
  onSelectService,
  onChangeLocation,
  onClose,
}) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const inputRef = useRef<TextInput>(null)


  const [searchText, setSearchText] = useState(currentCategoryName)
  const [debouncedSearch, setDebouncedSearch] = useState(currentCategoryName)

  /*
   * How much of the list the keyboard is covering.
   *
   * The results list has to reserve this much at its bottom or its last rows
   * are unreachable: on iOS the sheet is presented at a FIXED height and cannot
   * shrink for the keyboard — there is no IME term in
   * frameOfPresentedViewInContainerView — so the keys sit on top of the list
   * and scrolling stops at the last row, which is behind them. Insetting is the
   * only available fix here, and the right one anyway: the search field is at
   * the top of the sheet, so nothing needs to move, only make room.
   *
   * ANDROID does not use this — see where it is applied. Its sheet lives in a
   * dialog window that genuinely resizes under the keyboard, so the room is
   * already made and padding again would overshoot by a whole keyboard.
   *
   * will* on iOS so the inset lands with the keyboard's own animation rather
   * than a frame behind it; Android only emits did*. Same split as
   * MessagesDetailsScreen's composer.
   */
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"

    const showSub = Keyboard.addListener(showEvent, (e) => {
      // The FULL keyboard height, with nothing subtracted for the safe area.
      // The keyboard's frame is measured from the physical bottom of the
      // screen, and this list runs all the way down to it — nothing below or
      // around the list pads insets.bottom. Netting off the inset here would
      // leave the last row ~34pt behind the keys, which is the same bug in
      // miniature.
      setKeyboardInset(e.endCoordinates.height)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardInset(0))

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  const { data: servicesData, isFetching } = useGetServicesQuery()

  useEffect(() => {
    if (isVisible) {
      setSearchText(currentCategoryName)
      setDebouncedSearch(currentCategoryName)
      setTimeout(() => inputRef.current?.focus(), 400)
    }
  }, [isVisible, currentCategoryName])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300)
    return () => clearTimeout(timer)
  }, [searchText])

  // Flatten all categories into searchable list
  const allCategories = useMemo<FlatCategory[]>(() => {
    if (!servicesData?.data) return []
    return servicesData.data.flatMap((service) =>
      (service.categories || []).map((cat) => ({
        ...cat,
        serviceName: service.nameEn,
        serviceNameAr: service.nameAr,
        parentServiceId: service.id,
      }))
    )
  }, [servicesData])

  // Filter by search text — includes the CMS `keywords` field so e.g. "carpet"
  // matches categories whose names don't contain it (same behavior as proapp).
  const filteredCategories = useMemo(() => {
    if (!debouncedSearch.trim()) return allCategories
    const query = debouncedSearch.toLowerCase()
    return allCategories.filter(
      (c) =>
        c.nameEn.toLowerCase().includes(query) ||
        c.nameAr.includes(query) ||
        c.serviceName.toLowerCase().includes(query) ||
        c.serviceNameAr.includes(query) ||
        (c.keywords || "").toLowerCase().includes(query)
    )
  }, [allCategories, debouncedSearch])

  // Fade the results in whenever the (debounced) query settles or data arrives —
  // proapp's search transition mechanic (300ms opacity).
  const listFade = useRef(new Animated.Value(0)).current
  const hasData = allCategories.length > 0
  useEffect(() => {
    listFade.setValue(0)
    Animated.timing(listFade, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start()
  }, [debouncedSearch, hasData])

  const handleSelectCategory = (cat: FlatCategory) => {
    const name = isAr ? cat.nameAr : cat.nameEn
    onSelectService(cat.id, name, cat.parentServiceId)
    onClose()
  }

  const handleLocationPress = () => {
    onClose()
    onChangeLocation()
  }

  const handleClose = () => {
    onClose()
  }

  const handleDismiss = useCallback(() => {
    onClose()
  }, [onClose])

  const addressParts = [currentAddress?.address, currentAddress?.city || currentAddress?.governorate].filter(Boolean)
  const locationDisplay = addressParts.join(" • ") || ""

  const renderItem = ({ item }: { item: FlatCategory }) => {
    const name = isAr ? item.nameAr : item.nameEn
    const parentName = isAr ? item.serviceNameAr : item.serviceName
    return (
      <>
        <DmView
          onPress={() => handleSelectCategory(item)}
          style={[a.px_24, a.py_14]}
        >
          <Text size={14} weight="medium">
            {name}
          </Text>
          <Text size={11} leading="tight" color="tertiary" style={a.mt_2}>
            {parentName}
          </Text>
        </DmView>
        <DmView style={[a.ml_24, styles.box]} />
      </>
    )
  }

  // 92% of the screen was what the gorhom snapPoint asked for; useFullSheetHeight
  // is the same intent expressed off the safe area, so the top edge lands below
  // the status bar on every device instead of at a fixed fraction.
  //
  // No pushBackScale override: this is a NEAR-FULL sheet, and the native 0.92
  // default is what that size was tuned for. BOTTOM_SHEET_PUSH_BACK_SCALE is
  // for the short ones.
  const fullSheetHeight = useFullSheetHeight()

  const content = (
    <DmView
      style={[a.flex_1, styles.list, { borderTopLeftRadius: 10, borderTopRightRadius: 10, overflow: "hidden" }]}
    >
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.justify_between, a.px_20, a.pt_16, a.pb_12]}>
        <DmView onPress={handleClose} hitSlop={HIT_SLOP_DEFAULT}>
          <Text size={14} weight="medium" color="brand">
            {t("cancel")}
          </Text>
        </DmView>
        <DmView onPress={handleClose} hitSlop={HIT_SLOP_DEFAULT}>
          <Text size={14} weight="semibold" color="brand">
            {t("search")}
          </Text>
        </DmView>
      </DmView>

      {/* Search inputs container — separated from the list below; see
          modalStyles.inputsContainer for why that is per-platform. */}
      <DmView style={[a.pb_12, styles.list, modalStyles.inputsContainer]}>
        {/* Service search input */}
        <DmView style={[a.mx_20, a.mb_8, a.flex_row, a.items_center, styles.row, a.px_14, modalStyles.inputBorder]}>
          <SearchIcon width={16} height={16} />
          <TextInput
            ref={inputRef}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t("search_for_service")}
            placeholderTextColor={colors.grey3}
            selectTextOnFocus
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: colors.black,
              textAlign: isAr ? "right" : "left",
            }}
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <DmView onPress={() => setSearchText("")} hitSlop={HIT_SLOP_DEFAULT}>
              <CloseIcon width={12} height={12} color={colors.grey3} />
            </DmView>
          )}
        </DmView>

        {/* Location field */}
        <DmView
          onPress={handleLocationPress}
          style={[a.mx_20, a.flex_row, a.items_center, styles.row2, a.px_14, modalStyles.inputBorder]}
        >
          <LocationRedIcon width={16} height={16} />
          <Text size={13} leading="tight" style={[a.ml_8, a.flex_1]} numberOfLines={1}>
            {locationDisplay}
          </Text>
        </DmView>
      </DmView>

      {/* Results — skeleton shimmer while the services payload first loads,
          then results fade in (mirrors proapp's search) */}
      {isFetching && !hasData ? (
        <DmView>
          {[64, 46, 72, 55, 38, 60].map((w, i) => (
            <DmView key={i} style={[a.px_24, a.py_14, styles.container]}>
              <SkeletonLoader width={`${w}%`} height={15} borderRadius={4} />
              <DmView style={a.mt_6}>
                <SkeletonLoader width={`${Math.max(24, w - 25)}%`} height={11} borderRadius={4} />
              </DmView>
            </DmView>
          ))}
        </DmView>
      ) : (
        <Animated.View style={{ flex: 1, opacity: listFade }}>
          <AppFlatList
            data={filteredCategories}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            // First tap SELECTS a result instead of just closing the keyboard.
            // Load-bearing: without it every choice costs two taps.
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            /*
             * Room for the keyboard, iOS ONLY, and the asymmetry is the point.
             *
             * iOS pins the sheet to the container's bottom edge with no IME term
             * (frameOfPresentedViewInContainerView), so nothing moves when the
             * keyboard opens and the list has to pad itself. Android's sheet lives
             * in a dialog window with SOFT_INPUT_ADJUST_RESIZE, which genuinely
             * shrinks — measured on a device 2026-09-14, the sheet went 2274px to
             * 1454px — and onSheetLayout relays the content at the smaller size. So
             * the room is already made there, and padding again would leave the last
             * row a full keyboard-height above the keys.
             */
            contentContainerStyle={{
              paddingBottom: Platform.OS === "ios" ? keyboardInset : 0,
            }}
            // Drag the list and the keyboard follows your finger (iOS). Android
            // has no interactive mode, so it gets the snap-away version.
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
          />
        </Animated.View>
      )}
    </DmView>
  )

  /*
   * One presentation, both platforms — the native sheet.
   *
   * Android used to fork onto react-native-modal here, and the comment defending
   * it said the search field "needs the window to resize under the IME, and this
   * is the presentation that does that without argument". That turned out to be
   * false: the native sheet's dialog window carries SOFT_INPUT_ADJUST_RESIZE and
   * was measured shrinking 2274px -> 1454px with a docked keyboard. So the fork
   * bought nothing and cost a bug the other sheets could not have — its container
   * covers the status bar but stops at the navigation bar, which made every
   * height-based attempt to position the panel wrong by a different amount on
   * every device, and the Cancel / Search row drew under the clock.
   *
   * Gone with it: statusBarTranslucent, avoidKeyboard, the hand-rolled
   * backdropOpacity, the swipe-to-dismiss wiring and the manual top inset. The
   * native sheet does the drag, the dim and the top offset itself.
   */
  return (
    <NativeSheet
      visible={isVisible}
      height={fullSheetHeight}
      onDismissed={handleDismiss}
    >
      {content}
    </NativeSheet>
  )
}

const modalStyles = StyleSheet.create({
  /**
   * Separation under the two search fields — a DOWNWARD shadow on iOS, a hairline
   * rule on Android, and the split is not cosmetic fussing.
   *
   * `elevation` is Android's only shadow control and it ignores `shadowOffset`
   * entirely, casting on all four sides. On a container sitting directly under the
   * Cancel / Search row, the top of that cast reads as a stray grey line across
   * the header — visible on Android and not on iOS, which honours the offset and
   * draws below only. The comment on this style used to just say "bottom shadow",
   * which is what it does on exactly one of the two platforms.
   *
   * 0.7 / grey19 is the divider the rest of the app uses (see ProsListingScreen's
   * header rule), so Android gets the same separation with nothing above it.
   */
  inputsContainer: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
    },
    default: {
      borderBottomWidth: 0.7,
      borderBottomColor: colors.grey19,
    },
  }),
  inputBorder: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
})

export default SearchLocationModal
