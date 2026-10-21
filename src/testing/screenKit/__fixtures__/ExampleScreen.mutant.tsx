/*
 * Jest only: ExampleScreen converted with one point off (the count's top
 * margin 5 for 4), which workflow.parity.tsx must catch.
 */
import React from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Button, Text, px } from "@tappler/shared/src/ds"
import colors from "@tappler/shared/src/styles/colors"
import { useTypedSelector } from "store"
import { useGetBadgeCountsQuery } from "services/api"

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: "0%",
    backgroundColor: colors.white,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 20,
  },
  count: { marginTop: 5 },
  button: { marginTop: 24 },
})

const ExampleScreenMutant = () => {
  const { t } = useTranslation()
  const user = useTypedSelector((state) => state.auth.user)
  const { data, isLoading } = useGetBadgeCountsQuery()
  return (
    <View style={styles.screen}>
      <Text size={15} weight="semibold" leading={px(19)}>
        {user?.firstName}
      </Text>
      <Text
        size={13}
        weight="regular"
        leading={px(16)}
        color="disabledButton"
        style={styles.count}
      >
        {isLoading ? "…" : `${t("leads")}: ${data?.newLeads ?? 0}`}
      </Text>
      <Button
        title={t("leads")}
        onPress={() => undefined}
        style={styles.button}
      />
    </View>
  )
}

export default ExampleScreenMutant
