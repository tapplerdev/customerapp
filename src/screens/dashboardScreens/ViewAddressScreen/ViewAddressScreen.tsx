import React, { useCallback, useState } from "react"
import { ScrollView } from "react-native"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import { MainModal } from "@tappler/shared/src/components"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import DeleteIcon from "assets/icons/Delete.svg"
import { RootStackScreenProps } from "navigation/types"
import { useDeleteCustomerAddressMutation } from "services/api"
import colors from "@tappler/shared/src/styles/colors"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"

type Props = RootStackScreenProps<"ViewAddressScreen">

const ViewAddressScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const { addressId, name, streetAddress, city, governorate, type } = route.params

  const [deleteAddress] = useDeleteCustomerAddressMutation()
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false)
  const [isDeleting, setDeleting] = useState(false)

  const onGoBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const handleDelete = async () => {
    try {
      setDeleting(true)
      await deleteAddress(addressId).unwrap()
      setDeleteModalVisible(false)
      navigation.goBack()
    } catch (error) {
      setDeleting(false)
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
            {name}
          </DmText>
        </DmView>
        <DmView
          onPress={() => setDeleteModalVisible(true)}
          hitSlop={HIT_SLOP_DEFAULT}
        >
          <DmText className="text-14 font-custom600 text-red">
            {t("delete")}
          </DmText>
        </DmView>
      </DmView>
      <DmView className="h-[0.7] bg-grey19" />

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Place Nick Name */}
        <DmView className="mb-[20]">
          <DmText className="text-11 font-custom700 text-black mb-[6] px-[24]">
            {t("place_nick_name")}
          </DmText>
          <DmText className="text-14 font-custom400 text-black pb-[8] px-[24]">
            {name}
          </DmText>
          <DmView className="h-[0.7] bg-grey19" />
        </DmView>

        {/* Address */}
        <DmView className="mb-[20]">
          <DmText className="text-11 font-custom700 text-black mb-[6] px-[24]">
            {t("address")}
          </DmText>
          <DmText className="text-14 font-custom400 text-black pb-[8] px-[24]">
            {streetAddress || "-"}
          </DmText>
          <DmView className="h-[0.7] bg-grey19" />
        </DmView>

        {/* City */}
        <DmView className="mb-[20]">
          <DmText className="text-11 font-custom700 text-black mb-[6] px-[24]">
            {t("city")}
          </DmText>
          <DmText className="text-14 font-custom400 text-black pb-[8] px-[24]">
            {city || "-"}
          </DmText>
          <DmView className="h-[0.7] bg-grey19" />
        </DmView>

        {/* Governorate */}
        <DmView className="mb-[20]">
          <DmText className="text-11 font-custom700 text-black mb-[6] px-[24]">
            {t("governorate")}
          </DmText>
          <DmText className="text-14 font-custom400 text-black pb-[8] px-[24]">
            {governorate || "-"}
          </DmText>
          <DmView className="h-[0.7] bg-grey19" />
        </DmView>

        {/* Place Type */}
        <DmView className="mb-[20]">
          <DmText className="text-11 font-custom700 text-black mb-[6] px-[24]">
            {t("place_type")}
          </DmText>
          <DmText className="text-14 font-custom400 text-black pb-[8] px-[24]">
            {type || "-"}
          </DmText>
          <DmView className="h-[0.7] bg-grey19" />
        </DmView>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <MainModal
        isVisible={isDeleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        Icon={<DeleteIcon width={48} height={48} />}
        title={t("confirm_delete_address")}
        classNameTitle="mt-[17] text-14 leading-[22px] font-custom600"
        isBtnsTwo
        titleBtn={t("yes")}
        titleBtnSecond={t("no")}
        onPress={handleDelete}
        onPressSecond={() => setDeleteModalVisible(false)}
        isLoading={isDeleting}
        classNameModal="px-[17]"
        classNameBtns="h-[40]"
        classNameBtnsWrapper="mt-[20] mx-[15]"
      />
    </SafeAreaView>
  )
}

export default ViewAddressScreen
