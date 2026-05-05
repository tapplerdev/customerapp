import React, { useCallback, useEffect, useRef } from "react"
import { ScrollView } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useTypedSelector } from "store"
import { useGetCustomerMeQuery } from "services/api"
import { CustomerSavedAddress } from "types/auth"

import LocationIcon from "assets/icons/location-red.svg"
import SearchIcon from "assets/icons/search-red.svg"

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
  const { data: customerData } = useGetCustomerMeQuery()
  const sheetRef = useRef<BottomSheet>(null)

  const lastUsedAddress = guestLocation?.address
  const savedAddresses = isAuth ? customerData?.addresses || [] : []

  // Bridge isVisible prop to BottomSheet ref
  useEffect(() => {
    if (isVisible) {
      sheetRef.current?.expand()
    } else {
      sheetRef.current?.close()
    }
  }, [isVisible])

  const handleSheetChange = useCallback((index: number) => {
    if (index === -1) {
      onClose()
    }
  }, [onClose])

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.85} />
    ),
    []
  )

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

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onChange={handleSheetChange}
      handleComponent={null}
      backgroundStyle={{ backgroundColor: "transparent" }}
    >
      <BottomSheetView>
        {/* Header Section — transparent bg with white text */}
        <DmView className="px-[18] pt-[20] pb-[16] rounded-t-12">
          <DmView className="flex-row items-center mb-[8]">
            <LocationIcon width={22} height={22} />
            <DmText className="ml-[4] text-18 leading-[22px] font-custom700 text-white flex-1">
              {t("choose_service_address")}
            </DmText>
          </DmView>
          <DmText className="text-12 leading-[18px] font-custom400 text-white">
            {t("use_your_registered_address_or_add_new")}
          </DmText>
        </DmView>

        {/* White Content Section */}
        <DmView className="bg-white" style={{ paddingBottom: insets.bottom + 2, maxHeight: 550 }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Last used address */}
          {!!lastUsedAddress && (
            <>
              <DmView className="px-[18] py-[12]" onPress={handleSelectLastUsed}>
                <DmText className="text-12 leading-[26px] font-custom700 text-black">
                  {t("last_used_address")}
                </DmText>
                <DmText className="text-12 leading-[16px] font-custom400 text-black mt-[2]">
                  {lastUsedAddress.address}
                </DmText>
                {(lastUsedAddress.city || lastUsedAddress.governorate) && (
                  <DmText className="text-11 leading-[16px] font-custom400 text-grey3">
                    {lastUsedAddress.city ? `${lastUsedAddress.city}, ` : ""}
                    {lastUsedAddress.governorate || ""}
                  </DmText>
                )}
              </DmView>
              <DmView className="h-[1] bg-grey5 ml-[18]" />
            </>
          )}

          {/* Saved account addresses (max 2) */}
          {filteredSavedAddresses.map((saved) => (
            <React.Fragment key={saved.id}>
              <DmView className="px-[18] py-[12]" onPress={() => handleSelectSaved(saved)}>
                <DmText className="text-12 leading-[26px] font-custom700 text-black">
                  {saved.name}
                </DmText>
                <DmText className="text-12 leading-[16px] font-custom400 text-black mt-[2]">
                  {saved.address.streetAddress || ""}
                </DmText>
                {(saved.address.city || saved.address.governorate) && (
                  <DmText className="text-11 leading-[16px] font-custom400 text-grey3">
                    {saved.address.city ? `${saved.address.city}, ` : ""}
                    {saved.address.governorate || ""}
                  </DmText>
                )}
              </DmView>
              <DmView className="h-[1] bg-grey5 ml-[18]" />
            </React.Fragment>
          ))}

          {/* New Location */}
          <DmView
            className="px-[18] py-[18] flex-row items-center justify-between"
            onPress={onSelectNewLocation}
          >
            <DmView className="flex-1">
              <DmText className="text-12 leading-[16px] font-custom700 text-black">
                {t("new_location")}
              </DmText>
              <DmText className="text-12 leading-[16px] font-custom400 text-grey3 mt-[3]">
                {t("choose_another_address")}
              </DmText>
            </DmView>
            <DmView className="mr-[18]">
              <SearchIcon width={16} height={16} />
            </DmView>
          </DmView>
        </ScrollView>
        </DmView>
      </BottomSheetView>
    </BottomSheet>
  )
}

export default AddressSelectionModal
