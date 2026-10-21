/**
 * ds:codemod, rule by rule, on source text: what it writes, what it leaves
 * and why. That the output draws exactly what the input drew is proved by
 * rendering (scripts/ds-codemod/parity/, its own jest config); these tests pin
 * the shape of the output and the reasons, quickly, in `yarn test:pass1-tools`.
 * customerapp's own call sites where it has the shape (file:line at e30b19a);
 * proapp's where it doesn't, marked as proapp's.
 */
const { execFileSync } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const { convertSource } = require("../ds-codemod/convert")
const { appendLatent, run } = require("../ds-codemod")
const { emulateText } = require("../ds-codemod/dmtext")
const { loadDs } = require("../ds-codemod/dsload")
const { resolveDmText } = require("../nw-resolve")

const ROOT = path.resolve(__dirname, "..", "..")
// A file that doesn't exist: no co-located styles.ts, imports resolve as in src.
const FILE = path.join(ROOT, "src", "__ds_codemod_unit__", "Unit.tsx")
const SLOTS = path.join(ROOT, "scripts", "__fixtures__", "ds-codemod", "slots")

const UI =
  'import { ActionBtn, DmText, DmView } from "@tappler/shared/src/components/UI"\n'

// `proven`: the ActionBtn looks a parity has drawn, for the site under test
// (customerapp has proven none yet, so without this every ActionBtn waits);
// "all": every look the site makes, for a test whose subject isn't the proof.
const convert = (
  body,
  { file = FILE, header = UI, extra = "", proven = null } = {}
) => {
  const code = `import React from "react"\n${extra}${header}\nexport const X = ({ on, n, cb }: any) => (\n${body}\n)\n`
  const run = (looks) =>
    convertSource(code, file, { wraps: [], provenLooks: looks })
  let result = run(proven === "all" ? [] : proven)
  if (proven === "all") {
    const looks = []
    const unproven = () =>
      result.sites.find((x) => x.reason === "unproven-look")
    for (let i = 0; unproven() && i < 64; i++) {
      looks.push(JSON.parse(unproven().detail.match(/\((\{.*\})\)/)[1]))
      result = run(looks)
    }
  }
  return { ...result, input: code }
}

const site = (r, attr = "className") =>
  r.sites.find((s) => s.attr === attr) || r.sites[0]

describe("rule 1: DmText -> Text", () => {
  it("maps size, a leading step, weight from font-customNNN, a colour token", () => {
    const r = convert(
      '<DmText className="text-13 leading-[16px] font-custom600 text-red">x</DmText>'
    )
    expect(r.code).toContain(
      '<Text size={13} weight="semibold" leading="tight" color="brand">x</Text>'
    )
    expect(site(r).status).toBe("converted")
  })

  it("writes px() for a leading that is no step, legacy for none, and omits defaults", () => {
    const r = convert(
      '<DmView><DmText className="text-13 leading-[22px] font-custom400">a</DmText><DmText className="text-16 font-custom400">b</DmText><DmText>c</DmText></DmView>'
    )
    expect(r.code).toContain("<Text size={13} leading={px(22)}>a</Text>")
    expect(r.code).toContain('<Text size={16} leading="legacy">b</Text>')
    expect(r.code).toContain('<Text size={14} leading="legacy">c</Text>')
    expect(r.code).toMatch(
      /import \{ Text, px \} from "@tappler\/shared\/src\/ds"/
    )
  })

  it("keeps DmText's Arabic rule: px() is x1.32 in Arabic, legacy is not", () => {
    const ds = loadDs()
    const px = emulateText(ds, "ar", {
      size: 13,
      weight: "regular",
      family: "auto",
      leading: { px: 22 },
    })
    expect(px.lineHeight).toBe(
      resolveDmText("text-13 leading-[22px] font-custom400", { lang: "ar" })
        .style.lineHeight
    )
    expect(px.lineHeight).toBe(22 * 1.32)
    const legacy = emulateText(ds, "ar", {
      size: 16,
      weight: "regular",
      family: "auto",
      leading: "legacy",
    })
    expect(legacy.lineHeight).toBe(
      resolveDmText("text-16 font-custom400", { lang: "ar" }).style.lineHeight
    )
    expect(legacy.lineHeight).toBe(19)
  })

  it("puts a colour that is no token, and spacing, in style: atoms, then a StyleSheet entry", () => {
    const r = convert(
      '<DmText className="mt-[10] px-[15] text-12 leading-[16px] font-custom500 text-grey28">x</DmText>'
    )
    expect(r.code).toContain("style={[a.mt_10, styles.text]}")
    expect(r.styles.code).toContain("paddingLeft: 15")
    expect(r.styles.code).toContain("color: colors.grey28")
    expect(r.styles.code).toContain(
      'import colors from "@tappler/shared/src/styles/colors"'
    )
  })

  it("writes a step its other sizes lack as px() when the size has a condition", () => {
    const r = convert(
      '<DmText className={on ? "text-30 leading-[36px]" : "text-20 leading-[26px]"}>x</DmText>'
    )
    // LeadingFor<30 | 20> is only "tight": 20's "normal" (26) goes as px(26), the same in ar
    expect(r.code).toContain("size={on ? 30 : 20}")
    expect(r.code).toContain('leading={on ? "tight" : px(26)}')
  })

  it("keeps the caller's style after the class styles, and the other props", () => {
    const r = convert(
      '<DmText className="mt-[4] text-13 font-custom400" style={{ opacity: 0.5 }} numberOfLines={2}>x</DmText>'
    )
    expect(r.code).toContain("style={[a.mt_4, { opacity: 0.5 }]}")
    expect(r.code).toContain("numberOfLines={2}")
  })

  it("converts nested DmText as nested Text", () => {
    const r = convert(
      '<DmText className="text-13 leading-[20px] font-custom400">a <DmText className="font-custom700 text-red">b</DmText></DmText>'
    )
    expect(r.code).toContain(
      '<Text size={13} leading="loose">a <Text size={14} weight="bold" leading="legacy" color="brand">b</Text></Text>'
    )
  })

  it("leaves a pressable DmText, with its reason", () => {
    const r = convert('<DmText className="text-13" onPress={cb}>a</DmText>')
    expect(r.sites.map((s) => s.reason)).toEqual(["pressable-dmtext"])
    expect(r.code).toContain("<DmText")
  })

  const SHEET =
    'import { StyleSheet } from "react-native"\n' +
    'import { takeFontFamily } from "@tappler/shared/src/helpers/helpers"\n' +
    "const local = StyleSheet.create({\n" +
    "  big: { fontSize: 22 },\n" +
    '  retry: { color: "#FFFFFF", fontSize: 13, textDecorationLine: "underline" },\n' +
    '  heavy: { fontSize: 13, fontWeight: "700" },\n' +
    "})\n"

  it("moves typography in the element's style into the props where that is exact, and keeps the rest as its style", () => {
    const r = convert(
      [
        "<DmView>",
        // classes, then style, then the font layer: 13 over the guard's 14,
        // the guard's 22 kept, which is legacy at 13
        "<DmText style={{ fontSize: 13, color: cb, marginLeft: 4 }}>a</DmText>",
        '<DmText className="mt-[2] font-custom400" style={{ fontSize: 11, lineHeight: 14, color: "#8C8C8C" }}>b</DmText>',
        // a StyleSheet entry that was all typography: the attribute goes
        '<DmText className="text-13 font-custom400" style={local.big}>c</DmText>',
        // one with more: what isn't typography is written again
        '<DmText className="font-custom600" style={local.retry}>d</DmText>',
        // takeFontFamily, run per language: TheSans in English too
        '<DmText className="text-13" style={takeFontFamily("font-custom600", "ar")}>e</DmText>',
        "</DmView>",
      ].join(""),
      { extra: SHEET }
    )
    expect(r.code).toContain(
      '<Text size={13} leading="legacy" style={{ color: cb, marginLeft: 4 }}>a</Text>'
    )
    expect(r.code).toContain(
      '<Text size={11} leading="legacy" style={[a.mt_2, { color: "#8C8C8C" }]}>b</Text>'
    )
    expect(r.code).toContain('<Text size={22} leading="legacy">c</Text>')
    expect(r.code).toContain(
      '<Text size={13} weight="semibold" leading="legacy" style={styles.text}>d</Text>'
    )
    expect(r.styles.code).toContain('textDecorationLine: "underline"')
    expect(r.styles.code).not.toContain("fontSize")
    expect(r.code).toContain(
      '<Text size={13} weight="semibold" leading="legacy" family="arabic">e</Text>'
    )
    // its last call is gone, so is the import; the StyleSheet stays
    expect(r.code).not.toContain("takeFontFamily")
    expect(r.code).toContain("const local = StyleSheet.create")
    expect(r.sites.every((x) => x.status === "converted")).toBe(true)
    expect(r.sites.every((x) => x.flags.styleTypography)).toBe(true)
  })

  it("keeps a line height the style sets, in both languages, as { fixed: px(n) }", () => {
    // proapp's ScreenNameInfoScreen shape: the style's 16 is unscaled in Arabic
    const r = convert(
      '<DmText className="text-black font-custom400 flex-1" style={{ fontSize: 13, lineHeight: 16 }}>b</DmText>'
    )
    expect(r.code).toContain(
      "<Text size={13} leading={{ fixed: px(16) }} style={a.flex_1}>b</Text>"
    )
    // and a size class over the text's own leading-[n]: { legacy: px(n) }
    const size = convert(
      '<DmText className="leading-[14px] text-16 font-custom500">h</DmText>'
    )
    expect(size.code).toContain(
      '<Text size={16} weight="medium" leading={{ legacy: px(14) }}>h</Text>'
    )
  })

  it("lists a typography key in style that DmText's font layer draws over, as a latent bug", () => {
    const r = convert(
      '<DmText style={{ fontSize: 14, fontFamily: "monospace" }}>x</DmText>'
    )
    expect(r.code).toContain('<Text size={14} leading="legacy">x</Text>')
    expect(site(r, null).deadStyle).toEqual([
      {
        class: 'style fontFamily: "monospace"',
        reason:
          "DmText's font layer draws over it (en and ar), so it renders nothing",
      },
    ])
    expect(r.latent).toEqual([
      expect.objectContaining({
        line: 5,
        tag: "DmText",
        class: 'style fontFamily: "monospace"',
      }),
    ])
  })

  it("leaves typography in style that Text can't say, with reasons", () => {
    const r = convert(
      [
        "<DmView>",
        "<DmText style={local.heavy}>a</DmText>",
        '<DmText className="font-custom600" style={{ fontSize: n, lineHeight: n + 2 }}>c</DmText>',
        "<DmText style={{ fontSize: 9.5 }}>d</DmText>",
        "<DmText style={[local.big, { marginTop: 2 }]}>e</DmText>",
        "</DmView>",
      ].join(""),
      { extra: SHEET }
    )
    expect(r.sites.map((x) => [x.reason, x.detail])).toEqual([
      [
        "fontWeight-in-style",
        'fontWeight "700" in the element\'s style, which Text leaves to the face',
      ],
      [
        "dynamic-typography-in-style",
        "`fontSize` in the element's style isn't a constant",
      ],
      ["off-scale-size", "text size 9.5"],
      ["typography-in-style", "an array as a style with typography"],
    ])
    expect(r.code).not.toContain("<Text")
  })

  it("writes an off-scale size as px(), legacy as its default", () => {
    const r = convert(
      '<DmView><DmText className="text-25 leading-[30px] font-custom600">a</DmText><DmText className="text-17 font-custom500">b</DmText></DmView>'
    )
    expect(r.code).toContain(
      '<Text size={px(25)} weight="semibold" leading={px(30)}>a</Text>'
    )
    expect(r.code).toContain('<Text size={px(17)} weight="medium">b</Text>')
  })
})

