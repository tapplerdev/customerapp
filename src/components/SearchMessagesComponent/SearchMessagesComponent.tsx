import React from "react"
import { DmInput, DmView } from "@tappler/shared/src/components/UI"
import { Controller, useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import SearchIcon from "assets/icons/search-red.svg"
import { px } from "@tappler/shared/src/ds"
import styles from "./styles"

interface Props {
  searchText: string
  onChangeText: (text: string) => void
}

const SearchMessagesComponent: React.FC<Props> = ({
  searchText,
  onChangeText,
}) => {
  const { t } = useTranslation()
  const { control } = useForm({
    defaultValues: {
      searching: searchText,
    },
  })

  return (
    <DmView style={[styles.container, { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }]}>
      <Controller
        control={control}
        rules={{ required: true }}
        render={({ field: { value, onChange } }) => (
          <DmInput
            isAnimText={false}
            Icon={<SearchIcon />}
            height={39}
            containerStyle={styles.containerContainer}
            inputType={{ size: 15, arabicLeading: px(19) }}
            value={searchText}
            placeholder={t("search_messages")}
            onChangeText={(text) => {
              onChange(text)
              onChangeText(text)
            }}
          />
        )}
        name="searching"
      />
    </DmView>
  )
}

export default SearchMessagesComponent
