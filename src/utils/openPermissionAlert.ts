import { Alert } from "react-native"
import { openSettings } from "react-native-permissions"
import i18n from "i18next"

export const openPermissionAlert = () => {
  const t = i18n.t.bind(i18n)
  Alert.alert(t("permission_denied"), t("please_grant_permission_descr"), [
    { text: t("cancel"), style: "cancel" },
    { text: t("go_to_settings"), onPress: () => openSettings() },
  ])
}
