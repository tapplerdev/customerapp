import React, { useCallback, useState } from "react"
import { ScrollView, TextInput } from "react-native"
import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import { RootStackScreenProps } from "navigation/types"
import { useCreateCustomerAddressMutation } from "services/api"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"

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
            {t("add_new_address")}
          </DmText>
        </DmView>
        <DmView className="w-[32]" />
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Place Nick Name */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("place_nick_name")}
            </DmText>
          </DmView>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            placeholder={t("place_nick_name_placeholder")}
            placeholderTextColor={colors.grey15}
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Address */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("address")}
            </DmText>
          </DmView>
          <TextInput
            value={address}
            onChangeText={setAddress}
            placeholder={t("address_placeholder")}
            placeholderTextColor={colors.grey15}
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* City */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("city")}
            </DmText>
          </DmView>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder={t("city_placeholder")}
            placeholderTextColor={colors.grey15}
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Governorate */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("governorate")}
            </DmText>
          </DmView>
          <TextInput
            value={governorate}
            onChangeText={setGovernorate}
            placeholder={t("governorate")}
            placeholderTextColor={colors.grey15}
            className="text-14 font-custom400 text-black pb-[8] border-b-[0.7px] border-b-grey19"
            style={[
              takeFontStyles("font-custom400 leading-[20px]", i18n.language),
              { textAlign: isAr ? "right" : "left", writingDirection: isAr ? "rtl" : "ltr" },
            ]}
          />
        </DmView>

        {/* Place Type */}
        <DmView className="mb-[20]">
          <DmView className="flex-row">
            <DmText className="text-11 font-custom700 text-black mb-[6]">
              {t("place_type")}
            </DmText>
          </DmView>
          <DmView className="flex-row flex-wrap mt-[4]">
            {PLACE_TYPES.map((pt) => {
              const isSelected = placeType === pt.key
              return (
                <DmView
                  key={pt.key}
                  className={`mr-[10] mb-[8] px-[16] py-[8] rounded-20 border-1 ${
                    isSelected ? "bg-red border-red" : "bg-white border-grey1"
                  }`}
                  onPress={() => setPlaceType(pt.key)}
                >
                  <DmText
                    className={`text-13 font-custom500 ${
                      isSelected ? "text-white" : "text-black"
                    }`}
                  >
                    {isAr ? pt.labelAr : pt.labelEn}
                  </DmText>
                </DmView>
              )
            })}
          </DmView>
        </DmView>

        {/* Spacer + Add Address Button */}
        <DmView className="flex-1" />
        <DmView className="px-[16] pb-[40]">
          <ActionBtn
            onPress={handleAddAddress}
            className={`h-[42] w-full ${isFilled ? "bg-red" : "bg-grey19"}`}
            title={t("add_address")}
            textClassName="text-13 leading-[21px] font-custom600 text-white"
            disable={!isFilled}
            isLoading={isLoading}
          />
        </DmView>
      </ScrollView>
    </SafeAreaView>
  )
}

export default AddNewAddressScreen