describe("rule 1, customerapp's faces: Montserrat, the faces it doesn't ship, the weight it has no face for", () => {
  it("draws Latin text in shared's Montserrat: index.js registers nothing", () => {
    const ds = loadDs()
    expect(ds.latinRegistry).toBeNull()
    for (const [weight, face] of [
      ["regular", "Montserrat-Regular"],
      ["medium", "Montserrat-Medium"],
      ["semibold", "Montserrat-SemiBold"],
      ["bold", "Montserrat-Bold"],
    ])
      expect(ds.textStyle("en", 14, weight, "legacy", "auto").fontFamily).toBe(
        face
      )
  })

  it("leaves a face the app doesn't ship for a bridge: TheSans-Regular (font-sans400)", () => {
    // WelcomeScreen.tsx:83 (customerapp-plan CA5)
    const r = convert(
      '<DmText className="mt-[32] text-13 text-grey font-sans400 leading-[22px] text-center">x</DmText>'
    )
    expect(site(r)).toMatchObject({
      status: "left",
      reason: "unshipped-face",
      detail:
        "TheSans-Regular isn't a face the app ships, so the device draws the system face; no Text family writes that fontFamily (bridge it by hand)",
    })
    // and font-sans600's TheSans-SemiBold the same way
    expect(
      site(convert('<DmText className="text-14 font-sans600">x</DmText>'))
        .reason
    ).toBe("unshipped-face")
  })

  it("writes font-custom800 as the system face it draws, and lists it with the drops", () => {
    // AuthGateScreen.tsx:71: no 800 in either language, so no fontFamily
    const r = convert(
      '<DmText className="text-24 leading-[30px] font-custom800 text-black text-center">x</DmText>'
    )
    expect(r.code).toContain(
      '<Text size={24} align="center" family="system">x</Text>'
    )
    expect(site(r).dropped).toEqual([
      {
        class: "font-custom800",
        reason:
          "no face for weight 800 in English or Arabic: DmText draws the system face",
      },
    ])
    expect(r.latent.map((x) => x.class)).toEqual(["font-custom800"])
  })

  it("says which face DmText draws where another face class beside font-custom800 wins", () => {
    // DmText takes the last font-customNNN it has a face for, and a family
    // class (font-sans700) stands where it has none: not the system face
    // (review-ca-w0's low)
    const reasonOf = (className) =>
      convert(`<DmText className="${className}">x</DmText>`).latent.find(
        (x) => x.class === "font-custom800"
      ).reason
    expect(reasonOf("font-custom600 font-custom800 text-14")).toBe(
      "no face for weight 800 in English or Arabic: DmText draws Montserrat-SemiBold in English and TheSans-Bold in Arabic, from the element's other face class"
    )
    expect(reasonOf("font-sans700 font-custom800 text-14")).toBe(
      "no face for weight 800 in English or Arabic: DmText draws TheSans-Bold, from the element's other face class"
    )
  })

  it("writes the weight the classes name where TheSans draws two alike (font-sans700)", () => {
    // WelcomeScreen.tsx:49: TheSans-Bold in both languages, pinned
    const r = convert(
      '<DmText className="font-sans700 text-18 leading-[31px] text-center">x</DmText>'
    )
    expect(r.code).toContain(
      '<Text size={18} weight="bold" leading={px(31)} align="center" family="arabic">x</Text>'
    )
    // WelcomeScreen.tsx:52: Montserrat pinned in both
    const latin = convert(
      '<DmText className="mt-[11] font-montserrat600 text-18 leading-[22px] text-center">x</DmText>'
    )
    expect(latin.code).toContain(
      'weight="semibold" leading="tight" align="center" family="latin"'
    )
  })
})

