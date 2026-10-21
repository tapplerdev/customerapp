/*
 * Jest only: the screen workflow.parity.tsx walks through the W2 method on
 * (README in src/testing). Written the way a customerapp screen is before W2: class
 * names, DmText/DmView, ActionBtn, data from the store and the API.
 */
import React from "react"
import { useTranslation } from "react-i18next"

import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"
import { useTypedSelector } from "store"
import { useGetChatsQuery } from "services/api"

const ExampleScreen = () => {
  const { t } = useTranslation()
  const user = useTypedSelector((state) => state.auth.user)
  const { data, isLoading } = useGetChatsQuery()
  return (
    <DmView className="flex-1 bg-white px-[16] pt-[20]">
      <DmText className="text-15 leading-[19px] font-custom600">
        {user?.firstName}
      </DmText>
      <DmText className="mt-[4] text-13 leading-[16px] font-custom400 text-grey10">
        {isLoading ? "…" : `${t("messages")}: ${data?.data.length ?? 0}`}
      </DmText>
      <ActionBtn
        className="mt-[24]"
        title={t("messages")}
        onPress={() => undefined}
      />
    </DmView>
  )
}

export default ExampleScreen
