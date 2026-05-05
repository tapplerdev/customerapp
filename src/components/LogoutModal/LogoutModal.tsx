import React from "react"

import { DmView } from "@tappler/shared/src/components/UI"
import { MainModal } from "@tappler/shared/src/components"

import { useTranslation } from "react-i18next"
import { I18nManager } from "react-native"

import LogoutDoorIcon from "assets/icons/logout-door.svg"

interface Props {
  isVisible: boolean
  onClose: () => void
  onModalHide: () => void
  onPress: () => void
}

const LogoutModal: React.FC<Props> = ({
  isVisible,
  onClose,
  onModalHide,
  onPress,
}) => {
  const { t } = useTranslation()

  return (
    <MainModal
      isVisible={isVisible}
      classNameModal="px-[38]"
      onClose={onClose}
      onModalHide={onModalHide}
      onPressSecond={onClose}
      title={t("are_you_sure_logout")}
      classNameTitle="mt-[19] text-center text-13 leading-[25px] font-custom500"
      isBtnsTwo
      titleBtn={t("yes")}
      titleBtnSecond={t("no")}
      Icon={
        <DmView style={!I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
          <LogoutDoorIcon width={36} height={42} />
        </DmView>
      }
      classNameBtnsWrapper="mt-[22] px-[4]"
      classNameBtns="h-[34] font-custom700"
      className="m-0 px-[40] pt-[19] rounded-10"
      classNameSecondBtn="border-black"
      classNameSecondBtnText="text-red"
      onPress={onPress}
    />
  )
}

export default LogoutModal