describe("rule 2: ActionBtn -> Button", () => {
  // customerapp's own sites (file:line at e30b19a). No look is proven in its
  // config yet (skeptic H4), so each test hands the codemod the looks it
  // proves; with none, a site waits (the last test).
  const FOOD = 'className="h-[48]" textClassName="text-15 leading-[19px] font-custom600"'

  it("maps height, corners, the label and disable, by the tested translator", () => {
    // QuestionStepScreen.tsx:308
    const r = convert(
      '<ActionBtn title="Next" onPress={cb} disable={!on} className="h-[52] rounded-10" textClassName="text-16 font-custom600" />',
      { proven: "all" }
    )
    expect(r.code).toContain(
      '<Button title="Next" onPress={cb} disabled={!on} size={px(52)} shape="r10" labelWeight="semibold" />'
    )
    expect(r.sites.map((x) => x.status)).toEqual(["converted", "converted"])
  })

  it("names the loading look when the site's classes draw one", () => {
    // MapPickerView.tsx:177's Confirm: bg-grey4 under the spinner
    const r = convert(
      '<ActionBtn title="Confirm" onPress={cb} className={`h-[42] w-full ${ on ? "bg-grey4" : "" }`} textClassName="text-13 leading-[21px] font-custom600" isLoading={on} />',
      { proven: "all" }
    )
    expect(r.code).toContain(
      '<Button title="Confirm" onPress={cb} size="sm" label="sm" labelWeight="semibold" labelLeading={px(21)} loadingSurface="shade" style={a.w_full} isLoading={on} />'
    )
  })

  it("writes a prop that changes with a condition as that condition", () => {
    // UpdateMobileNumberScreen.tsx:160: the label greys while the number is bad
    const r = convert(
      '<ActionBtn title="Send" onPress={cb} disable={!on || n} isLoading={n} textClassName={clsx("text-13 leading-[16px] font-custom500", !on && "text-grey10")} className="h-[47] rounded-10" />',
      { extra: 'import clsx from "clsx"\n', proven: "all" }
    )
    expect(r.code).toContain(
      '<Button title="Send" onPress={cb} disabled={!on || n} isLoading={n} size="lg" shape="r10" label="sm" disabledLook={on ? n ? undefined : disabledLookLegacyMuted : disabledLookLegacyMuted} />'
    )
    expect(r.code).not.toContain("clsx")
  })

  it("renames the content props and keeps what they hold", () => {
    // AuthWelcomeScreen.tsx:128 and :163
    const r = convert(
      '<DmView><ActionBtn title="Email" onPress={cb} Icon={<DmView />} variant="white" className="rounded-10" textClassName="text-13" /><ActionBtn title="Guest" onPress={cb} descr={cb()} variant="white" className="mt-[66] rounded-10" textClassName="text-13" /></DmView>',
      { proven: "all" }
    )
    expect(r.code).toContain(
      '<Button title="Email" onPress={cb} icon={<DmView />} shape="r10" variant="white" label="sm" labelLeading="legacy" />'
    )
    expect(r.code).toContain(
      '<Button title="Guest" onPress={cb} description={cb()} shape="r10" variant="white" label="sm" labelLeading="legacy" style={styles.button} />'
    )
  })

  it("writes a label face the classes pin: WelcomeScreen's Latin and Arabic buttons", () => {
    // WelcomeScreen.tsx:61 (font-montserrat500) and :70 (font-sans700)
    const r = convert(
      '<DmView><ActionBtn title="English" onPress={cb} className="mr-[10] flex-1" textClassName="font-montserrat500" /><ActionBtn title="Arabic" onPress={cb} className="ml-[10] flex-1" textClassName="font-sans700" /></DmView>',
      { proven: "all" }
    )
    expect(r.code).toContain(
      '<Button title="English" onPress={cb} labelFamily="latin" style={[a.mr_10, a.flex_1]} />'
    )
    expect(r.code).toContain(
      '<Button title="Arabic" onPress={cb} labelWeight="bold" labelFamily="arabic" style={[a.ml_10, a.flex_1]} />'
    )
  })

  it("draws nothing for a class NativeWind drops: rounded-[12] keeps the 28 corners (skeptic H4)", () => {
    // RequestSummaryScreen.tsx:467
    const r = convert(
      '<ActionBtn title="Request" onPress={cb} isLoading={n} disable={on} className="h-[50] rounded-[12]" textClassName="text-16 font-custom700" />',
      { proven: "all" }
    )
    expect(r.code).toContain(
      '<Button title="Request" onPress={cb} isLoading={n} disabled={on} size={px(50)} labelWeight="bold" />'
    )
    expect(r.code).not.toContain("shape=")
    expect(site(r).dropped).toEqual([
      expect.objectContaining({ class: "rounded-[12]" }),
    ])
    expect(r.latent).toEqual([
      expect.objectContaining({
        tag: "ActionBtn",
        class: "rounded-[12]",
        reason: expect.stringContaining('"border-radius: 12"'),
      }),
    ])
  })

  it("writes a label step one of a conditional label's sizes lacks as its value", () => {
    const { sharedStepsOnly } = require("../ds-codemod/actionbtn")
    const ds = loadDs()
    // 9 has no loose: label={on ? 9 : 11} with "loose" at 11 is px(16)
    const combos = [
      { props: { label: 9 } },
      { props: { label: 11, labelLeading: "loose" } },
      { props: { label: "sm", labelLeading: "tight" } },
    ]
    expect(sharedStepsOnly(ds, combos)).toBe(true)
    expect(combos.map((c) => c.props.labelLeading)).toEqual([
      undefined,
      ds.LEADING[11].loose,
      "tight",
    ])
    // one size: every step it has is fine
    const one = [{ props: { label: 11, labelLeading: "loose" } }]
    expect(sharedStepsOnly(ds, one)).toBe(false)
  })

  it("names a disabled look by its surface, label and weight, a label-only one by its label", () => {
    const { lookName } = require("../ds-codemod/convert")
    expect(
      lookName({ surface: "legacy", label: "muted", labelWeight: "regular" })
    ).toBe("LegacyMutedRegular")
    expect(lookName({ surface: "shade", label: "inverse" })).toBe(
      "ShadeInverse"
    )
    expect(lookName({ label: "muted" })).toBe("Muted")
  })

  it("writes CA-W0-B's three spellings: bg-grey19 while disabled, opacity-50, a caller's red under the spinner", () => {
    const out = (body) =>
      convert(body, { extra: 'import clsx from "clsx"\n', proven: "all" })
    // AddNewAddressScreen.tsx:234 (and ChangePassword, MyInformation,
    // UpdateEmail): #E5E5E5 while disabled, Button's subtle state fill
    const save = out(
      '<ActionBtn title="Save" onPress={cb} className={`h-[42] w-full ${on ? "bg-red" : "bg-grey19"}`} textClassName="text-13 leading-[21px] font-custom600 text-white" disable={!on} />'
    )
    expect(save.code).toContain(
      '<Button title="Save" onPress={cb} size="sm" label="sm" labelWeight="semibold" labelLeading={px(21)} disabledLook={disabledLookSubtleInverse} style={a.w_full} disabled={!on} />'
    )
    expect(save.code).toContain(
      'const disabledLookSubtleInverse = { surface: "subtle", label: "inverse" } as const'
    )
    // FoodItemScreen.tsx:385: the whole button at half opacity, Button's dim
    expect(
      out(
        '<ActionBtn title="Add" onPress={cb} disable={on} className={clsx("mt-[23] h-[41]", on && "opacity-50")} textClassName="text-13 leading-[16px] font-custom600" />'
      ).code
    ).toContain(
      '<Button title="Add" onPress={cb} disabled={on} size={px(41)} label="sm" labelWeight="semibold" dim={on ? true : undefined} style={styles.button} />'
    )
    // GateRegisterScreen.tsx:222 and RegisterScreen.tsx:326: bg-red comes
    // after ActionBtn's grey, so the spinner sits on red: Button's brand
    // loading surface
    expect(
      out(
        '<ActionBtn title="Join" onPress={cb} className={`mt-[40] h-[44] ${on ? "bg-red" : ""}`} isLoading={n} disable={!on} />'
      ).code
    ).toContain(
      '<Button title="Join" onPress={cb} size="md" loadingSurface={on ? "brand" : undefined} style={a.mt_40} isLoading={n} disabled={!on} />'
    )
  })

  // CA-W0-B's 72 harvested prop sets (src/testing/buttonLooks/__fixtures__),
  // every look customerapp's sites draw, as the proof will list them.
  const B_LOOKS = Object.values(
    require("../../src/testing/buttonLooks/__fixtures__/ButtonLooks.cases.json")
      .looks
  ).map((l) => l.props)

  it("reads a flag and a class condition as the same facts, as the look harvest does", () => {
    // ChangePasswordScreen.tsx:167 and UpdateEmailScreen.tsx:164 (as
    // written), and MyInformationScreen.tsx:160: `disable` is the class
    // condition's negation, so no look is "bg-red and disabled" (review-ca-w0
    // M2); each converts to B's spelling, disabled and saving alike.
    for (const [body, disabled] of [
      [
        '<ActionBtn onPress={handleSave} className={`h-[42] w-full ${isFilled && !hasClientError && !isLoading ? "bg-red" : "bg-grey19"}`} title={t("send")} textClassName="text-13 leading-[21px] font-custom600 text-white" disable={!isFilled || hasClientError || isLoading} isLoading={isLoading} />',
        "!isFilled || hasClientError || isLoading",
      ],
      [
        '<ActionBtn onPress={handleSave} className={`h-[42] w-full ${hasChanges && !isLoading ? "bg-red" : "bg-grey19"}`} title={t("save")} textClassName="text-13 leading-[21px] font-custom600 text-white" disable={!hasChanges || isLoading} isLoading={isLoading} />',
        "!hasChanges || isLoading",
      ],
    ]) {
      const r = convert(body, { proven: B_LOOKS })
      expect(r.sites.map((x) => [x.status, x.reason])).toEqual([
        ["converted", undefined],
        ["converted", undefined],
      ])
      expect(r.code).toContain(
        `<Button onPress={handleSave} size="sm" label="sm" labelWeight="semibold" labelLeading={px(21)} disabledLook={disabledLookSubtleInverse} style={a.w_full} title={t("${disabled.includes("hasChanges") ? "save" : "send"}")} disabled={${disabled}} isLoading={isLoading} />`
      )
      expect(r.code).not.toContain("loadingSurface")
    }
  })

  it("draws a look with no onPress where onPress is undefined, as the look harvest does", () => {
    // FoodCheckoutScreen.tsx:843 and FoodItemScreen.tsx:385: `c ? fn :
    // undefined` gives ActionBtn no handler when c is false (review-ca-w0 M2)
    const checkout = convert(
      '<ActionBtn title={t("review_order")} className="h-[44]" textClassName="text-14 leading-[18px] font-custom600" disable={!canSubmit} onPress={canSubmit ? handleReviewOrder : undefined} />',
      { proven: B_LOOKS }
    )
    expect(checkout.code).toContain(
      '<Button title={t("review_order")} size="md" label={14} labelWeight="semibold" labelLeading="normal" disabled={!canSubmit} onPress={canSubmit ? handleReviewOrder : undefined} />'
    )
    const item = convert(
      '<ActionBtn disable={missingRequired} title={t("add")} className={clsx("mt-[23] h-[41]", missingRequired && "opacity-50")} textClassName="text-13 leading-[16px] font-custom600" onPress={missingRequired ? undefined : handleAddToCart} />',
      { extra: 'import clsx from "clsx"\n', proven: B_LOOKS }
    )
    expect(item.code).toContain(
      '<Button disabled={missingRequired} title={t("add")} size={px(41)} label="sm" labelWeight="semibold" dim={missingRequired ? true : undefined} style={styles.button} onPress={missingRequired ? undefined : handleAddToCart} />'
    )
    // `c && fn` is false, not undefined, when c is: said, not guessed
    expect(
      convert('<ActionBtn title="x" onPress={on && cb} />', { proven: "all" })
        .sites[0]
    ).toMatchObject({
      status: "left",
      reason: "actionbtn-unsupported-prop",
    })
  })

  it("still leaves a caller's paint over a state's fill that Button can't spell", () => {
    // red while disabled and not loading would be the disabled look's brand
    // surface: no customerapp site has it (CA-W0-B), so it has no spelling
    expect(
      convert(
        '<ActionBtn title="Red" onPress={cb} className="h-[44] bg-red" disable={on} />',
        { proven: "all" }
      ).sites.map((x) => [x.reason, x.detail])
    ).toEqual([
      [
        "actionbtn-look",
        "bg-red draws over ActionBtn's disabled fill (the caller's classes come last), where Button draws its disabled fill",
      ],
    ])
  })

  it("leaves a prop Button doesn't take, and any look no parity has drawn in customerapp's config", () => {
    const r = convert(
      `<DmView><ActionBtn title="a" onPress={cb} hitSlop={4} /><ActionBtn title="b" onPress={cb} className="h-[47] py-[4]" /><ActionBtn title="c" onPress={cb} ${FOOD} /></DmView>`
    )
    expect(r.sites.map((x) => [x.reason, x.detail.split(":")[0]])).toEqual([
      ["actionbtn-unsupported-prop", "`hitSlop` has no Button equivalent"],
      ["actionbtn-look", "a container class Button has no prop for"],
      ["unproven-look", "a look no Button parity has drawn in customerapp's config ({\"className\""],
      ["unproven-look", "a look no Button parity has drawn in customerapp's config ({\"className\""],
    ])
    // proven by a parity, the same site converts
    const look = {
      className: "h-[48]",
      onPress: true,
      textClassName: "text-15 leading-[19px] font-custom600",
    }
    const proven = convert(`<ActionBtn title="c" onPress={cb} ${FOOD} />`, {
      proven: [look],
    })
    expect(proven.code).toContain(
      '<Button title="c" onPress={cb} size={px(48)} label="md" labelWeight="semibold" />'
    )
  })

  it("reads the proven looks from the looks proof's cases file, none until it exists", () => {
    const { PROVEN, TRANSLATOR } = require("../ds-codemod/actionbtn")
    expect(path.relative(ROOT, PROVEN)).toBe(
      "src/testing/buttonLooks/__tests__/__parity__/Button.looks.cases.json"
    )
    expect(path.relative(ROOT, TRANSLATOR)).toBe(
      "src/testing/buttonLooks/__fixtures__/translate.ts"
    )
    // proapp's looks were drawn in Poppins: none of them came along
    expect(fs.existsSync(PROVEN)).toBe(false)
    expect(
      fs.existsSync(
        path.join(ROOT, "src/components/__tests__/ds/__parity__")
      )
    ).toBe(false)
  })
})

