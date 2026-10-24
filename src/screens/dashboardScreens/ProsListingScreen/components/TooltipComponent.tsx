import React, { useState } from "react"
import { TouchableOpacity } from "react-native"
import { useTranslation } from "react-i18next"
import { useDispatch } from "react-redux"

import { DmView } from "@tappler/shared/src/components/UI"
import { setDontShowBestDealTooltip } from "store/auth/slice"

import TutorialArrowIcon from "assets/icons/tutorial-arrow.svg"
import { Text, Button, a, px } from "@tappler/shared/src/ds"
import { tooltipComponentStyles } from "./styles"

type TooltipProps = {
  /** Closes the tip (the CoachMark's `visible` goes false). */
  handleStop?: () => void
}

const TooltipComponent: React.FC<TooltipProps> = ({ handleStop }) => {
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
    <DmView style={a.items_center}>
      <DmView style={[isAr ? { transform: [{ scaleX: -1 }] } : undefined]}>
        <TutorialArrowIcon width={140} height={140} />
      </DmView>
      <Text size={13} weight="semibold" leading="loose" color="inverse" align="center" style={tooltipComponentStyles.howToGetBestDeal}>
        {t("how_to_get_best_deal")}
      </Text>
      <Text size={11} leading="loose" color="inverse" align="center" style={[a.mt_4, a.px_10]}>
        {t("best_deal_tip_text")}
      </Text>

      {/* Don't show again checkbox */}
      <TouchableOpacity
        style={[a.flex_row, a.items_center, a.mt_12]}
        onPress={() => setDontShow((prev) => !prev)}
        activeOpacity={0.7}
      >
        <DmView
          style={[tooltipComponentStyles.box, a.border_1, a.items_center, a.justify_center, dontShow ? { backgroundColor: "white" } : undefined]}
        >
          {dontShow && (
            <Text size={10} weight="bold" leading="legacy" color="brand">✓</Text>
          )}
        </DmView>
        <Text size={11} leading="legacy" color="inverse" style={a.ml_6}>
          {t("do_not_show_again")}
        </Text>
      </TouchableOpacity>

      <DmView style={[a.mt_14, tooltipComponentStyles.buttonWrap]}>
        <Button
          title={t("got_it")}
          onPress={handleGotIt}
          size={px(34)}
          shape="r10"
        />
      </DmView>
    </DmView>
  )
}

export default TooltipComponent
