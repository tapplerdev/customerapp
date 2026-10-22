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
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:166 | DmText | `font-custom800` | no face for weight 800 in English or Arabic: DmText draws the system face |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:170 | DmText | `font-custom800` | no face for weight 800 in English or Arabic: DmText draws the system face |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:170 | DmText | `leading-[18]` | unitless arbitrary line height; NativeWind 2 emits nothing for it (leading-[Npx] works) |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:183 | DmView | `rounded-[12]` | Tailwind generates "border-radius: 12", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[12px], is what maps) |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:186 | DmView | `rounded-[12]` | Tailwind generates "border-radius: 12", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[12px], is what maps) |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:364 | DmText | `font-custom800` | no face for weight 800 in English or Arabic: DmText draws the system face |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:385 | DmView | `rounded-[12]` | Tailwind generates "border-radius: 12", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[12px], is what maps) |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:394 | DmView | `rounded-[12]` | Tailwind generates "border-radius: 12", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[12px], is what maps) |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:433 | DmText | `font-custom800` | no face for weight 800 in English or Arabic: DmText draws the system face |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:454 | DmView | `rounded-[12]` | Tailwind generates "border-radius: 12", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[12px], is what maps) |
| src/screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen.tsx:472 | ActionBtn | `rounded-[12]` | Tailwind generates "border-radius: 12", which NativeWind 2.0.11 has no React Native style for (a bare number; the px form, rounded-[12px], is what maps) |
