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
| src/components/ImageWithCheckmarkButton/ImageWithCheckmarkButton.tsx:43 | DmView | `rounded-[8]` | Tailwind generates "border-radius: 8", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[8px], is what maps) |
| src/components/ImageWithTextButton/ImageWithTextButton.tsx:37 | DmView | `rounded-[8]` | Tailwind generates "border-radius: 8", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[8px], is what maps) |
| src/components/LogoutModal/LogoutModal.tsx:47 | MainModal | `font-custom700` | font-customNNN works only on DmText and ActionBtn (their takeFontStyles); here NativeWind emits nothing for it |
| src/components/MessagesComponent/MessagesComponent.tsx:158 | DmView | `rounded-[3]` | Tailwind generates "border-radius: 3", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[3px], is what maps) |
