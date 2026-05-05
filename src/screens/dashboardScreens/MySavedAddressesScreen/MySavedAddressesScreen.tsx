import React, { useCallback, useEffect, useRef } from "react"
import { ScrollView, I18nManager } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import { addressEventBus } from "@tappler/shared/src/events/AddressBus"
import { AddressInfo } from "@tappler/shared/src/types"
import { RootStackScreenProps } from "navigation/types"
import { useGetCustomerMeQuery } from "services/api"
import colors from "@tappler/shared/src/styles/colors"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"

type Props = RootStackScreenProps<"MySavedAddressesScreen">

const MySavedAddressesScreen: React.FC<Props> = ({ route, navigation }) => {
  const selectionMode = route.params?.selectionMode ?? false
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  const { data: customerData } = useGetCustomerMeQuery()
  const savedAddresses = customerData?.addresses || []

  const isListeningRef = useRef(false)

  useEffect(() => {
    const handler = (data: AddressInfo) => {
      if (!isListeningRef.current) return
      isListeningRef.current = false
      // Delay so PickAddressScreen finishes dismissing before we push
      setTimeout(() => {
        navigation.navigate("AddNewAddressScreen", {
          address: data.address,
          city: data.city,
          governorate: data.governorate,
          coords: data.coords,
        })
      }, 600)
    }
    addressEventBus.on("address:pick", handler)
    return () => {
      addressEventBus.off("address:pick", handler)
    }
  }, [navigation])

  const handleAddNewAddress = useCallback(() => {
    isListeningRef.current = true
    navigation.navigate("PickAddressScreen")
  }, [navigation])

  const onGoBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white">
      {/* Header */}
      <DmView className="flex-row items-center px-[16] py-[12]">
        <DmView onPress={onGoBack} className="w-[32] h-[32] items-center justify-center">
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView className="flex-1 items-center">
          <DmText className="text-16 font-custom600 text-black">
            {t("my_saved_addresses")}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      <ScrollView
        contentContainerStyle={{ paddingTop: 4, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Saved Address Cards */}
        {savedAddresses.map((item) => (
          <DmView
            key={item.id}
            onPress={() => {
              if (selectionMode) {
                addressEventBus.emit("address:select", {
                  address: item.address.streetAddress || "",
                  city: item.address.city || "",
                  governorate: item.address.governorate || "",
                  coords: { lat: item.address.location.lat, lon: item.address.location.lng },
                })
                navigation.goBack()
              } else {
                navigation.navigate("ViewAddressScreen", {
                  addressId: item.id,
                  name: item.name,
                  streetAddress: item.address.streetAddress || "",
                  city: item.address.city || "",
                  governorate: item.address.governorate || "",
                  type: item.type || "",
                })
              }
            }}
          >
            <DmView className="flex-row items-center px-[16] py-[10]">
              <DmView className="flex-1">
                <DmText className="text-13 font-custom700 text-black mb-[2]">
                  {item.name}
                </DmText>
                <DmText className="text-12 font-custom400 text-black leading-[18px]">
                  {item.address.streetAddress || ""}
                </DmText>
                {(item.address.city || item.address.governorate) && (
                  <DmText className="text-12 font-custom400 text-black leading-[18px]">
                    {item.address.city ? `${item.address.city}, ` : ""}
                    {item.address.governorate || ""}
                  </DmText>
                )}
              </DmView>
              <DmView style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}>
                <ChevronRightIcon width={18} height={18} color={colors.red} />
              </DmView>
            </DmView>
            <DmView className="h-[0.7] bg-grey19" style={{ marginStart: 16 }} />
          </DmView>
        ))}

        {/* Empty state */}
        {savedAddresses.length === 0 && (
          <DmView className="items-center mt-[40]">
            <DmText className="text-13 font-custom400 text-grey3">
              {t("no_saved_addresses")}
            </DmText>
          </DmView>
        )}

        {/* Add New Address */}
        <DmView onPress={handleAddNewAddress} className="flex-row items-center px-[16] py-[12]">
          <DmText className="text-16 font-custom700 text-red" style={{ marginEnd: 6 }}>
            +
          </DmText>
          <DmText className="text-13 font-custom700 text-black">
            {t("add_new_address")}
          </DmText>
        </DmView>
      </ScrollView>
    </SafeAreaView>
  )
}

export default MySavedAddressesScreen
