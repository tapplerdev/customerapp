import React from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"

import LocationRedIcon from "assets/icons/location-red.svg"
import styles from "./styles"

type Props = RootStackScreenProps<"SaveAddressSheetScreen">

/**
 * The "Save this address?" prompt, as a real native sheet.
 *
 * It has to be its own route: formSheet is a navigation presentation, not an
 * overlay, so there is no way to get UIKit's sheet (or Android's
 * BottomSheetDialog) from JSX rendered inside another screen. It replaced a
 * hand-rolled Animated panel that lived in RequestSuccessScreen.
 *
 * Height and dimming are configured where the screen is registered — see
 * Navigator's sheetAllowedDetents / sheetLargestUndimmedDetentIndex. Nothing
 * here may be flex-1: `fitToContents` measures this content to size the sheet,
 * so a filling child would make it full-height.
 */
const SaveAddressSheetScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const address = route.params?.address

  const handleSave = () => {
    if (!address) return
    // replace, not navigate: AddNewAddressScreen with fromSuccess owns the exit
    // from here on (both its back and its successful save reset to talabati), so
    // leaving this sheet underneath it would strand a route nothing returns to.
    navigation.replace("AddNewAddressScreen", {
      address: address.address,
      city: address.city,
      governorate: address.governorate,
      coords: address.coords,
      fromSuccess: true,
    })
  }

  return (
    <DmView
      className="bg-white px-[24] pt-[24]"
      style={{ paddingBottom: insets.bottom + 24 }}
    >
      <DmView className="flex-row items-center">
        <LocationRedIcon width={20} height={20} />
        <DmText className="mx-[8] text-16 font-custom600 text-black">
          {t("save_this_address")}
        </DmText>
      </DmView>

      <DmText className="mt-[6] text-13 font-custom400 text-grey3">
        {t("save_address_descr")}
      </DmText>

      <DmView
        className="mt-[16] px-[14] py-[12] rounded-10"
        style={styles.addressPreviewBg}
      >
        <DmText className="text-13 font-custom500 text-black">
          {address?.address}
        </DmText>
        {(address?.city || address?.governorate) && (
          <DmText className="text-12 font-custom400 text-grey3 mt-[3]">
            {[address.city, address.governorate].filter(Boolean).join(", ")}
          </DmText>
        )}
      </DmView>

      <DmView className="flex-row mt-[20]">
        <DmView className="flex-1 mr-[10]">
          <ActionBtn
            title={t("no_thanks")}
            onPress={() => navigation.goBack()}
            variant="white"
            className="h-[44] rounded-10"
            textClassName="text-13 font-custom500"
          />
        </DmView>
        <DmView className="flex-1">
          <ActionBtn
            title={t("save")}
            onPress={handleSave}
            className="h-[44] rounded-10"
            textClassName="text-13 font-custom600"
          />
        </DmView>
      </DmView>
    </DmView>
  )
}

export default SaveAddressSheetScreen
