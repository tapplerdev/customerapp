import React from "react"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import Modal from "react-native-modal"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import ChevronRightIcon from "assets/icons/chevron-right.svg"
import colors from "@tappler/shared/src/styles/colors"

const PLACE_OF_SERVICE_LABELS: Record<string, { en: string; ar: string }> = {
  proToCustomer: { en: "at_my_location", ar: "at_my_location" },
  customerToPro: { en: "at_pro_location", ar: "at_pro_location" },
  remoteOrOnline: { en: "online_remote", ar: "online_remote" },
  delivery: { en: "delivery_service", ar: "delivery_service" },
  fixedLocations: { en: "at_fixed_location", ar: "at_fixed_location" },
}

interface Props {
  isVisible: boolean
  onClose: () => void
  onSelect: (placeOfService: string) => void
  options: string[]
}

const PlaceOfServiceModal: React.FC<Props> = ({
  isVisible,
  onClose,
  onSelect,
  options,
}) => {
  const insets = useSafeAreaInsets()
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      className="m-0 justify-end"
      animationIn="slideInUp"
      animationOut="slideOutDown"
      hardwareAccelerated
      statusBarTranslucent
      backdropTransitionOutTiming={0}
      hideModalContentWhileAnimating
    >
      <DmView className="bg-white rounded-t-12" style={{ paddingBottom: insets.bottom + 2 }}>
        <DmView className="px-[18] pt-[20] pb-[14]">
          <DmText className="text-16 leading-[22px] font-custom700 text-black">
            {t("how_do_you_want_service")}
          </DmText>
        </DmView>
        <DmView className="h-[0.7] bg-grey19" />

        {options.map((option, index) => {
          const labelKey = PLACE_OF_SERVICE_LABELS[option]?.en || option
          return (
            <React.Fragment key={option}>
              <DmView
                className="flex-row items-center justify-between px-[18] py-[14]"
                onPress={() => onSelect(option)}
              >
                <DmText className="text-13 leading-[18px] font-custom500 text-black">
                  {t(labelKey)}
                </DmText>
                <ChevronRightIcon
                  width={16}
                  height={16}
                  color={colors.grey3}
                  style={isAr ? { transform: [{ rotate: "180deg" }] } : undefined}
                />
              </DmView>
              {index < options.length - 1 && (
                <DmView className="h-[0.7] bg-grey19" style={{ marginStart: 18 }} />
              )}
            </React.Fragment>
          )
        })}
      </DmView>
    </Modal>
  )
}

export default PlaceOfServiceModal
