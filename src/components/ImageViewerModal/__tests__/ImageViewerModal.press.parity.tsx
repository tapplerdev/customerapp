/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   the kit loads each render's modules in the render's registry. */
import { describe, expect, it, jest } from "@jest/globals"

import { openScreen, pressIcon } from "testing/screenKit"
import { PARITY_MATRIX } from "testing/hostTreeParity"

/*
 * ImageViewerModal's close X closes the viewer: a press calls onClose once,
 * with one photo and with several. (A handler swapped for one that does
 * nothing draws the same tree until it is pressed.)
 */

const PHOTOS = [
  { uri: "https://photos.parity.invalid/1.jpg" },
  { uri: "https://photos.parity.invalid/2.jpg" },
  { uri: "https://photos.parity.invalid/3.jpg" },
]

const CASES = [
  { name: "one photo", images: PHOTOS.slice(0, 1) },
  { name: "three photos", images: PHOTOS },
]

describe.each(PARITY_MATRIX)(
  "ImageViewerModal's close [$language $platform]",
  (env) => {
    it.each(CASES)("closes once, $name", async (row) => {
      const onClose = jest.fn()
      const load = () => {
        const React = require("react") as typeof import("react")
        const Viewer = require("../ImageViewerModal").default
        const Harness = () =>
          React.createElement(Viewer, {
            isVisible: true,
            onClose,
            images: row.images,
          })
        return { default: Harness }
      }
      const session = await openScreen(load, {
        lang: env.language,
        platform: env.platform,
        navigation: "none",
      })
      try {
        expect(onClose).not.toHaveBeenCalled()
        await session.act(() => {
          pressIcon(session.root, { icon: "svg:close" })
        })
        expect(onClose).toHaveBeenCalledTimes(1)
      } finally {
        session.unmount()
      }
    })
  }
)
