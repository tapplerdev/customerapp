import type { HarvestedCase } from "testing/harvest"

/*
 * By hand: titles' classes that also set a colour, a margin or a start
 * alignment, so the `textStyle` and `textType` twins carry more than the one
 * site's size, leading, weight and centring. Each sets all four keys of the
 * title's own type (so replacing it and drawing over it are the same). A .tsx
 * so NativeWind compiles the classes written here.
 */
export const HAND_CLASSES = [
  "text-13 leading-[16px] font-custom500 text-center text-red mt-[4]",
  "text-12 leading-[15px] font-custom700 text-left text-grey2",
] as const

export const HAND_CLASSED: Record<string, HarvestedCase> = Object.fromEntries(
  HAND_CLASSES.map((textClassName, index) => [
    `hand title class ${index + 1}`,
    {
      props: {
        categories: { $opaque: "sections" },
        setSelectedCategory: { $fn: true },
        textClassName,
      },
      sites: ["by hand"],
    } as HarvestedCase,
  ])
)
