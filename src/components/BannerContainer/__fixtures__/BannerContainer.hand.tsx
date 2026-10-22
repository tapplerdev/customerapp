import type { HarvestedCase } from "testing/harvest"

/*
 * By hand: the cases that pass the block's own class, or both classes at
 * once. The one call site passes a box class and no block class. A .tsx so
 * NativeWind compiles the classes written here; the parity test pins what
 * they drew, the twins test what the codemod's `style` and `containerStyle`
 * draw instead.
 */
export const HAND_CLASSES = [
  "mt-[16]",
  "mx-[12] mt-[4]",
  "px-[3] py-[5] flex-row",
] as const

const label = { $el: "DmText", children: "x" } as const

export const HAND_CLASSED: Record<string, HarvestedCase> = {
  "hand padded box, a block class, radius 6": {
    props: {
      bannerText: "Offers",
      className: "mt-[16]",
      borderRadius: 6,
      children: label,
    },
    sites: ["by hand"],
  },
  "hand block and box classes": {
    props: {
      bannerText: "Offers",
      className: "mx-[12] mt-[4]",
      containerClassName: "px-[3] py-[5] flex-row",
      borderRadius: 4,
      children: label,
    },
    sites: ["by hand"],
  },
}