describe("rule 3: DmView and the hosts NativeWind styles", () => {
  it("uses atoms where an atom is exactly the output, in class order", () => {
    const r = convert('<DmView className="flex-1 px-[20] flex-row" />')
    expect(r.code).toContain(
      "<DmView style={[a.flex_1, a.px_20, a.flex_row]} />"
    )
    expect(r.styles).toBeNull()
  })

  it("names every colour: shared's palette, then customerapp's dsColors, the class's own name first", () => {
    // MapPinPicker.tsx:47/:49, CalendarTimePicker.tsx:200, a shared colour
    const r = convert(
      '<DmView><DmView className="bg-grey26" /><DmView className="bg-red7" /><DmView className="bg-blue2" /><DmView className="bg-red/10" /><DmView className="bg-grey55" /></DmView>'
    )
    expect(r.styles.code).toContain("backgroundColor: colors.grey26")
    expect(r.styles.code).toContain("backgroundColor: dsColors.red7")
    expect(r.styles.code).toContain("backgroundColor: dsColors.blue2")
    expect(r.styles.code).toContain("backgroundColor: dsColors.redAlpha10")
    // shared's grey55 is another colour: the app's own, under its own name
    expect(r.styles.code).toContain("backgroundColor: dsColors.grey55Class")
    expect(r.styles.code).toContain(
      'import colors from "@tappler/shared/src/styles/colors"'
    )
    expect(r.styles.code).toContain('import dsColors from "styles/dsColors"')
    expect(r.styles.code).not.toMatch(/"#/)
  })

  it("leaves a site whose colour nothing names, rather than write it out", () => {
    const r = convert('<DmView className="mt-[4] bg-[#123456]" />')
    expect(site(r)).toMatchObject({
      status: "left",
      reason: "colour-not-a-token",
    })
    expect(site(r).detail).toMatch(
      /^backgroundColor #123456 \(bg-\[#123456\]\) is in neither/
    )
    expect(r.styles).toBeNull()
  })

  it("keeps NativeWind's flex-1, never React Native's flex: 1", () => {
    const { a } = loadDs()
    expect(a.flex_1).toEqual({ flexGrow: 1, flexShrink: 1, flexBasis: "0%" })
  })

  it("puts the class styles before the element's own style, and an animated style stays last", () => {
    const r = convert(
      '<Animated.View className="absolute mt-[4]" style={[{ zIndex: 3 }, fade]} />',
      {
        extra: 'import Animated from "react-native-reanimated"\n',
      }
    )
    expect(r.code).toContain(
      "<Animated.View style={[a.absolute, a.mt_4, { zIndex: 3 }, fade]} />"
    )
  })

  it("converts a React Native host the same way", () => {
    const r = convert('<View className="h-[1] bg-grey19" />', {
      extra: 'import { View } from "react-native"\n',
    })
    // the element a component returns is its `container`
    expect(r.code).toContain("<View style={styles.container} />")
    expect(r.styles.code).toMatch(
      /container: \{\s+height: 1,\s+backgroundColor: colors.grey19,/
    )
  })
})

describe("rule 4: conditions", () => {
  it("keeps clsx's parts and conditions, in order", () => {
    const r = convert(
      '<DmView className={clsx("border-b-1", on && "pb-[20]", n > 2 ? "bg-red" : "bg-grey7")} />',
      { extra: 'import clsx from "clsx"\n' }
    )
    // `on` may not be a boolean (0 in a style array doesn't type-check), so a ternary;
    // a comparison is, so `&&` would do, but a ternary reads the same
    expect(r.code).toContain(
      "style={[a.border_b_1, on ? a.pb_20 : undefined, n > 2 ? styles.containerN : styles.containerNotN]}"
    )
  })

  it("joins transforms the way NativeWind does, one style per combination when they're in two parts", () => {
    const one = convert(
      '<DmView className={clsx(on && "rotate-[180deg] scale-y-[-1]")} />',
      { extra: 'import clsx from "clsx"\n' }
    )
    expect(one.styles.code).toContain(
      'transform: [{ rotate: "180deg" }, { scaleY: -1 }]'
    )
    const two = convert(
      '<DmView className={clsx("rotate-[90deg]", on && "scale-x-[-1]")} />',
      { extra: 'import clsx from "clsx"\n' }
    )
    expect(two.code).toMatch(/style=\{on \? styles\.\w+ : styles\.\w+\}/)
    expect(two.styles.code).toContain(
      'transform: [{ rotate: "90deg" }, { scaleX: -1 }]'
    )
  })

  it("reports what it can't read", () => {
    const r = convert("<DmView className={cb} />")
    expect(site(r)).toMatchObject({ status: "left", reason: "dynamic" })
  })

  it("lets a condition that calls something move, never run more often", () => {
    const once = convert(
      '<DmView className={clsx(on.includes("x") && "mt-[4]")} />',
      { extra: 'import clsx from "clsx"\n' }
    )
    expect(site(once).status).toBe("converted")
    const twice = convert(
      '<DmText className={clsx("text-13", on.includes("x") && "font-custom600 text-red")}>x</DmText>',
      {
        extra: 'import clsx from "clsx"\n',
      }
    )
    expect(site(twice)).toMatchObject({
      status: "left",
      reason: "impure-condition",
    })
  })
})

describe("rule 5: a component's className prop waits for its slot", () => {
  const file = path.join(SLOTS, "Unit.tsx")
  const header =
    'import { DmView } from "@tappler/shared/src/components/UI"\nimport Box from "./Box"\nimport Card from "./Card"\nimport Plain from "./Plain"\n'

  it("becomes the slot when the component declares it where the className lands", () => {
    const r = convert(
      '<Card title="t" className="mt-[8]" titleClassName="mt-[2] text-red" />',
      { file, header }
    )
    expect(r.code).toContain(
      '<Card title="t" style={a.mt_8} titleStyle={[a.mt_2, styles.containerTitle]} />'
    )
    expect(r.styles.code).toMatch(/containerTitle: \{\s+color: colors.red,/)
  })

  it("waits when the slot is missing or lands elsewhere, and keeps typography off a text slot", () => {
    const r = convert(
      '<DmView><Plain className="mt-[8]" /><Box className="mt-[8]" /><Card title="t" titleClassName="text-16" /></DmView>',
      { file, header }
    )
    expect(r.sites.map((s) => [s.reason, s.detail])).toEqual([
      ["waiting-on-component", "Plain doesn't declare `style`"],
      [
        "waiting-on-component",
        "Box: `style` doesn't land where `className` does",
      ],
      ["typography-in-text-slot", expect.stringContaining("titleClassName")],
    ])
  })
})

describe("rule 5: what counts as a slot", () => {
  it("refuses a plain ViewStyle spread into an object, as BannerContainer's containerStyle is", () => {
    const file = path.join(SLOTS, "Unit.tsx")
    const header =
      'import { DmView } from "@tappler/shared/src/components/UI"\nimport Banner from "./Banner"\n'
    const r = convert('<Banner containerClassName="py-[0] flex-row" />', {
      file,
      header,
    })
    expect(site(r, "containerClassName")).toMatchObject({
      status: "left",
      reason: "waiting-on-component",
      detail:
        "Banner: `containerStyle` is typed ViewStyle, which takes no style array",
    })
  })
})

describe("rule 5: what a component's own code says about a class attribute", () => {
  const lines = (...l) => `${l.join("\n")}\n`

  it("leaves a ClassNameText alias's classes to the component's callers, wrapped or not", () => {
    const code = lines(
      'import React from "react"',
      'import { ClassNameText } from "@tappler/shared/src/components/classNameSlots"',
      "",
      "const Title = ClassNameText",
      "",
      "export const X = ({ classNameTitle }: { classNameTitle?: string }) => (",
      "  <Title size={16} className={classNameTitle} fontClassName={classNameTitle}>",
      "    t",
      "  </Title>",
      ")"
    )
    // the probe reports the alias as ClassNameText, through `via`
    for (const wraps of [
      [],
      [{ line: 7, component: "ClassNameText", via: ["Title"] }],
    ]) {
      const r = convertSource(code, FILE, { wraps })
      expect(r.changed).toBe(false)
      expect(
        r.sites.map((s) => [s.attr, s.status, s.reason, s.detail])
      ).toEqual(
        ["className", "fontClassName"].map((attr) => [
          attr,
          "left",
          "dynamic",
          "<Title> is tappler-shared's text slot (ClassNameText), and `classNameTitle` comes from this component's caller: it converts at the call sites",
        ])
      )
    }
  })

  it("styles an alias the probe says NativeWind wraps, and waits on one it doesn't", () => {
    const code = lines(
      'import React from "react"',
      'import { Animated } from "react-native"',
      "",
      "const AnimatedScrollView = Animated.createAnimatedComponent(Animated.ScrollView)",
      "",
      'export const X = () => <AnimatedScrollView className="w-full flex-1" horizontal />'
    )
    const unwrapped = convertSource(code, FILE, { wraps: [] })
    expect(unwrapped.sites[0]).toMatchObject({
      status: "left",
      reason: "waiting-on-component",
      detail: "same-file <AnimatedScrollView> that NativeWind doesn't wrap",
    })
    const wrapped = convertSource(code, FILE, {
      wraps: [
        {
          line: 6,
          component: "Animated.ScrollView",
          via: ["AnimatedScrollView"],
        },
      ],
    })
    expect(wrapped.sites[0].status).toBe("converted")
    expect(wrapped.code).toContain(
      "<AnimatedScrollView style={[a.w_full, a.flex_1]} horizontal />"
    )
  })

  it("leaves the classes of a wrapped component that reads no style: they draw nothing today", () => {
    // customerapp imports seven of its own components by file path, so
    // NativeWind wraps them (ds:probe's twelve reviews): ProCard.tsx:274's
    // PromoLine gets mt-[8] as a style it never reads. Plain, here, as by
    // file path; Card reads its style, so a wrapped Card's className moves.
    const file = path.join(SLOTS, "Unit.tsx")
    const code = lines(
      'import React from "react"',
      'import Plain from "./Plain/Plain"',
      'import Card from "./Card/Card"',
      "",
      'export const X = () => <><Plain className="mt-[8]" /><Card title="t" className="mt-[4]" /></>'
    )
    const r = convertSource(code, file, {
      wraps: [
        { line: 5, component: "Plain" },
        { line: 5, component: "Card" },
      ],
    })
    expect(r.sites.map((x) => [x.tag, x.status, x.reason])).toEqual([
      ["Plain", "left", "wrapped-ignores-style"],
      ["Card", "converted", undefined],
    ])
    expect(r.sites[0].detail).toBe(
      "NativeWind wraps <Plain> here (an import it can't trace to a folder), so it gets className as style, and Plain reads no style: those classes draw nothing today. Delete them (latent) rather than move them to a twin"
    )
    expect(r.code).toContain('<Card title="t" style={a.mt_4} />')
  })

  it("files only a wrapped component's className as dead: a class prop it gets raw still draws (OffersSection.tsx:97)", () => {
    // OffersSection's BannerContainer, imported by file path: the wrap turns
    // className (:95) into a style BannerContainer never reads, and hands
    // containerClassName (:97) over as it is, which BannerContainer threads
    // into its inner DmView: that one draws today (review-ca-w0 H3).
    const file = path.join(SLOTS, "Unit.tsx")
    const code = lines(
      'import React from "react"',
      'import Banner from "./Banner/Banner"',
      "",
      'export const X = () => <Banner className="mx-[10]" containerClassName="py-[2] flex-row" />'
    )
    const r = convertSource(code, file, {
      wraps: [{ line: 4, component: "Banner" }],
    })
    expect(r.sites.map((x) => [x.attr, x.status, x.reason])).toEqual([
      ["className", "left", "wrapped-ignores-style"],
      ["containerClassName", "left", "waiting-on-component"],
    ])
    expect(site(r, "className").detail).toBe(
      "NativeWind wraps <Banner> here (an import it can't trace to a folder), so it gets className as style, and Banner reads no style: those classes draw nothing today. Delete them (latent) rather than move them to a twin"
    )
    expect(site(r, "containerClassName").detail).toBe(
      "NativeWind's wrap turns only className into style, so `containerClassName` reaches <Banner> as written and draws today: keep it. Banner: `containerStyle` is typed ViewStyle, which takes no style array"
    )
    expect(r.changed).toBe(false)
  })

  it("keeps refusing a class that drew nothing at e30b19a after its component gains a style twin", () => {
    // JobDetailScreen.tsx:547's SkeletonLoader: wrapped, it gets mt-[6] as a
    // style it never reads. Once W1 adds a style twin (Skeleton ->
    // SkeletonTwinned), the component's own code says it reads style, and
    // converting the class would make it draw (review-ca-w0 M3): the list
    // frozen at e30b19a keeps it refused.
    const file = path.join(SLOTS, "Unit.tsx")
    const at = (from) =>
      lines(
        'import React from "react"',
        `import Skeleton from "${from}"`,
        "",
        'export const X = () => <Skeleton width={90} height={11} className="mt-[6]" />'
      )
    const wraps = [{ line: 4, component: "Skeleton" }]
    const deadSites = [
      {
        file: path.relative(ROOT, file),
        component: "Skeleton",
        attr: "className",
        classes: "mt-[6]",
      },
    ]
    const before = convertSource(at("./Skeleton/Skeleton"), file, {
      wraps,
      deadSites,
    })
    const after = convertSource(at("./Skeleton/SkeletonTwinned"), file, {
      wraps,
      deadSites,
    })
    for (const r of [before, after]) {
      expect(r.sites.map((x) => [x.attr, x.status, x.reason])).toEqual([
        ["className", "left", "wrapped-ignores-style"],
      ])
      expect(r.sites[0].detail).toMatch(
        /^dead at e30b19a: delete the class first\. /
      )
      expect(r.changed).toBe(false)
    }
    expect(after.sites[0].detail).toContain("(<Skeleton> may read style now)")
    expect(before.sites[0].detail).not.toContain("may read style")
    // the control: off the list, the twin makes the same class convert
    const control = convertSource(at("./Skeleton/SkeletonTwinned"), file, {
      wraps,
      deadSites: [],
    })
    expect(control.sites[0].status).toBe("converted")
    expect(control.code).toContain(
      "<Skeleton width={90} height={11} style={a.mt_6} />"
    )
  })

  it("keeps refusing a frozen class with the twin in place after a token changes or is added, it becomes an expression, or its import is renamed", () => {
    // review-ca-w0, the T re-check's L2: the list wanted the exact tag and
    // classes, so with a twin each of these converted, and drew.
    const file = path.join(SLOTS, "Unit.tsx")
    const at = (local, classAttr) =>
      lines(
        'import React from "react"',
        `import ${local} from "./Skeleton/SkeletonTwinned"`,
        "",
        `export const X = () => <${local} width={90} height={11} ${classAttr} />`
      )
    const deadSites = [
      {
        file: path.relative(ROOT, file),
        component: "SkeletonTwinned",
        attr: "className",
        classes: "mt-[6]",
      },
    ]
    const variants = [
      ["as frozen", "SkeletonTwinned", 'className="mt-[6]"', "dead at e30b19a: delete"],
      ["a token changed", "SkeletonTwinned", 'className="mt-[7]"', "dead at e30b19a, changed since: delete"],
      ["a token added", "SkeletonTwinned", 'className="mt-[6] mb-[2]"', "dead at e30b19a, changed since: delete"],
      ["an expression", "SkeletonTwinned", 'className={"mt-[6]"}', "dead at e30b19a, changed since: delete"],
      ["the import renamed", "Skel", 'className="mt-[6]"', "dead at e30b19a: delete"],
    ]
    for (const [name, local, classAttr, says] of variants) {
      const r = convertSource(at(local, classAttr), file, {
        wraps: [{ line: 4, component: local }],
        deadSites,
      })
      expect({
        name,
        sites: r.sites.map((x) => [x.attr, x.status, x.reason]),
        changed: r.changed,
        says: (r.sites[0].detail || "").startsWith(says),
      }).toEqual({
        name,
        sites: [["className", "left", "wrapped-ignores-style"]],
        changed: false,
        says: true,
      })
    }
    // the control: off the list, the twin makes the changed class convert
    const control = convertSource(
      at("SkeletonTwinned", 'className="mt-[7]"'),
      file,
      { wraps: [{ line: 4, component: "SkeletonTwinned" }], deadSites: [] }
    )
    expect(control.sites[0].status).toBe("converted")
    expect(control.code).toMatch(
      /<SkeletonTwinned width=\{90\} height=\{11\} style=\{styles\.\w+\} \/>/
    )
  })

  it("freezes the twelve classes that drew nothing at e30b19a by file, component, attribute and classes", () => {
    const { DEAD_AT_E30B19A } = require("../ds-codemod/convert")
    expect(
      DEAD_AT_E30B19A.map(
        (d) => `${d.file} <${d.component}> ${d.attr}={${d.classes}}`
      )
    ).toEqual([
      'src/components/OffersSection/OffersSection.tsx <BannerContainer> className={`${compact ? "mx-0" : "mx-[10]"} ${className}`}',
      "src/components/ProCardBase/ProCardBase.tsx <PromoLine> className={mt-[8]}",
      'src/components/QuestionComponent/QuestionComponent.tsx <ImageWithTextButton> className={layout === "onePerRow" ? "mb-[16]" : layout === "wrap" ? "mr-[16] mb-[16]" : "mr-[16]"}',
      'src/components/QuestionComponent/QuestionComponent.tsx <ImageWithCheckmarkButton> className={layout === "onePerRow" ? "mb-[16]" : layout === "wrap" ? "mr-[16] mb-[16]" : "mr-[16]"}',
      'src/components/QuestionComponent/QuestionComponent.tsx <TextWithCheckmarkButton> className={layout === "onePerRow" ? "mb-[12]" : layout === "wrap" ? "mr-[12] mb-[12]" : "mr-[12]"}',
      "src/screens/dashboardScreens/JobDetailScreen/JobDetailScreen.tsx <SkeletonLoader> className={mt-[6]}",
      "src/screens/dashboardScreens/JobDetailScreen/JobDetailScreen.tsx <SkeletonLoader> className={mt-[8]}",
      "src/screens/dashboardScreens/JobDetailScreen/JobDetailScreen.tsx <SkeletonLoader> className={mt-[8]}",
      "src/screens/dashboardScreens/JobDetailScreen/JobDetailScreen.tsx <SkeletonLoader> className={mt-[8]}",
      "src/screens/dashboardScreens/JobDetailScreen/JobDetailScreen.tsx <SkeletonLoader> className={mt-[10]}",
      "src/screens/dashboardScreens/MessagesDetailsScreen/MessagesDetailsScreen.tsx <OrderBill> className={mt-[24]}",
      "src/screens/dashboardScreens/ProsListingScreen/components/ProCard.tsx <PromoLine> className={mt-[8]}",
    ])
  })

  it("refuses a frozen site with no list passed in, wrapped or not", () => {
    // as at JobDetailScreen.tsx:547, without the wrap the probe reports
    const file = path.join(
      ROOT,
      "src/screens/dashboardScreens/JobDetailScreen/JobDetailScreen.tsx"
    )
    const r = convertSource(
      lines(
        'import React from "react"',
        'import SkeletonLoader from "../../../components/SkeletonLoader/SkeletonLoader"',
        "",
        'export const X = () => <SkeletonLoader width={90} height={11} borderRadius={4} className="mt-[6]" />'
      ),
      file,
      { wraps: [] }
    )
    expect(r.sites.map((x) => [x.status, x.reason])).toEqual([
      ["left", "wrapped-ignores-style"],
    ])
    expect(r.sites[0].detail).toMatch(
      /^dead at e30b19a: delete the class first\. /
    )
  })

  it("names a class attribute that isn't a prop, where the props type names every prop", () => {
    const r = convert(
      '<><Plain classNameInfo="text-12" /><AppScrollView fooClassName="mt-[2]" /></>',
      {
        file: path.join(SLOTS, "Unit.tsx"),
        header:
          'import Plain from "./Plain"\nimport { AppScrollView } from "components/scroll"\n',
      }
    )
    expect(r.sites.map((s) => [s.reason, s.detail])).toEqual([
      [
        "not-a-prop",
        "`classNameInfo` isn't a Plain prop, so it draws nothing: delete it",
      ],
      // ScrollViewProps and a ...rest: it may be one
      ["waiting-on-component", "AppScrollView doesn't declare `fooStyle`"],
    ])
  })

  it("says the edit a component draws a class string as (a HAND_EDITS row)", () => {
    // customerapp's table is empty: a row for the Badge fixture, shaped like
    // proapp's MyServiceDetailItem white badge, shows the mechanism
    const { HAND_EDITS } = require("../ds-codemod/twins")
    expect(HAND_EDITS).toEqual({})
    HAND_EDITS.Badge = {
      classNameBtn: [
        {
          classes: "border-red",
          when: { btnVariant: "white" },
          edit: 'btnHairline="brand"',
          why: "the white badge's red hairline, which is what the class draws on it",
        },
      ],
    }
    try {
      const r = convert(
        [
          "<>",
          '<Badge titleBtn="b" btnVariant="white" classNameBtn="border-red" />',
          '<Badge titleBtn="b" btnVariant="grey" classNameBtn="border-red" />',
          "</>",
        ].join(""),
        {
          file: path.join(SLOTS, "Unit.tsx"),
          header: 'import Badge from "./Badge"\n',
        }
      ).sites
      expect(r.map((x) => [x.reason, x.detail])).toEqual([
        [
          "hand-edit",
          'btnHairline="brand": the white badge\'s red hairline, which is what the class draws on it',
        ],
        // only the white badge reads it
        ["waiting-on-component", "Badge doesn't declare `btnStyle`"],
      ])
    } finally {
      delete HAND_EDITS.Badge
    }
  })
})

describe("rule 5: slots the codemod is told about", () => {
  it("moves a className to the slot KNOWN states, unless the site sets what the slot now beats", () => {
    // customerapp's table is empty: a row for the Headed fixture, shaped like
    // proapp's HeaderOnboarding, shows the mechanism. (proapp's <Screen
    // header> object rule follows its Screen component, which customerapp
    // doesn't have.)
    const { KNOWN } = require("../ds-codemod/slots")
    expect(KNOWN).toEqual({})
    const key = "scripts/__fixtures__/ds-codemod/slots/Headed/Headed.tsx"
    KNOWN[key] = {
      className: { slot: "style", unless: ["bordered", "gutter", "style"] },
    }
    try {
      const r = convert(
        '<><Headed title="t" className="px-[15] border-b-0" /><Headed title="t" gutter className="px-[15]" /></>',
        {
          file: path.join(SLOTS, "Unit.tsx"),
          header: 'import Headed from "./Headed"\n',
        }
      )
      expect(r.code).toContain(
        '<Headed title="t" style={[styles.headed, a.border_b_0]} />'
      )
      expect(r.styles.code).toMatch(
        /headed: \{\s+paddingLeft: 15,\s+paddingRight: 15,\s+\},/
      )
      expect(r.sites[1]).toMatchObject({
        status: "left",
        detail: expect.stringContaining("`gutter`"),
      })
    } finally {
      delete KNOWN[key]
    }
  })

  it("reads a slot its component declares with @dsSlot", () => {
    const file = path.join(SLOTS, "Unit.tsx")
    const r = convert('<Tagged className="mt-[8]" />', {
      file,
      header: 'import Tagged from "./Tagged"\n',
    })
    expect(r.code).toContain("<Tagged boxStyle={a.mt_8} />")
  })

  it("refuses a ClassNameText slot that isn't given the classes as fontClassName too (S8)", () => {
    const file = path.join(SLOTS, "Unit.tsx")
    const titled = convert('<Titled title="t" classNameTitle="mt-[2]" />', {
      file,
      header: 'import Titled from "./Titled"\n',
    })
    expect(titled.code).toContain('<Titled title="t" titleStyle={a.mt_2} />')
    const fontless = convert('<Fontless title="t" classNameTitle="mt-[2]" />', {
      file,
      header: 'import Fontless from "./Fontless"\n',
    })
    expect(site(fontless, "classNameTitle")).toMatchObject({
      status: "left",
      reason: "waiting-on-component",
      detail:
        "Fontless: <Title> (ClassNameText) takes `classNameTitle` as className but not as fontClassName, so a caller's font and Arabic leading classes draw nothing",
    })
  })

  it("sets the typed prop a component declares for a class it parses (@dsFromClass)", () => {
    const file = path.join(SLOTS, "Unit.tsx")
    const header = 'import Ruled from "./Ruled"\n'
    const off = convert('<Ruled className="mt-[8] border-0" />', {
      file,
      header,
    })
    // the parse becomes the prop; border-0's own style moves with the rest
    expect(off.code).toMatch(
      /<Ruled separator=\{false\} style=\{\[a\.mt_8, [^\]]*\]\} \/>/
    )
    const on = convert('<Ruled className="mt-[8]" />', { file, header })
    expect(on.code).toContain("<Ruled style={a.mt_8} />")
    // there in one state only: the prop can't follow it
    const some = convert(
      '<Ruled className={on ? "mt-[8] border-0" : "mt-[8]"} />',
      { file, header }
    )
    expect(site(some)).toMatchObject({
      status: "left",
      reason: "not-expressible",
    })
    // Ruled's own parse is `includes("border-0")`, which border-0.5 also
    // meets: the two readings disagree, so the site is left
    const half = convert('<Ruled className="mt-[8] border-0.5" />', {
      file,
      header,
    })
    expect(site(half)).toMatchObject({
      status: "left",
      reason: "parse-disagrees",
      detail:
        "`border-0.5` holds `border-0` inside it: the component may read it as `border-0` (its own parse) where `separator` reads whole classes, so convert it by hand",
    })
  })

  it("moves the class attributes that can move and leaves the one that can't", () => {
    // a fixture, not a live component: wave 2 gives live ones the twins
    // that would make the left attribute move too
    const r = convert(
      '<Card title="t" className="mt-[4]" titleClassName="text-13 font-custom500" />',
      { file: path.join(SLOTS, "Unit.tsx"), header: 'import Card from "./Card"\n' }
    )
    expect(r.code).toContain("style={a.mt_4}")
    // Card's title slot has a style twin and no type twin
    expect(r.code).toContain('titleClassName="text-13 font-custom500"')
    expect(r.sites.map((x) => [x.attr, x.status]).sort()).toEqual([
      ["className", "converted"],
      ["titleClassName", "left"],
    ])
  })
})

describe("rule 5: shared components' style twins, read off their props types", () => {
  // MainModal as customerapp imports it: tappler-shared's own, no wrapper
  const header =
    'import { MainModal } from "@tappler/shared/src/components"\nimport { DmChecbox, DmInput } from "@tappler/shared/src/components/UI"\nimport JobLocationMap from "@tappler/shared/src/components/JobLocationMap"\n'

  it("moves MainModal's classes to the twins declared after them, the card's rounded-NN to radius", () => {
    const r = convert(
      '<MainModal isVisible onClose={cb} className="px-[20] rounded-20" classNameTitle="mt-[10]" classNameModal="px-[17]" />',
      { header }
    )
    // 20 is no radius token: px(); a token's value is written as it is
    expect(r.code).toContain("radius={px(20)}")
    expect(r.code).toMatch(/cardStyle=\{\[a\.px_20, styles\.\w+\]\}/)
    expect(r.code).toContain("titleStyle={a.mt_10}")
    expect(r.code).toMatch(/modalStyle=\{styles\.\w+\}/)
    const token = convert(
      '<MainModal isVisible onClose={cb} className="rounded-10" />',
      { header }
    )
    expect(token.code).toContain("radius={10}")
  })

  it("renames a twin the component renamed, and a class moving to it joins it there", () => {
    // styleHightWrapper is wrapperStyle now, and classNameWrapperHight's twin
    const r = convert(
      '<MainModal isVisible onClose={cb} classNameWrapperHight="self-center" styleHightWrapper={{ opacity: 0.5 }} />',
      { header }
    )
    expect(r.code).toContain("wrapperStyle={[a.self_center, { opacity: 0.5 }]}")
    expect(r.code).not.toContain("styleHightWrapper")
  })

  it("moves MainModal's button classes to their twin: shared's MainModal draws them here", () => {
    // In proapp a wrapper dropped every button class; customerapp passes
    // them to shared's MainModal, whose own button draws them
    // (customerapp-plan §1b, MainModal.tsx:372-414).
    const r = convert(
      '<MainModal isVisible onClose={cb} classNameBtn="h-[30]" classNameDescr="text-13 leading-[20px] font-custom400" />',
      { header }
    )
    expect(r.sites.map((x) => [x.attr, x.status]).sort()).toEqual([
      ["classNameBtn", "converted"],
      ["classNameDescr", "converted"],
    ])
    expect(r.code).toMatch(/actionBtnStyle=\{styles\.\w+\}/)
    // DESCR is 13/legacy/regular/centred: the 20 is 13's loose, x 1.32 in
    // Arabic as the leading-[20px] class was
    expect(r.code).toContain('descrType={{ size: 13, leading: "loose" }}')
  })

  it("leaves a class prop its component takes and draws nothing with", () => {
    // the Dropping fixture, as customerapp's RateComponent:16 and SearchBar:19
    const r = convert('<Dropping className="mt-[4]" starClassName="h-[10]" />', {
      file: path.join(SLOTS, "Unit.tsx"),
      header: 'import Dropping from "./Dropping"\n',
    })
    expect(site(r, "starClassName")).toMatchObject({
      status: "left",
      reason: "discarded-by-component",
      detail:
        "Dropping takes `starClassName` and draws nothing with it: delete it by hand (pass 2)",
    })
  })

  it("works a *Type out from the component's own text and what the classes drew over it", () => {
    // two size-only titles: a size class over MainModal's own px(27), and
    // the same with a margin and a face
    const r = convert(
      '<><MainModal isVisible onClose={cb} classNameTitle="text-15" /><MainModal isVisible onClose={cb} classNameTitle="mt-[0] text-16 font-custom600" /></>',
      { header }
    )
    expect(r.code).toContain(
      "titleType={{ size: 15, leading: { legacy: px(27) } }}"
    )
    expect(r.code).toContain(
      "titleType={{ size: 16, leading: { legacy: px(27) } }} titleStyle={a.mt_0}"
    )
    // conditions stay conditions, a whole type per state
    const cond = convert(
      '<MainModal isVisible onClose={cb} classNameTitle={on ? "text-20 leading-[24px]" : "text-16 leading-[27px]"} />',
      { header }
    )
    expect(cond.code).toContain(
      'titleType={on ? { size: 20, leading: "tight" } : undefined}'
    )
    // DmChecbox: a font class drops the label's own face (family system),
    // a weight brings it back; a colour token is the type's
    const check = convert(
      '<DmChecbox isChecked onPress={cb} title="t" textClassName="text-13 font-custom600 text-grey2" />',
      { header }
    )
    expect(check.code).toContain(
      'textType={{ size: 13, leading: "legacy", weight: "semibold", color: "secondary" }}'
    )
  })

  it("writes a field's classes as its inputType, the input's and the placeholder's together", () => {
    const r = convert(
      '<><DmInput value="" onChangeText={cb} inputClassName="text-13 leading-[16px] text-black font-custom500" /><DmInput value="" onChangeText={cb} inputClassName="text-12 leading-[20px]" classNamePlaceholder="text-13 leading-[15px] font-custom400" /></>',
      { header }
    )
    // 13 and leading 16 are the field's own: only the face is the type's
    expect(r.code).toMatch(
      /inputType=\{\{ weight: "medium" \}\} inputStyle=\{styles\.\w+\}/
    )
    // the input's size and Arabic leading, the placeholder's English one
    expect(r.code).toContain(
      "inputType={{ size: 12, arabicLeading: px(20), placeholderLeading: px(15) }}"
    )
    // the placeholder's size draws nothing today (its animation's does)
    expect(r.latent.map((x) => x.class)).toContain(
      "fontSize in DmInput's placeholder class"
    )
    // a size class in some states only: the field keeps an earlier state's
    const some = convert(
      '<DmInput value="" onChangeText={cb} inputClassName={on ? "text-15 font-custom500" : "font-custom500"} />',
      { header }
    )
    expect(site(some, "inputClassName")).toMatchObject({
      status: "left",
      reason: "not-expressible",
    })
  })

  it("writes the face a field's classes name as its weight, regular included", () => {
    // A filled field's placeholder rises over the value and draws bold, unless
    // the field's classes name a face: font-custom400 drew it regular, so the
    // type says regular too (MyAccountNewAddressScreen, build-w2b-P3.md)
    const r = convert(
      '<><DmInput value="typed" onChangeText={cb} placeholder="Street" inputClassName="text-13 leading-[16px] text-black font-custom400" /><DmInput value="typed" onChangeText={cb} placeholder="City" inputClassName="font-custom400" /><DmInput value="typed" onChangeText={cb} placeholder="Area" inputClassName="text-14 leading-[19px] font-custom400" /></>',
      { header }
    )
    expect(r.code).toMatch(
      /placeholder="Street" inputType=\{\{ weight: "regular" \}\} inputStyle=\{styles\.\w+\}/
    )
    expect(r.code).toContain(
      'placeholder="City" inputType={{ weight: "regular" }} />'
    )
    expect(r.code).toContain(
      'placeholder="Area" inputType={{ size: 14, weight: "regular", arabicLeading: px(19) }} />'
    )
    // no face named: the weight stays out, and the raised label stays bold
    const none = convert(
      '<DmInput value="typed" onChangeText={cb} placeholder="Street" inputClassName="text-14 leading-[19px] text-black" />',
      { header }
    )
    expect(none.code).toMatch(
      /placeholder="Street" inputType=\{\{ size: 14, arabicLeading: px\(19\) \}\} inputStyle=\{styles\.\w+\}/
    )
    expect(none.code).not.toContain("weight")
  })

  it("proves a field's type on DmInput's raised placeholder as well as on the field", () => {
    const { fieldDiffers, fieldDraws } = require("../ds-codemod/typetwin")
    for (const lang of ["en", "ar"]) {
      const want = fieldDraws(lang, "text-13 leading-[16px] font-custom400", null)
      // the field alone can't tell a missing weight from regular...
      const noWeight = fieldDraws(lang, "", {})
      expect(noWeight.fontFamily).toBe(want.fontFamily)
      // ...the raised placeholder can: bold where the class drew regular
      expect(noWeight.raised.fontFamily).not.toBe(want.raised.fontFamily)
      expect(fieldDiffers("DmInput", noWeight, want)).toBe(
        "the raised placeholder"
      )
      expect(
        fieldDiffers("DmInput", fieldDraws(lang, "", { weight: "regular" }), want)
      ).toBeNull()
      // DmAuthInput's placeholder draws its own face, whatever the type says
      expect(fieldDiffers("DmAuthInput", noWeight, want)).toBeNull()
      // and a field drawn in another face is the field's difference
      expect(
        fieldDiffers("DmInput", fieldDraws(lang, "", { weight: "bold" }), want)
      ).toBe("the field")
    }
  })

  it("reads DmInput's height out of its h-[n], and JobLocationMap's whole height class", () => {
    const r = convert(
      '<><DmInput value="" onChangeText={cb} className="h-[63] w-full" inputClassName="mt-[2]" /><JobLocationMap heightClassName="h-full" /><DmChecbox isChecked onPress={cb} title="t" className="pb-[20]" /></>',
      { header }
    )
    // the height goes to its prop and out of containerStyle, which refuses it
    expect(r.code).toContain("height={63} containerStyle={a.w_full}")
    expect(r.code).toContain("inputStyle={a.mt_2}")
    expect(r.code).toContain('<JobLocationMap height="100%" />')
    expect(r.code).toContain("style={a.pb_20}")
    // a height its prop can't carry is one containerStyle can't either
    const full = convert(
      '<DmInput value="" onChangeText={cb} className="h-full w-full" />',
      { header }
    )
    expect(site(full)).toMatchObject({
      status: "left",
      reason: "twin-refuses-key",
      detail: "`containerStyle` takes no `height` (h-full)",
    })
    // DmInput's parse finds h-[n] inside another class, or takes the first
    // of two where the box draws the last: `height` can't stand for both
    const parsed = convert(
      '<><DmInput value="" onChangeText={cb} className="min-h-[63] w-full" /><DmInput value="" onChangeText={cb} className="h-[50] h-[63]" /></>',
      { header }
    )
    expect(parsed.sites.map((s) => [s.reason, s.detail])).toEqual([
      [
        "parse-disagrees",
        'the component reads `h-[63]` for `height` out of "min-h-[63] w-full", whose height is no class\'s: convert it by hand',
      ],
      [
        "parse-disagrees",
        'the component reads `h-[50]` for `height` out of "h-[50] h-[63]", whose height is 63: convert it by hand',
      ],
    ])
  })
})

describe("StyleSheet.absoluteFill", () => {
  it("is what NativeWind's full absolute fill becomes, imported from react-native", () => {
    const r = convert(
      '<><DmView className="absolute top-0 left-0 right-0 bottom-0" /><DmView className="absolute inset-0" /></>'
    )
    expect(r.code).toContain("<DmView style={StyleSheet.absoluteFill} />")
    expect(r.code).toContain('import { StyleSheet } from "react-native"')
    expect(r.code).not.toContain("absoluteFillObject")
    // inset-0 draws nothing in NativeWind 2: today that one is only absolute
    expect(r.code).toContain("<DmView style={a.absolute} />")
    expect(r.latent.map((l) => l.class)).toEqual(["inset-0"])
  })

  it("joins the file's own react-native import", () => {
    const r = convert(
      '<DmView className="absolute top-0 left-0 right-0 bottom-0" />',
      {
        extra: 'import { View } from "react-native"\n',
      }
    )
    expect(r.code).toContain('import { View, StyleSheet } from "react-native"')
  })
})

describe("rule 6: classes NativeWind drops", () => {
  it("leaves them out and lists them, with file:line", () => {
    const r = convert('<DmView className="px-[15] flex-between" />')
    expect(r.code).toContain("<DmView style={styles.container} />")
    expect(r.latent).toEqual([
      expect.objectContaining({
        file: "src/__ds_codemod_unit__/Unit.tsx",
        line: 5,
        class: "flex-between",
        tag: "DmView",
      }),
    ])
  })

  it("lists what an ActionBtn's label drops too, under the attribute it is written in", () => {
    // proapp's MyAccountChangePasswordScreen shape (review-w2b-P3.md F1):
    // font-400 is no class, so the disabled label never drew it
    const r = convert(
      [
        "<ActionBtn",
        "  disable={!on}",
        "  onPress={cb}",
        "  textClassName={clsx(",
        '    "text-13 leading-[16px] font-custom500",',
        '    !on && "text-grey10 font-400"',
        "  )}",
        '  className={clsx("h-[41]")}',
        '  title="t"',
        "/>",
      ].join("\n"),
      { extra: 'import clsx from "clsx"\n', proven: "all" }
    )
    expect(r.code).toContain("<Button")
    expect(site(r, "textClassName")).toMatchObject({
      status: "converted",
      dropped: [expect.objectContaining({ class: "font-400" })],
    })
    expect(site(r, "className").dropped).toEqual([])
    expect(r.latent).toEqual([
      {
        file: "src/__ds_codemod_unit__/Unit.tsx",
        line: 9,
        tag: "ActionBtn",
        class: "font-400",
        reason: expect.stringMatching(/^unknown class/),
      },
    ])
  })

  it("appends to latent-bugs.md sorted, once per row", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ds-codemod-latent-"))
    const md = path.join(dir, "latent-bugs.md")
    const row = (file, line, cls) => ({
      file,
      line,
      tag: "DmView",
      class: cls,
      reason: "unknown class",
    })
    expect(
      appendLatent(md, [row("src/b.tsx", 3, "x"), row("src/a.tsx", 9, "y")])
    ).toBe(2)
    expect(
      appendLatent(md, [row("src/a.tsx", 9, "y"), row("src/a.tsx", 2, "z")])
    ).toBe(1)
    const rows = fs
      .readFileSync(md, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("| src/"))
    expect(rows.map((l) => l.split(" | ")[0])).toEqual([
      "| src/a.tsx:2",
      "| src/a.tsx:9",
      "| src/b.tsx:3",
    ])
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe("rule 7: imports", () => {
  it("removes DmText, ActionBtn and clsx once nothing uses them, and keeps what is still used", () => {
    const r = convert(
      '<DmView className={clsx("mt-[4]")}><DmText className="text-13">a</DmText><ActionBtn title="b" onPress={cb} /></DmView>',
      { extra: 'import clsx from "clsx"\n', proven: "all" }
    )
    expect(r.code).toContain(
      'import { DmView } from "@tappler/shared/src/components/UI"'
    )
    expect(r.code).not.toContain("clsx")
    expect(r.code).toContain(
      'import { Text, Button, a } from "@tappler/shared/src/ds"'
    )
  })

  it("picks free names when Text, a or styles are taken", () => {
    const r = convert(
      '<DmView className="px-[15]"><DmText className="text-13 mb-[6] font-custom400">{a}</DmText></DmView>',
      {
        extra:
          'import { Text } from "react-native"\nconst a = 1\nconst styles = {}\n',
      }
    )
    expect(r.code).toContain(
      'import { Text as DsText, a as atoms } from "@tappler/shared/src/ds"'
    )
    expect(r.code).toContain('import dsStyles from "./styles"')
    expect(r.code).toContain(
      '<DsText size={13} leading="legacy" style={atoms.mb_6}>'
    )
  })

  it("reuses an imported ds name only where no inner scope binds it again", () => {
    // a re-run: `a` imported by the first run, the new site inside a
    // callback whose parameter is `a` (review-tools-w2b.md F6)
    const ds = 'import { Text, a } from "@tappler/shared/src/ds"\n'
    const r = convert(
      '<DmView style={a.mt_4}>{n.map((a: any) => <DmView key={a.id} className="mt-[8]"><Text size={13} leading="legacy">{a.name}</Text></DmView>)}</DmView>',
      { extra: ds }
    )
    expect(r.code).toContain('<DmView key={a.id} style={atoms.mt_8}>')
    expect(r.code).not.toContain("style={a.mt_8}")
    expect(r.code).toContain(
      'import { Text, a, a as atoms } from "@tappler/shared/src/ds"'
    )
    // px: the printers write px() by that name, so the file is refused
    expect(() =>
      convert(
        '<DmView>{n.map((px: any) => <DmText key={px} className="text-13 leading-[22px]">{px}</DmText>)}</DmView>',
        { extra: 'import { Text, px } from "@tappler/shared/src/ds"\n' }
      )
    ).toThrow(/has its own `px`/)
  })

  it("refuses a file whose px isn't the design system's: it writes px() calls by that name", () => {
    const site = '<DmText className="text-13 leading-[22px]">x</DmText>'
    expect(() =>
      convert(site, { extra: "const px = (n: number) => n\n" })
    ).toThrow(/has its own `px`/)
    expect(() =>
      convert(site, {
        extra: 'import { px as dsPx } from "@tappler/shared/src/ds"\n',
      })
    ).toThrow(/imports the design system's as `dsPx`/)
    // the design system's own px, as a first run imported it, is reused
    const reused = convert(site, {
      extra: 'import { px } from "@tappler/shared/src/ds"\n',
    })
    expect(reused.code).toContain(
      '<Text size={13} leading={px(22)} family="system">x</Text>'
    )
    expect(
      reused.code.match(/from "@tappler\/shared\/src\/ds"/g) || []
    ).toHaveLength(1)
    expect(reused.code).toContain(
      'import { px, Text } from "@tappler/shared/src/ds"'
    )
  })
})

describe("the parity comparer", () => {
  const {
    allowButtonHeight,
    diffTrees,
  } = require("../ds-codemod/parity/compare")
  const { buttonStyles } = loadDs()
  const label = {
    type: "View",
    props: { style: { ...buttonStyles.LABEL_BOX } },
    children: [{ type: "Text", props: {}, children: ["OK"] }],
  }
  const node = (style, children) => ({
    type: "View",
    props: { style },
    children,
  })

  it("accepts height -> minHeight on a Button's root only", () => {
    const before = node({ height: 48, opacity: 1 }, [label])
    const button = diffTrees(
      before,
      node({ minHeight: 48, opacity: 1 }, [label]),
      allowButtonHeight
    )
    expect(button.diffs).toEqual([])
    expect(button.accepted).toEqual([
      { path: "root<View>", what: "height 48 -> minHeight 48 (Button)" },
    ])
    // the same swap on a plain box is a difference
    const box = diffTrees(
      node({ height: 48, opacity: 1 }, []),
      node({ minHeight: 48, opacity: 1 }, []),
      allowButtonHeight
    )
    expect(box.accepted).toEqual([])
    expect(box.diffs.map((d) => d.path)).toEqual([
      "root<View>.style.height",
      "root<View>.style.minHeight",
    ])
  })
})

describe("re-running", () => {
  it("changes nothing in a file it has converted", () => {
    const first = convert(
      '<DmView className="flex-1"><DmText className="text-13 leading-[16px]">x</DmText></DmView>'
    )
    const again = convertSource(first.code, FILE, { wraps: [] })
    expect(again.changed).toBe(false)
    expect(again.sites).toEqual([])
  })

  it("merges the components of one directory into their shared styles.ts", async () => {
    const dir = fs.mkdtempSync(
      path.join(ROOT, "scripts", "__fixtures__", "ds-codemod-shared-")
    )
    fs.writeFileSync(
      path.join(dir, "styles.ts"),
      'import { StyleSheet } from "react-native"\n\nexport default StyleSheet.create({\n  kept: { opacity: 1 },\n})\n'
    )
    for (const name of ["One", "Two"])
      fs.writeFileSync(
        path.join(dir, `${name}.tsx`),
        `import React from "react"\n${UI}import styles from "./styles"\n\nexport const ${name} = () => <DmView className="px-[15] bg-grey${name === "One" ? 2 : 3}" style={styles.kept} />\n`
      )
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined)
    try {
      expect(
        await run([
          dir,
          "--no-probe",
          "--quiet",
          "--latent",
          path.join(dir, "latent.md"),
        ])
      ).toBe(0)
      const sheet = fs.readFileSync(path.join(dir, "styles.ts"), "utf8")
      const keys = [...sheet.matchAll(/^  (\w+): \{/gm)].map((m) => m[1])
      expect(keys).toEqual(["kept", "container", "container2"])
      expect(fs.readFileSync(path.join(dir, "One.tsx"), "utf8")).toContain(
        "styles.container,"
      )
      expect(fs.readFileSync(path.join(dir, "Two.tsx"), "utf8")).toContain(
        "styles.container2,"
      )
    } finally {
      log.mockRestore()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("reuses its own ds import when a component gains twins between runs, and adds no alias", () => {
    // Two real runs, each its own process (as two `yarn ds:codemod`s are:
    // the component's slots are read once per process). The first converts
    // what it can and waits on Panel; Panel then gains a view twin and a
    // text twin; the second converts Panel's site, which needs `a` and `px`
    // again, both already imported from the first run.
    const dir = fs.mkdtempSync(
      path.join(ROOT, "scripts", "__fixtures__", "ds-codemod-rerun-")
    )
    const panel = path.join(dir, "Panel.tsx")
    const screen = path.join(dir, "Screen.tsx")
    fs.writeFileSync(
      panel,
      [
        'import React from "react"',
        'import { DmText, DmView } from "@tappler/shared/src/components/UI"',
        "",
        "interface Props {",
        "  title: string",
        "  className?: string",
        "  classNameTitle?: string",
        "}",
        "",
        "const Panel: React.FC<Props> = ({ title, className, classNameTitle }) => (",
        "  <DmView className={className}>",
        "    <DmText className={classNameTitle}>{title}</DmText>",
        "  </DmView>",
        ")",
        "",
        "export default Panel",
        "",
      ].join("\n")
    )
    fs.writeFileSync(
      screen,
      [
        'import React from "react"',
        'import { DmText, DmView } from "@tappler/shared/src/components/UI"',
        'import Panel from "./Panel"',
        "",
        "export const Screen = () => (",
        '  <DmView className="mt-[8]">',
        '    <DmText className="text-13 leading-[22px]">hello</DmText>',
        '    <Panel title="t" className="mt-[4]" classNameTitle="mt-[2] text-13 leading-[22px]" />',
        "  </DmView>",
        ")",
        "",
      ].join("\n")
    )
    const env = { ...process.env }
    delete env.JEST_WORKER_ID
    const codemod = () =>
      execFileSync(
        process.execPath,
        [
          path.join(ROOT, "scripts", "ds-codemod.js"),
          dir,
          "--no-probe",
          "--quiet",
          "--latent",
          path.join(dir, "latent.md"),
        ],
        { cwd: ROOT, env, encoding: "utf8" }
      )
    const dsImports = (code) =>
      code.match(/^import \{[^}]*\} from "@tappler\/shared\/src\/ds"$/gm) || []
    try {
      codemod()
      const first = fs.readFileSync(screen, "utf8")
      expect(dsImports(first)).toEqual([
        'import { Text, a, px } from "@tappler/shared/src/ds"',
      ])
      expect(first).toContain('<Panel title="t" className="mt-[4]"')
      // Panel gains its twins, in the W2a convention
      fs.writeFileSync(
        panel,
        [
          'import React from "react"',
          'import type { StyleProp, ViewStyle } from "react-native"',
          "",
          'import { DmView } from "@tappler/shared/src/components/UI"',
          'import { ClassNameText } from "@tappler/shared/src/components/classNameSlots"',
          "import type {",
          "  NoShorthands,",
          "  SizeBringsLeading,",
          '} from "@tappler/shared/src/components"',
          'import { px, type DsTextStyle, type TextType } from "@tappler/shared/src/ds"',
          "",
          "const Title = ClassNameText",
          "",
          'const TITLE: TextType = { size: 16, weight: "semibold", leading: px(19) }',
          "",
          "interface Props {",
          "  title: string",
          "  className?: string",
          "  style?: StyleProp<ViewStyle & NoShorthands>",
          "  classNameTitle?: string",
          "  titleStyle?: StyleProp<DsTextStyle & NoShorthands>",
          "  titleType?: Partial<TextType> & SizeBringsLeading",
          "}",
          "",
          "const Panel: React.FC<Props> = ({",
          "  title,",
          "  className,",
          "  style,",
          "  classNameTitle,",
          "  titleStyle,",
          "  titleType,",
          "}) => (",
          "  <DmView className={className} style={style}>",
          "    <Title",
          "      {...TITLE}",
          "      twinType={titleType}",
          "      className={classNameTitle}",
          "      fontClassName={classNameTitle}",
          "      twinStyle={titleStyle}",
          "    >",
          "      {title}",
          "    </Title>",
          "  </DmView>",
          ")",
          "",
          "export default Panel",
          "",
        ].join("\n")
      )
      codemod()
      const again = fs.readFileSync(screen, "utf8")
      // Panel's site converted, through the names the first run imported
      expect(again).toContain("style={a.mt_4}")
      expect(again).toContain("titleType={{ size: 13, leading: px(22) }}")
      expect(dsImports(again)).toEqual([
        'import { Text, a, px } from "@tappler/shared/src/ds"',
      ])
      expect(again).not.toMatch(/\b(dsPx|atoms|DsText)\b/)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("--dry writes nothing", async () => {
    const dir = fs.mkdtempSync(
      path.join(ROOT, "scripts", "__fixtures__", "ds-codemod-dry-")
    )
    const file = path.join(dir, "Dry.tsx")
    const code = `import React from "react"\n${UI}\nexport const X = () => <DmView className="flex-1" />\n`
    fs.writeFileSync(file, code)
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined)
    try {
      expect(await run([dir, "--dry", "--no-probe", "--quiet"])).toBe(0)
      expect(fs.readFileSync(file, "utf8")).toBe(code)
      expect(fs.readdirSync(dir)).toEqual(["Dry.tsx"])
    } finally {
      log.mockRestore()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  // review-ca-w0, the T re-check's L4: any hex `customerapp` stamp passed,
  // so proapp's 84f2287c proof stamped `deadbeef` converted.
  it("--proven takes a customerapp-stamped proof only when it checks out (a commit of this history, every look's sites in files customerapp had then), and a fixture's drawnIn one only with no sites", async () => {
    const dir = fs.mkdtempSync(
      path.join(ROOT, "scripts", "__fixtures__", "ds-codemod-stamp-")
    )
    const file = path.join(dir, "Stamped.tsx")
    fs.writeFileSync(
      file,
      `import React from "react"\n${UI}\nexport const X = ({ cb }: any) => <ActionBtn title="Go" onPress={cb} className="h-[48]" />\n`
    )
    const props = { className: "h-[48]", onPress: true }
    const AT_E30B19A = "screens/onboardingScreens/AuthWelcomeScreen/AuthWelcomeScreen.tsx:128"
    const PROAPPS = "components/ModalButtons/ModalButtons.tsx:114"
    const proofs = {
      // B's harvest's shape: a customerapp commit, every look's sites
      harvest: { customerapp: "e30b19a", looks: { a: { props, sites: [AT_E30B19A] } } },
      deadbeef: { customerapp: "deadbeef", looks: { a: { props, sites: [AT_E30B19A] } } },
      zeros: { customerapp: "0000000", looks: { a: { props, sites: [AT_E30B19A] } } },
      unsited: { customerapp: "e30b19a", looks: { a: { props } } },
      proapps: { customerapp: "e30b19a", looks: { a: { props, sites: [PROAPPS] } } },
      // a fixture's marker on looks that name sites, as a harvest's do
      drawnSited: { drawnIn: "customerapp", looks: { a: { props, sites: [PROAPPS] } } },
    }
    const report = path.join(dir, "report.json")
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined)
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    try {
      const outcome = async (name) => {
        const looks = path.join(dir, `${name}.json`)
        fs.writeFileSync(looks, JSON.stringify(proofs[name]))
        error.mockClear()
        const status = await run([file, "--dry", "--no-probe", "--quiet", "--report", report, "--proven", looks])
        return status === 0
          ? JSON.parse(fs.readFileSync(report, "utf8")).sites[0].status
          : `${status}: ${error.mock.calls.map((c) => c[0]).join(" ")}`
      }
      expect(await outcome("harvest")).toBe("converted")
      expect(await outcome("deadbeef")).toMatch(
        /^2: .*deadbeef\.json says its looks were harvested from customerapp deadbeef, but customerapp deadbeef is no commit of this checkout's history/
      )
      expect(await outcome("zeros")).toMatch(/^2: .*customerapp 0000000 is no commit/)
      expect(await outcome("unsited")).toMatch(/^2: .*1 of its looks name no site/)
      expect(await outcome("proapps")).toMatch(
        /^2: .*its sites name 1 file\(s\) customerapp's src didn't have at e30b19a \(src\/components\/ModalButtons\/ModalButtons\.tsx\)/
      )
      expect(await outcome("drawnSited")).toMatch(
        /^2: .*says "drawnIn": "customerapp", but its looks name sites, as a harvest's do, and no customerapp commit/
      )
    } finally {
      log.mockRestore()
      error.mockRestore()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it("--proven takes the proven ActionBtn looks from a file (the fixture parity run's own)", async () => {
    const dir = fs.mkdtempSync(
      path.join(ROOT, "scripts", "__fixtures__", "ds-codemod-proven-")
    )
    const file = path.join(dir, "Proven.tsx")
    const code = `import React from "react"\n${UI}\nexport const X = ({ cb }: any) => <ActionBtn title="Go" onPress={cb} className="h-[48]" />\n`
    fs.writeFileSync(file, code)
    const looks = path.join(dir, "looks.json")
    const drawn = {
      looks: { a: { props: { className: "h-[48]", onPress: true } } },
    }
    fs.writeFileSync(
      looks,
      JSON.stringify({ drawnIn: "customerapp", ...drawn })
    )
    // a proof that doesn't say where it was drawn (proapp's 84f2287c file's
    // shape): refused, never taken (review-ca-w0's low)
    const foreign = path.join(dir, "foreign.json")
    fs.writeFileSync(
      foreign,
      JSON.stringify({ capturedAt: "f0b6c43", elements: 128, ...drawn })
    )
    const report = path.join(dir, "report.json")
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined)
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    try {
      const statusOf = async (...extra) => {
        await run([file, "--dry", "--no-probe", "--quiet", "--report", report, ...extra])
        return JSON.parse(fs.readFileSync(report, "utf8")).sites[0]
      }
      expect(await statusOf()).toMatchObject({ status: "left", reason: "unproven-look" })
      expect(await statusOf("--proven", looks)).toMatchObject({ status: "converted" })
      expect(
        await run([file, "--dry", "--no-probe", "--quiet", "--proven", foreign])
      ).toBe(2)
      expect(error.mock.calls.map((c) => c[0])).toContainEqual(
        expect.stringContaining(
          "foreign.json doesn't say its looks were drawn in customerapp's config"
        )
      )
    } finally {
      log.mockRestore()
      error.mockRestore()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
