import { describe, it, jest } from "@jest/globals"
import path from "path"
import React from "react"

/*
 * BannerContainer's class-name path (the red OFFERS tab over a bordered
 * box), pinned to what it drew before its conversion and its twins, for
 * every prop set its call site hands it, and by hand for the padded box,
 * the block's own class and the box style no site passes.
 *
 * The prop sets are harvested from the call site (testing/harvest) and
 * frozen in __fixtures__/BannerContainer.cases.json; their class strings
 * are written out in __fixtures__/BannerContainer.classes.tsx, imported
 * here so NativeWind compiles them, and checked first. The stickers inside
 * are stand-ins. The trees in __parity__ were captured from
 * BannerContainer before its conversion (each case names the commit).
 * Both languages, both platforms.
 *
 * BannerContainer.twins.test.tsx draws the same cases through the twins the
 * codemod writes, against these same trees.
 *
 *   DS_HARVEST=1 jest <this file>              re-harvest (writes the cases and classes)
 *   yarn ds:parity:capture <this file> --force  recapture, on the old code only
 */

/* eslint-disable global-require, @typescript-eslint/no-var-requires -- a
   jest.mock factory must require lazily: it is hoisted above every import. */
jest.mock("react-native-localize", () =>
  jest.requireActual("react-native-localize/mock")
)
/* eslint-enable global-require, @typescript-eslint/no-var-requires */

/* eslint-disable import/first */
// The harvested class strings, compiled (see the file).
import "../__fixtures__/BannerContainer.classes"
import { DmText, DmView } from "@tappler/shared/src/components/UI"
import {
  PARITY_MATRIX,
  captureCommit,
  expectParity,
  hostTree,
  parityName,
} from "testing/hostTreeParity"
import {
  buildProps,
  classStringsOf,
  componentImport,
  harvestFilesFor,
  harvesting,
  readHarvest,
  writeHarvest,
  type HarvestOptions,
} from "testing/harvest"
import { describeCompiledClasses } from "testing/harvest/compiledClasses"
import BannerContainer from "../BannerContainer"
/* eslint-enable import/first */

/** The tags a site's element props name that draw themselves here (the rest are stand-ins). */
const ELEMENTS = {
  DmText: DmText as React.ComponentType<object>,
  DmView: DmView as React.ComponentType<object>,
}

type Props = React.ComponentProps<typeof BannerContainer>

/**
 * By hand: the one call site passes a box class and no block class, so no
 * harvested row draws the box's own 8pt padding (what a box class, even an
 * empty one, replaces) or a block class.
 */
const HAND: Record<string, Props> = {
  "hand no box class (the padded box)": {
    bannerText: "Offers",
    children: <DmText>x</DmText>,
  },
  "hand padded box, a block class, radius 6": {
    bannerText: "Offers",
    className: "mt-[16]",
    borderRadius: 6,
    children: <DmText>x</DmText>,
  },
  "hand an empty box class": {
    bannerText: "Offers",
    containerClassName: "",
    children: <DmText>x</DmText>,
  },
}

/** The class strings the hand cases pass (NativeWind compiles this file's). */
const HAND_CLASSES = ["mt-[16]"]

const FILES = harvestFilesFor(__dirname, "BannerContainer")

const OPTIONS: HarvestOptions = {
  srcRoot: path.resolve(__dirname, "../../.."),
  importFrom: componentImport("BannerContainer"),
  props: {
    bannerText: "text",
    children: "node",
    className: "class",
    containerClassName: "class",
    containerStyle: "any",
    borderRadius: "value",
  },
  rewrites: {
    "components/OffersSection/OffersSection.tsx:106": {
      reason:
        "OffersSection draws its stickers in the box: two stand-ins (the box styles them, never the other way), and picks the box's classes by compact, with the corner radius",
      values: {
        "stickerProducts.map((sub: any, idx: number) => { const imageUrl = isAr ? sub.product?.pictureAr : sub.product?.pictureEn return imageUrl ? ( <SvgUriContainer key={sub.id || idx} width={stickerWidth} {...(compact && { height: 35 })} uri={imageUrl} /> ) : null })":
          "[<SvgUriContainer width={120} />, <SvgUriContainer width={120} />]",
      },
    },
  },
}

if (harvesting()) {
  describe("the harvest", () => {
    it("writes the cases and the class strings NativeWind has to compile", () => {
      writeHarvest(FILES, "BannerContainer", OPTIONS, captureCommit())
    })
  })
} else {
  const harvested = readHarvest(FILES)
  const { cases } = harvested

  describeCompiledClasses(harvested, FILES, [
    ...classStringsOf(harvested.cases),
    ...HAND_CLASSES,
  ])

  describe("BannerContainer draws as before", () => {
    const table = Object.entries(cases).flatMap(([id, entry]) =>
      PARITY_MATRIX.map((env) => ({ id, site: entry.sites[0], entry, env }))
    )
    it.each(table)(
      "$id ($site) [$env.language $env.platform]",
      ({ id, entry, env }) => {
        expectParity(
          parityName(id, env),
          hostTree(
            <BannerContainer
              {...(buildProps(entry.props, {
                elements: ELEMENTS,
              }) as React.ComponentProps<typeof BannerContainer>)}
            />,
            env
          )
        )
      }
    )

    const hand = Object.entries(HAND).flatMap(([id, props]) =>
      PARITY_MATRIX.map((env) => ({ id, props, env }))
    )
    it.each(hand)("$id [$env.language $env.platform]", ({ id, props, env }) => {
      expectParity(
        parityName(id, env),
        hostTree(<BannerContainer {...props} />, env)
      )
    })
  })
}
