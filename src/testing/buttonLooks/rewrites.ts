/**
 * Jest only. The values the ActionBtn harvest (./harvest) can't read at a
 * site, because the site forwards something its own callers decide, written
 * out here with where they come from.
 *
 * Keyed by `<file under src>:<line of the ActionBtn tag>`; inside, by the
 * expression as written at the site (whitespace collapsed). A value is an
 * expression in the same language the harvest evaluates: `oneOf(a, b, ...)`
 * is one condition with those outcomes, and a bare name (`onRed`) is a fresh
 * condition shared by every rewrite of the element, which is how values that
 * move together (a tone's variant and its classes) stay together.
 *
 * The harvest fails on a rewrite that matches nothing, and on a site that
 * moved, so this table can't silently go stale.
 */
export type Rewrite = {
  why: string
  values: Record<string, string>
}

export const REWRITES: Record<string, Rewrite> = {
  "components/DashboardCategoryItem/DashboardCategoryItem.tsx:64": {
    why: "Nothing in src renders DashboardCategoryItem (Home moved to HomeStatusBadge), so its variant is every value its btnVariant type allows.",
    values: {
      btnVariant: 'oneOf(undefined, "white", "bordered", "grey", "yellow")',
    },
  },
  "components/MyProfileSettingsComponent/MyProfileSettingsComponent.tsx:199": {
    why: "classNameBtn: only MyProfileScreen.tsx:1030 passes one. variant: actionBtnVariantForStatus (utils/badgeStatus) returns undefined, yellow or grey, and the element renders for any status but approved.",
    values: {
      classNameBtn: 'oneOf(undefined, "mt-[4] ml-[0]")',
      "actionBtnVariantForStatus(status)": 'oneOf(undefined, "yellow", "grey")',
    },
  },
  "components/MyServiceDetailItem/MyServiceDetailItem.tsx:109": {
    why: "From its callers (MyServiceDetailScreen, ServiceSetupFoodScreen, MyDocumentsScreen): border-red comes only with the white variant (MyServiceDetailScreen.tsx:802, ServiceSetupFoodScreen.tsx:491 and :505); otherwise there is no classNameBtn and btnVariant is undefined, grey, yellow, red (MyServiceDetailScreen.tsx:647, not a variant ActionBtn knows, so it draws the default) or actionBtnVariantForStatus's undefined / yellow / grey.",
    values: {
      classNameBtn: 'whiteRed ? "border-red" : undefined',
      btnVariant:
        'whiteRed ? "white" : oneOf(undefined, "grey", "yellow", "red")',
    },
  },
  "components/SettingsItem/SettingsItem.tsx:75": {
    why: "Only SettingScreen.tsx:261 passes a btnVariant, through actionBtnVariantForStatus (undefined, yellow or grey).",
    values: {
      btnVariant: 'oneOf(undefined, "yellow", "grey")',
    },
  },
  "screens/dashboardScreens/MyServiceDocumentsStatusScreen/components/DocumentStatusCard.tsx:48":
    {
      why: "The element renders only for pending (grey) or rejected (yellow).",
      values: {
        "actionBtnVariantForStatus(status)": 'oneOf("grey", "yellow")',
      },
    },
  "screens/dashboardScreens/foodScreens/FoodMenuScreen/FoodMenuScreen.tsx:802":
    {
      why: "getPublishButtonStyle (the useMemo at FoodMenuScreen.tsx:185) is one of two objects: a known menu status (red) or any other (grey4, white label, disabled).",
      values: {
        "getPublishButtonStyle.className":
          'menuKnown ? "rounded-5 w-full h-[44]" : "rounded-5 w-full h-[44] bg-grey4"',
        "getPublishButtonStyle.textClassName":
          'menuKnown ? "text-13 leading-[16px] font-custom600" : "text-13 leading-[16px] font-custom600 text-white"',
        "getPublishButtonStyle.disabled": "!menuKnown",
      },
    },
  "components/ModalButtons/ModalButtons.tsx:114": {
    why: "ModalButtons' LOOKS table, per tone (onRed or default); the spec's Icon and IconNearTitle are any icon or none, onPress may be absent, and an onRed primary takes no isLoading (its type).",
    values: {
      "primary.onPress": "primaryPress ? () => undefined : undefined",
      "primary.isLoading": "onRed ? undefined : primaryBusy",
      "primary.Icon": "primaryIcon ? <Glyph /> : undefined",
      "primary.IconNearTitle": "primaryArrow ? <Arrow /> : undefined",
      "look.primary.variant": 'onRed ? "white" : undefined',
      "look.primary.classNameWithIcon":
        'onRed ? "h-[44] rounded-8 border-0 px-[12]" : "h-[44] rounded-8 px-[12]"',
      "look.primary.className":
        'onRed ? "h-[44] rounded-8 border-0" : "h-[44] rounded-8"',
      "look.primary.textClassName":
        'onRed ? "text-15 leading-[19px] font-custom600 text-red" : "text-15 leading-[19px] font-custom600"',
    },
  },
  "components/ModalButtons/ModalButtons.tsx:128": {
    why: "ModalButtons' LOOKS table, per tone; the secondary is always the white variant; its Icon is any icon or none and onPress may be absent.",
    values: {
      "secondary.onPress": "secondaryPress ? () => undefined : undefined",
      "secondary.Icon": "secondaryIcon ? <Glyph /> : undefined",
      "look.secondary.variant": '"white"',
      "look.secondary.classNameWithIcon":
        'onRed ? "mt-[12] h-[44] rounded-8 bg-transparent border-1 border-white px-[12]" : "mt-[12] h-[44] rounded-8 px-[12]"',
      "look.secondary.className":
        'onRed ? "mt-[12] h-[44] rounded-8 bg-transparent border-1 border-white" : "mt-[12] h-[44] rounded-8"',
      "look.secondary.textClassName":
        'onRed ? "text-15 leading-[19px] font-custom600 text-white" : "text-15 leading-[19px] font-custom600"',
    },
  },
}
