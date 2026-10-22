import React, { useCallback, useState } from "react"
import { DmView } from "@tappler/shared/src/components/UI"
import { MainModal } from "@tappler/shared/src/components"
import { useTranslation } from "react-i18next"
import { SafeAreaView } from "react-native-safe-area-context"

import ChevronLeftIcon from "assets/icons/chevron-left.svg"
import DeleteIcon from "assets/icons/Delete.svg"
import { RootStackScreenProps } from "navigation/types"
import { useDeleteCustomerAddressMutation } from "services/api"
import colors from "@tappler/shared/src/styles/colors"
import { HIT_SLOP_DEFAULT } from "@tappler/shared/src/styles/helpersStyles"
import { AppScrollView } from "components/scroll"
import { Text, a, px } from "@tappler/shared/src/ds"
import styles from "./styles"

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
            {name}
          </Text>
        </DmView>
        <DmView
          onPress={() => setDeleteModalVisible(true)}
          hitSlop={HIT_SLOP_DEFAULT}
        >
          <Text size={14} weight="semibold" leading="legacy" color="brand">
            {t("delete")}
          </Text>
        </DmView>
      </DmView>
      <DmView style={styles.box} />

      <AppScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Place Nick Name */}
        <DmView style={a.mb_20}>
          <Text size={11} weight="bold" leading="legacy" style={[a.mb_6, a.px_24]}>
            {t("place_nick_name")}
          </Text>
          <Text size={14} leading="legacy" style={[a.pb_8, a.px_24]}>
            {name}
          </Text>
          <DmView style={styles.box} />
        </DmView>

        {/* Address */}
        <DmView style={a.mb_20}>
          <Text size={11} weight="bold" leading="legacy" style={[a.mb_6, a.px_24]}>
            {t("address")}
          </Text>
          <Text size={14} leading="legacy" style={[a.pb_8, a.px_24]}>
            {streetAddress || "-"}
          </Text>
          <DmView style={styles.box} />
        </DmView>

        {/* City */}
        <DmView style={a.mb_20}>
          <Text size={11} weight="bold" leading="legacy" style={[a.mb_6, a.px_24]}>
            {t("city")}
          </Text>
          <Text size={14} leading="legacy" style={[a.pb_8, a.px_24]}>
            {city || "-"}
          </Text>
          <DmView style={styles.box} />
        </DmView>

        {/* Governorate */}
        <DmView style={a.mb_20}>
          <Text size={11} weight="bold" leading="legacy" style={[a.mb_6, a.px_24]}>
            {t("governorate")}
          </Text>
          <Text size={14} leading="legacy" style={[a.pb_8, a.px_24]}>
            {governorate || "-"}
          </Text>
          <DmView style={styles.box} />
        </DmView>

        {/* Place Type */}
        <DmView style={a.mb_20}>
          <Text size={11} weight="bold" leading="legacy" style={[a.mb_6, a.px_24]}>
            {t("place_type")}
          </Text>
          <Text size={14} leading="legacy" style={[a.pb_8, a.px_24]}>
            {type || "-"}
          </Text>
          <DmView style={styles.box} />
        </DmView>
      </AppScrollView>

      {/* Delete Confirmation Modal */}
      <MainModal
        isVisible={isDeleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        Icon={<DeleteIcon width={48} height={48} />}
        title={t("confirm_delete_address")}
        titleType={{ size: 14, leading: px(22) }}
        titleStyle={styles.mainModalTitle}
        isBtnsTwo
        titleBtn={t("yes")}
        titleBtnSecond={t("no")}
        onPress={handleDelete}
        onPressSecond={() => setDeleteModalVisible(false)}
        isLoading={isDeleting}
        modalStyle={styles.mainModalModal}
        btnsStyle={styles.mainModalBtns}
        btnsWrapperStyle={[a.mt_20, styles.mainModalBtnsWrapper]}
      />
    </SafeAreaView>
  )
}

export default ViewAddressScreen
