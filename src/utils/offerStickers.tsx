import React from "react"

import SvgUriContainer from "components/SvgUriContainer/SvgUriContainer"
import { OFFER_STICKER_HEIGHT } from "@tappler/shared/src/components/OffersBox"
import { offerStickerCell } from "@tappler/shared/src/components/OfferSticker/offerStickerCell"
import {
  offerStickersOf,
  type OfferStickerItem,
  type OfferStickerProduct,
} from "@tappler/shared/src/helpers/offerSticker"

/*
 * The last step of a sticker's fallback (#533), on top of tappler-shared's
 * offerStickerOf: an icon that fails to load falls back to the picture for
 * the language, and when that picture fails too the sticker is drawn as its
 * caption alone, as one with no picture is, rather than as an empty cell.
 * `failedArt` is useFailedIcons' set, which keeps the pictures that failed
 * beside the icons (stickerCell reports both). A sticker that only ever had
 * a picture keeps its cell when the picture fails, as before.
 */

/**
 * The product as offerStickerOf should see it: without the picture for the
 * language once its icon and that picture have both failed, so it is drawn
 * as its caption alone. Any other product is returned as it is.
 */
export const withoutFailedPicture = <P extends OfferStickerProduct>(
  product: P | null | undefined,
  isAr: boolean,
  failedArt: ReadonlySet<string>
): P | null | undefined => {
  const picture = isAr ? product?.pictureAr : product?.pictureEn
  if (
    !product?.icon ||
    !picture ||
    !failedArt.has(product.icon) ||
    !failedArt.has(picture)
  ) {
    return product
  }
  return isAr ? { ...product, pictureAr: "" } : { ...product, pictureEn: "" }
}

/** A service's stickers as drawn (offerStickersOf), with that step. */
export const stickersOf = (
  subscriptions: Parameters<typeof offerStickersOf>[0],
  isAr: boolean,
  failedArt: ReadonlySet<string>
) =>
  offerStickersOf(
    subscriptions?.map((sub) => ({
      ...sub,
      product: withoutFailedPicture(sub.product, isAr, failedArt),
    })),
    isAr,
    failedArt
  )

/**
 * One OFFERS box cell (tappler-shared's offerStickerCell, drawn with this
 * app's SvgUriContainer), a picture's failure reported to `onArtError` as an
 * icon's is.
 */
export const stickerCell = (
  item: OfferStickerItem,
  onArtError: (uri: string) => void
) => {
  if (item.kind === "stacked") {
    return offerStickerCell(item, SvgUriContainer, onArtError)
  }
  return (
    <SvgUriContainer
      key={item.key}
      width="100%"
      height={OFFER_STICKER_HEIGHT}
      uri={item.picture}
      onError={() => onArtError(item.picture)}
    />
  )
}
