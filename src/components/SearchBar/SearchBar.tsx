import React from "react"
import { TextInput, TouchableOpacity } from "react-native"
import { useTranslation } from "react-i18next"

import { DmView } from "@tappler/shared/src/components/UI"
import colors from "@tappler/shared/src/styles/colors"
import { takeFontStyles } from "@tappler/shared/src/helpers/helpers"

import SearchIcon from "assets/icons/search-red.svg"
import CategoriesIcon from "assets/icons/categories.svg"
import { Text, a } from "@tappler/shared/src/ds"
import styles from "./styles"

interface Props {
  value?: string
  onChangeText?: (text: string) => void
  onSubmit?: () => void
  onPress?: () => void
  onFilterPress?: () => void
  placeholder?: string
}

const SearchBar: React.FC<Props> = ({
  value,
  onChangeText,
  onSubmit,
  onPress,
  onFilterPress,
  placeholder,
}) => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === "ar"
  const fontStyles = takeFontStyles("font-custom400", i18n.language)

  return (
    <DmView style={[a.flex_row, a.items_center, a.mt_10, a.mx_16]}>
      <DmView
        onPress={onPress}
        style={[a.flex_1, styles.row, a.flex_row, a.items_center, a.px_14, {
          borderRadius: 21,
          borderWidth: 1,
          borderColor: "#E0E0E0",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
          elevation: 3,
        }]}
      >
        <SearchIcon width={16} height={16} />
        {onPress ? (
          <Text
            size={14}
            leading="legacy"
            style={[
              a.flex_1,
              {
                marginHorizontal: 8,
                color: colors.grey3,
                textAlign: isAr ? "right" : "left",
              },
            ]}
          >
            {placeholder ?? t("search_for_a_service")}
          </Text>
        ) : (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            placeholder={placeholder ?? t("search_for_a_service")}
            placeholderTextColor={colors.grey3}
            style={[
              fontStyles,
              {
                flex: 1,
                marginHorizontal: 8,
                fontSize: 14,
                color: colors.black,
                textAlign: isAr ? "right" : "left",
                padding: 0,
              },
            ]}
            returnKeyType="search"
          />
        )}
      </DmView>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onFilterPress}
        style={[styles.iconWrap, a.items_center, a.justify_center]}
      >
        <CategoriesIcon width={32} height={30} style={isAr ? { transform: [{ scaleX: -1 }] } : undefined} />
      </TouchableOpacity>
    </DmView>
  )
}

export default SearchBar
