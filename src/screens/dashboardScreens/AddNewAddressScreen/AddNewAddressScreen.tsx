import React, { useCallback, useState } from "react"
import { TextInput } from "react-native"
import { DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import { RootStackScreenProps } from "navigation/types"
import { useCreateCustomerAddressMutation } from "services/api"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"
import { AppKeyboardAwareScrollView } from "components/scroll"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

const disabledLookSubtleInverse = { surface: "subtle", label: "inverse" } as const

type Props = RootStackScreenProps<"AddNewAddressScreen">

const PLACE_TYPES = [
  { key: "flat", labelEn: "Flat", labelAr: "شقة" },
  { key: "villa", labelEn: "Villa", labelAr: "فيلا" },
  { key: "office", labelEn: "Office", labelAr: "مكتب" },
  { key: "other", labelEn: "Other", labelAr: "أخرى" },
] as const

const AddNewAddressScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const params = route.params

  const [createAddress] = useCreateCustomerAddressMutation()

  const [nickname, setNickname] = useState("")
  const [address, setAddress] = useState(params?.address || "")
  const [city, setCity] = useState(params?.city || "")
  const [governorate, setGovernorate] = useState(params?.governorate || "")
  const [placeType, setPlaceType] = useState("")
  const [isLoading, setLoading] = useState(false)

  const fromSuccess = params?.fromSuccess

  const navigateToTalabati = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: "HomeTabs", params: { screen: "talabati" } }],
    })
  }, [navigation])

  const onGoBack = useCallback(() => {
    if (fromSuccess) {
      navigateToTalabati()
    } else {
      navigation.goBack()
    }
  }, [navigation, fromSuccess])

  const isFilled = nickname && address && city && governorate && placeType

  const handleAddAddress = async () => {
    if (!isFilled) return

    const payload = {
      name: nickname,
      type: placeType,
      streetAddress: address,
      city,
      governorate,
      location: {
        lat: params?.coords?.lat || 0,
        lng: params?.coords?.lon || 0,
      },
    }

    try {
      setLoading(true)
      const result = await createAddress(payload).unwrap()
      if (fromSuccess) {
        navigateToTalabati()
      } else {
        navigation.goBack()
      }
    } catch (error: any) {
    } finally {
      setLoading(false)
    }
  }

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
            {t("add_new_address")}
          </Text>
        </DmView>
        <DmView style={styles.box} />
      </DmView>
      <DmView style={styles.box2} />

      {/*
        KeyboardAwareScrollView, not a plain ScrollView, and flexGrow is exactly
        why. `flexGrow: 1` makes the content the height of the frame, so the
        scroll range is ZERO — the spacer below pins "Add address" to the
        physical bottom and on iOS there is no way to scroll it out from under
        the keyboard, because a plain ScrollView adds no keyboard contentInset
        (nothing in this app sets automaticallyAdjustKeyboardInsets). Same shape
        and same fix as DeleteAccountScreen / RegisterScreen / SignInEmailScreen.
        No enableOnAndroid: this app mounts no KeyboardProvider, so the
        manifest's adjustResize already shrinks the window there.
      */}
      <AppKeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Place Nick Name */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("place_nick_name")}
            </Text>
          </DmView>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder={t("place_nick_name_placeholder")}
            placeholderTextColor={colors.grey15}
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Address */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("address")}
            </Text>
          </DmView>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t("address_placeholder")}
            placeholderTextColor={colors.grey15}
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* City */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("city")}
            </Text>
          </DmView>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={t("city_placeholder")}
            placeholderTextColor={colors.grey15}
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Governorate */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("governorate")}
            </Text>
          </DmView>
          <TextInput
            value={governorate}
            onChangeText={setGovernorate}
            placeholder={t("governorate")}
            placeholderTextColor={colors.grey15}
            style={[styles.input, a.pb_8, 
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Place Type */}
        <DmView style={a.mb_20}>
          <DmView style={a.flex_row}>
            <Text size={11} weight="bold" leading="legacy" style={a.mb_6}>
              {t("place_type")}
            </Text>
          </DmView>
          <DmView style={[a.flex_row, a.flex_wrap, a.mt_4]}>
            {PLACE_TYPES.map((pt) => {
              const isSelected = placeType === pt.key
              return (
                <DmView
                  key={pt.key}
                  style={[
                    a.mr_10,
                    a.mb_8,
                    a.px_16,
                    a.py_8,
                    styles.container,
                    a.border_1,
                    isSelected ? styles.containerSelected : styles.containerNotSelected,
                  ]}
                  onPress={() => setPlaceType(pt.key)}
                >
                  <Text
                    size={13}
                    weight="medium"
                    leading="legacy"
                    color={isSelected ? "inverse" : "primary"}
                  >
                    {isAr ? pt.labelAr : pt.labelEn}
                  </Text>
                </DmView>
              )
            })}
          </DmView>
        </DmView>

        {/* Spacer + Add Address Button */}
        <DmView style={a.flex_1} />
        <DmView style={[a.px_16, a.pb_40]}>
          <Button
            onPress={handleAddAddress}
            size="sm"
            label="sm"
            labelWeight="semibold"
            labelLeading={px(21)}
            disabledLook={isFilled ? isLoading ? undefined : disabledLookSubtleInverse : disabledLookSubtleInverse}
            loadingSurface={isFilled ? "brand" : undefined}
            style={a.w_full}
            title={t("add_address")}
            disabled={!isFilled}
            isLoading={isLoading}
          />
        </DmView>
      </AppKeyboardAwareScrollView>
    </SafeAreaView>
  )
}

export default AddNewAddressScreen
