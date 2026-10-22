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
| src/screens/dashboardScreens/AccountScreen/AccountScreen.tsx:172 | DmView | `items-left` | unknown class: neither Tailwind's defaults nor tailwind.config.js define it |
| src/screens/dashboardScreens/AccountScreen/AccountScreen.tsx:297 | DmView | `items-left` | unknown class: neither Tailwind's defaults nor tailwind.config.js define it |
