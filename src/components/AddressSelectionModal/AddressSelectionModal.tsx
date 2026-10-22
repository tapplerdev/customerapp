import React, { useCallback, useEffect, useRef } from "react"
import { Platform } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import NativeActionSheet from "components/NativeActionSheet/NativeActionSheet"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useTypedSelector } from "store"
import { useGetCustomerMeQuery } from "services/api"
import { CustomerSavedAddress } from "types/auth"

import LocationIcon from "assets/icons/location-red.svg"
import SearchIcon from "assets/icons/search-red.svg"
import { AppScrollView } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

interface AddressInfo {
  address: string
  city?: string
  governorate?: string
  coords: { lat: number; lon: number }
}

interface Props {
  isVisible: boolean
  onClose: () => void
  onSelectAddress: (address: AddressInfo) => void
  onSelectNewLocation: () => void
  onViewAllAddresses?: () => void
}

const AddressSelectionModal: React.FC<Props> = ({
  isVisible,
  onClose,
  onSelectAddress,
  onSelectNewLocation,
  onViewAllAddresses,
}) => {
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()
  const { guestLocation, isAuth } = useTypedSelector((store) => store.auth)
  const { data: customerData } = useGetCustomerMeQuery(undefined, { skip: !isAuth })

  const lastUsedAddress = guestLocation?.address
  const savedAddresses = isAuth ? customerData?.addresses || [] : []

  const handleSelectLastUsed = () => {
    if (lastUsedAddress) {
      onSelectAddress(lastUsedAddress)
    }
  }

  const handleSelectSaved = (saved: CustomerSavedAddress) => {
    onSelectAddress({
      address: saved.address.streetAddress || "",
      city: saved.address.city,
      governorate: saved.address.governorate,
      coords: { lat: saved.address.location.lat, lon: saved.address.location.lng },
    })
  }

  // Filter out saved addresses that match the last-used address (by coordinates)
  const filteredSavedAddresses = savedAddresses.filter((saved) => {
    if (!lastUsedAddress) return true
    const sLat = saved.address.location.lat
    const sLng = saved.address.location.lng
    const lLat = lastUsedAddress.coords.lat
    const lLon = lastUsedAddress.coords.lon
    return Math.abs(sLat - lLat) > 0.0001 || Math.abs(sLng - lLon) > 0.0001
  })

  const sheetContent = (
    <>
        {/* Header Section — transparent bg with white text */}
        <DmView style={[a.px_18, a.pt_20, a.pb_16, styles.box]}>
          <DmView style={[a.flex_row, a.items_center, a.mb_8]}>
            <LocationIcon width={22} height={22} />
            <Text size={18} weight="bold" leading="tight" color="inverse" style={[a.ml_4, a.flex_1]}>
              {t("choose_service_address")}
            </Text>
          </DmView>
          <Text size={12} leading={px(18)} color="inverse">
            {t("use_your_registered_address_or_add_new")}
          </Text>
        </DmView>

        {/*
          White Content Section.

          Rounds its OWN top corners, because this sheet passes
          transparentBackground so its header can float on the dim — and that
          makes the native container skip the outline clip that gives every
          other sheet its rounded top (see styleSheetContainer in
          TapplerSheetHostView.kt). Without this the panel read as a square-edged
          white block next to the rounded Filters and question sheets.

          28 to match, not a smaller number picked by eye — CORNER_RADIUS_DIP in
          TapplerSheetHostView.kt is 28, and so is sheetContentRound on the JS
          side.
        */}
        <DmView
          style={[styles.scrollWrap, a.overflow_hidden, { paddingBottom: insets.bottom + 2, maxHeight: 550 }]}
        >
        <AppScrollView showsVerticalScrollIndicator={false}>
          {/* Last used address */}
          {!!lastUsedAddress && (
            <>
              <DmView style={[a.px_18, a.py_12]} onPress={handleSelectLastUsed}>
                <Text size={12} weight="bold" leading={px(26)}>
                  {t("last_used_address")}
                </Text>
                <Text size={12} style={a.mt_2}>
                  {lastUsedAddress.address}
                </Text>
                {(lastUsedAddress.city || lastUsedAddress.governorate) && (
                  <Text size={11} leading="loose" color="tertiary">
                    {lastUsedAddress.city ? `${lastUsedAddress.city}, ` : ""}
                    {lastUsedAddress.governorate || ""}
                  </Text>
                )}
              </DmView>
              <DmView style={[styles.box2, a.ml_18]} />
            </>
          )}

          {/* Saved account addresses (max 2) */}
          {filteredSavedAddresses.map((saved) => (
            <React.Fragment key={saved.id}>
              <DmView style={[a.px_18, a.py_12]} onPress={() => handleSelectSaved(saved)}>
                <Text size={12} weight="bold" leading={px(26)}>
                  {saved.name}
                </Text>
                <Text size={12} style={a.mt_2}>
                  {saved.address.streetAddress || ""}
                </Text>
                {(saved.address.city || saved.address.governorate) && (
                  <Text size={11} leading="loose" color="tertiary">
                    {saved.address.city ? `${saved.address.city}, ` : ""}
                    {saved.address.governorate || ""}
                  </Text>
                )}
              </DmView>
              <DmView style={[styles.box2, a.ml_18]} />
            </React.Fragment>
          ))}

          {/* New Location */}
          <DmView
            style={[a.p_18, a.flex_row, a.items_center, a.justify_between]}
            onPress={onSelectNewLocation}
          >
            <DmView style={a.flex_1}>
              <Text size={12} weight="bold">
                {t("new_location")}
              </Text>
              <Text size={12} color="tertiary" style={styles.chooseAnotherAddress}>
                {t("choose_another_address")}
              </Text>
            </DmView>
            <DmView style={a.mr_18}>
              <SearchIcon width={16} height={16} />
            </DmView>
          </DmView>
        </AppScrollView>
        </DmView>
    </>
  )

  // One shell, both platforms — the SAME native sheet on each, not a
  // react-native-modal fallback on Android; that branch is gone from
  // NativeActionSheet. transparentBackground keeps the container clear so the
  // header floats on the dim, which is also why the white content section below
  // has to round its own top corners. The 0.85 dim that makes that white header
  // legible is one of the six redundant hand-passed values — NativeActionSheet
  // already derives exactly that from transparentBackground; it is kept only
  // because it states the intent where it sits.
  // Short/self-sizing, so it keeps the short-sheet push-back.
  return (
    <NativeActionSheet
      isVisible={isVisible}
      onClose={onClose}
      transparentBackground
      dimOpacity={0.85}
    >
      {sheetContent}
    </NativeActionSheet>
  )
}

export default AddressSelectionModal
