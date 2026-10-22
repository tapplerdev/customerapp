import React from "react"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import { RootStackScreenProps } from "navigation/types"

import LocationRedIcon from "assets/icons/location-red.svg"
import styles from "./styles"
import { Text, Button, a } from "@tappler/shared/src/ds"

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
    // Plain bottom padding, NOT insets.bottom + 24. The panel this replaced was
    // an absolutely-positioned overlay, so it had to clear the home indicator
    // itself; a native formSheet does not — UIKit insets it already, and adding
    // the inset again made the sheet 34pt taller than its content on a
    // home-indicator device. AuthGateScreen, the other fitToContents sheet in
    // this app, has always used a plain value for the same reason.
    <DmView style={[styles.container, a.p_24]}>
      <DmView style={[a.flex_row, a.items_center]}>
        <LocationRedIcon width={20} height={20} />
        <Text size={16} weight="semibold" leading="legacy" style={a.mx_8}>
          {t("save_this_address")}
        </Text>
      </DmView>

      <Text size={13} leading="legacy" color="tertiary" style={a.mt_6}>
        {t("save_address_descr")}
      </Text>

      <DmView
        style={[a.mt_16, a.px_14, a.py_12, styles.box, styles.addressPreviewBg]}
      >
        <Text size={13} weight="medium" leading="legacy">
          {address?.address}
        </Text>
        {(address?.city || address?.governorate) && (
          <Text size={12} leading="legacy" color="tertiary" style={styles.text}>
            {[address.city, address.governorate].filter(Boolean).join(", ")}
          </Text>
        )}
      </DmView>

      <DmView style={[a.flex_row, a.mt_20]}>
        <DmView style={[a.flex_1, a.mr_10]}>
          <Button
            title={t("no_thanks")}
            onPress={() => navigation.goBack()}
            size="md"
            shape="r10"
            variant="white"
            label="sm"
            labelLeading="legacy"
          />
        </DmView>
        <DmView style={a.flex_1}>
          <Button
            title={t("save")}
            onPress={handleSave}
            size="md"
            shape="r10"
            label="sm"
            labelWeight="semibold"
            labelLeading="legacy"
          />
        </DmView>
      </DmView>
    </DmView>
  )
}

export default SaveAddressSheetScreen
