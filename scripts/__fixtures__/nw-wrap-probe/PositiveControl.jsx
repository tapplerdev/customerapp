import React from "react"
import { ActionBtn, DmText } from "@tappler/shared/src/components/UI"
import DmTextByPath from "@tappler/shared/src/components/UI/DmText/DmText"
import { classNameSlot } from "@tappler/shared/src/components/classNameSlots"
import MainModal from "components/MainModal"
import { useTranslation } from "react-i18next"

const summarize = (user, isAr) => ({
  name: isAr ? user?.nameAr : user?.name,
  typeKey: user?.type ? `account_type_${user.type}` : undefined,
  memberSince: user?.createdAt,
})

export const ThroughTemporaries = ({ user }) => {
  const { t, i18n } = useTranslation()
  const profile = summarize(user, i18n.language === "ar")

  return (
    <MainModal className="flex-row items-center mt-[23] pl-[19]" isVisible>
      <ActionBtn className="ml-[10] flex-1">
        {!!profile.name && (
          <DmText className="text-16 leading-[20px] font-custom600">
            {profile.name}
          </DmText>
        )}
        {!!profile.typeKey && (
          <DmText className="text-12 leading-[17px] font-custom400">
            {t(profile.typeKey)}
          </DmText>
        )}
        {!!profile.memberSince && (
          <DmText className="text-12 leading-[17px] font-custom400">
            {t("settings_member_since", { date: profile.memberSince })}
          </DmText>
        )}
      </ActionBtn>
    </MainModal>
  )
}

export const ByFilePath = () => (
  <DmTextByPath className="text-14 font-custom600">x</DmTextByPath>
)

const Row = ({ className, children }) => (
  <DmText className={className}>{children}</DmText>
)
export const LocalConsumer = () => <Row className="mt-[4]">x</Row>

// A className slot is wrapped on purpose, but over a consumer it is the same
// bug: NativeWind hands the slot style, and DmText never sees the classes
// its font layer reads.
const Title = classNameSlot(DmText)
export const SlotOverConsumer = () => (
  <Title className="text-16 font-custom600">x</Title>
)
