# Latent bugs the design-system codemod found

Classes NativeWind 2 drops today, and typography in a DmText's style that
DmText's font layer draws over: they render nothing, so pass 1 of the
StyleSheet migration leaves them out to stay pixel-identical, and this file is
the only place they survive. Pass 2 decides what each one meant and fixes it on
purpose, with a screenshot.

`yarn ds:codemod` appends a row per dropped class (or style key) per converted
site, sorted by file. The line is the file's line BEFORE conversion
(`git show <base>:<file>`). On a merge conflict keep both sides: rows never
repeat.

| Site | Element | Class | Why it renders nothing |
| --- | --- | --- | --- |
| src/screens/PickAddressScreen/components/MapPickerWithSearchView.tsx:577 | DmView | `rounded-[12]` | Tailwind generates "border-radius: 12", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[12px], is what maps) |
| src/screens/dashboardScreens/AccountScreen/AccountScreen.tsx:172 | DmView | `items-left` | unknown class: neither Tailwind's defaults nor tailwind.config.js define it |
| src/screens/dashboardScreens/AccountScreen/AccountScreen.tsx:297 | DmView | `items-left` | unknown class: neither Tailwind's defaults nor tailwind.config.js define it |
| src/screens/dashboardScreens/AddNewAddressScreen/AddNewAddressScreen.tsx:132 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/AddNewAddressScreen/AddNewAddressScreen.tsx:152 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/AddNewAddressScreen/AddNewAddressScreen.tsx:172 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/AddNewAddressScreen/AddNewAddressScreen.tsx:192 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/AuthGateScreen/AuthGateScreen.tsx:62 | DmView | `rounded-[20]` | Tailwind generates "border-radius: 20", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[20px], is what maps) |
| src/screens/dashboardScreens/AuthGateScreen/AuthGateScreen.tsx:71 | DmText | `font-custom800` | no face for weight 800 in English or Arabic: DmText draws the system face |
| src/screens/dashboardScreens/AuthGateScreen/AuthGateScreen.tsx:84 | DmView | `rounded-[12]` | Tailwind generates "border-radius: 12", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[12px], is what maps) |
| src/screens/dashboardScreens/AuthGateScreen/AuthGateScreen.tsx:108 | DmView | `rounded-[26]` | Tailwind generates "border-radius: 26", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[26px], is what maps) |
| src/screens/dashboardScreens/AuthGateScreen/AuthGateScreen.tsx:117 | DmView | `rounded-[26]` | Tailwind generates "border-radius: 26", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[26px], is what maps) |
| src/screens/dashboardScreens/ChangePasswordScreen/ChangePasswordScreen.tsx:105 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/ChangePasswordScreen/ChangePasswordScreen.tsx:126 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/ChangePasswordScreen/ChangePasswordScreen.tsx:152 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/DeleteAccountScreen/DeleteAccountScreen.tsx:85 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/MyInformationScreen/MyInformationScreen.tsx:86 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/MyInformationScreen/MyInformationScreen.tsx:104 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/UpdateEmailScreen/UpdateEmailScreen.tsx:123 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/screens/dashboardScreens/UpdateEmailScreen/UpdateEmailScreen.tsx:154 | TextInput | `font-custom400` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
