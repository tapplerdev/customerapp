import React, { useCallback, useEffect, useRef } from "react"
import { I18nManager } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import { addressEventBus } from "@tappler/shared/src/events/AddressBus"
import { AddressInfo } from "@tappler/shared/src/types"
import { RootStackScreenProps } from "navigation/types"
import { useGetCustomerMeQuery } from "services/api"
import colors from "@tappler/shared/src/styles/colors"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import ChevronRightIcon from "assets/icons/chevron-right.svg"
import { AppScrollView } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

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
        // Only act when focused — the bus is shared across mounted screens
        if (!navigation.isFocused()) return
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
    <SafeAreaView edges={["top"]} style={[a.flex_1, styles.safeArea]}>
      {/* Header */}
      <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
        <DmView onPress={onGoBack} style={[styles.iconWrap, a.items_center, a.justify_center]}>
          <ChevronLeftIcon
            color={colors.red}
            style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
          />
        </DmView>
        <DmView style={[a.flex_1, a.items_center]}>
          <Text size={16} weight="semibold" leading="legacy">
            {t("my_saved_addresses")}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

      <AppScrollView
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
                  // Carries the origin forward so nothing downstream has to
                  // guess it. RequestSuccessScreen used to decide whether to
                  // offer "save this address" by comparing coordinates, which
                  // is only ever an approximation of the question it is really
                  // asking: did this come from the account already.
                  savedAddressId: item.id,
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
            <DmView style={[a.flex_row, a.items_center, a.px_16, a.py_10]}>
              <DmView style={a.flex_1}>
                <Text size={13} weight="bold" leading="legacy" style={a.mb_2}>
                  {item.name}
                </Text>
                <Text size={12} leading={px(18)}>
                  {item.address.streetAddress || ""}
                </Text>
                {(item.address.city || item.address.governorate) && (
                  <Text size={12} leading={px(18)}>
                    {item.address.city ? `${item.address.city}, ` : ""}
                    {item.address.governorate || ""}
                  </Text>
                )}
              </DmView>
              <DmView style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}>
                <ChevronRightIcon width={18} height={18} color={colors.red} />
              </DmView>
            </DmView>
            <DmView style={[styles.box2, { marginStart: 16 }]} />
          </DmView>
        ))}

        {/* Empty state */}
        {savedAddresses.length === 0 && (
          <DmView style={[a.items_center, a.mt_40]}>
            <Text size={13} leading="legacy" color="tertiary">
              {t("no_saved_addresses")}
            </Text>
          </DmView>
        )}

        {/* Add New Address */}
        <DmView onPress={handleAddNewAddress} style={[a.flex_row, a.items_center, a.px_16, a.py_12]}>
          <Text size={16} weight="bold" leading="legacy" color="brand" style={{ marginEnd: 6 }}>
            +
          </Text>
          <Text size={13} weight="bold" leading="legacy">
            {t("add_new_address")}
          </Text>
        </DmView>
      </AppScrollView>
    </SafeAreaView>
  )
}

export default MySavedAddressesScreen
