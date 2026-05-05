import React, { useState } from "react"
import { TouchableOpacity } from "react-native"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"
import { TooltipProps } from "rn-tourguide"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { setDontShowBestDealTooltip } from "store/auth/slice"

import TutorialArrowIcon from "assets/icons/tutorial-arrow.svg"

const TooltipComponent: React.ComponentType<TooltipProps> = ({ handleStop }) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const dispatch = useDispatch()
  const [dontShow, setDontShow] = useState(false)

  const handleGotIt = () => {
    if (dontShow) {
      dispatch(setDontShowBestDealTooltip(true))
    }
    handleStop?.()
  }

  return (
    <DmView className="items-center">
      <DmView style={[isAr ? { transform: [{ scaleX: -1 }] } : undefined]}>
        <TutorialArrowIcon width={140} height={140} />
      </DmView>
      <DmText className="mt-[-10] text-13 leading-[20px] text-white font-custom600 text-center">
        {t("how_to_get_best_deal")}
      </DmText>
      <DmText className="mt-[4] text-11 leading-[16px] text-white font-custom400 text-center px-[10]">
        {t("best_deal_tip_text")}
      </DmText>

      {/* Don't show again checkbox */}
      <TouchableOpacity
        className="flex-row items-center mt-[12]"
        onPress={() => setDontShow((prev) => !prev)}
        activeOpacity={0.7}
      >
        <DmView
          className="w-[18] h-[18] rounded-3 border-1 border-white items-center justify-center"
          style={dontShow ? { backgroundColor: "white" } : undefined}
        >
          {dontShow && (
            <DmText className="text-10 text-red font-custom700">✓</DmText>
          )}
        </DmView>
        <DmText className="ml-[6] text-11 text-white font-custom400">
          {t("do_not_show_again")}
        </DmText>
      </TouchableOpacity>

      <DmView className="mt-[14] w-[150]">
        <ActionBtn
          title={t("got_it")}
          onPress={handleGotIt}
          className="rounded-10 h-[34]"
        />
      </DmView>
    </DmView>
  )
}

export default TooltipComponent
