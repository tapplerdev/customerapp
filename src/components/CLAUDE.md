# Pro Card Rendering

Two card components render pro information. Both share the same visual building blocks but differ in context and available actions.

## ProCard (ProsListingScreen)

Used in search results when a customer browses pros for a service category. Located at `screens/dashboardScreens/ProsListingScreen/components/ProCard.tsx`.

### Rendering Order (top to bottom)

1. **Profile photo** — 85x85, rounded-2, grey placeholder if no photo
2. **Featured badge** — yellow pill positioned above photo (`absolute top-[-8]`), only if `serviceCategories[0].isFeatured`
3. **Info column** (right of photo):
   - Name (text-14, font-custom700)
   - Type icon (business/individual SVG) + location (city, governorate)
   - Star rating via `RateComponent`
   - Description (text-10, 2 lines max, only if `informationAbout` exists)
4. **Trust badges** — approved trust documents (`type === "trust" && status === "approved"`), rendered as SVG stickers via `SvgUriContainer`, horizontal flex-wrap
5. **OFFERS box** — tappler-shared's `OffersBox`, only if pro has `motivational` subscriptions with art to draw, or a promo line. Each sticker comes from tappler-shared's `components/OfferSticker` (`stickersOf` over `offerStickersOf`, drawn by `offerStickerCell` with this app's `SvgUriContainer`, #533): its icon above its caption (`OfferSticker`) when the product has an icon and a caption in the language, else its picture for the language, else dropped; in catalogue order (newest product first, as the catalogue lists them, so a renewal doesn't move a sticker); an icon that fails to load falls back to the picture, and when that fails too to the caption alone (`useFailedIcons` keeps both). The pro's promo line (a `promoLine` subscription with `promoStickerMessage`) is drawn in the same box as their text offer (`OffersBox`'s `promoMessage`, #533): a pink box under the one OFFERS tab, after the stickers if there are any. With neither, no box
6. **Action buttons** — Chat (message icon, flex: 1) + Select Me (flex: 2, toggles selected state)

### Data Source
- `pro: ProType` — full pro object from search API
- Subscriptions from `pro.serviceCategories[0].subscriptions`
- Trust docs from `pro.documents`

## ProCardBase (JobDetailScreen "Other Pros" tab)

Used when viewing a job's "Other Pros" — opportunity pros who found the job and sent offers. Located at `components/ProCardBase/ProCardBase.tsx`.

### Rendering Order (top to bottom)

1. **Profile photo** — same as ProCard (85x85)
2. **Featured badge** — same as ProCard
3. **Info column** (right of photo):
   - Name (text-14, font-custom700)
   - Type icon (business/individual) — NO location (unlike ProCard)
   - Star rating via `RateComponent`
   - Description (text-10, 2 lines max)
   - **Offer badge + amount** — bordered pill "Offer Amount" + EGP value (only if `showOfferBadge`)
   - **Unread mail icon** — envelope SVG with red count badge (only if `unreadCount > 0`)
4. **Opportunity notes bubble** — speech bubble with CSS triangle pointer, grey background (#E4E4E4), only if `showOpportunityNotes && opportunityNotes`
5. **Trust badges** — same as ProCard
6. **OFFERS box** (stickers, then the promo line's text offer) — same as ProCard
7. **SELECT ME / PASS buttons** — two `ActionBtn` bordered buttons, only if `showSelectPassButtons && !isRejected`
8. **"Passed" label** — italic grey text, only if `isRejected`

### Card Tap Behavior
- Whole card tappable to open chat (`onPress`)
- EXCEPT when select/pass buttons are showing — then `onPress` is disabled so buttons can be tapped independently

### Data Source
- Props are pre-extracted (displayName, photoUrl, etc.) — not a raw pro object
- Parent (`JobDetailScreen.renderOtherProCard`) extracts from `JobProType.pro`

## Selected Pros Tab (JobDetailScreen)

The "Selected Pros" tab uses inline rendering in `renderSelectedProCard` — NOT ProCardBase. Simpler layout:

1. Photo (85x85) + featured badge
2. Name, type, rating
3. Offer amount badge + unread mail icon
4. Separator line

No trust badges, no OFFERS banner, no promo line, no select/pass buttons. Tapping opens chat.

## Shared Sub-Components

### BannerContainer (`components/BannerContainer/`)
Wrapper used by OffersSection (it framed the old PromoLine too):
- Red tab at top-left ("OFFERS" or "OFFER" text, uppercase, white on red)
- Bordered content area below with configurable `borderRadius`
- Tab has top-rounded corners, content box has `borderTopRightRadius` on right side (creating the tab-detached effect)

### OffersSection (`components/OffersSection/`)
- Only FoodOrderView still uses it (stickers only, no promo line); the cards and the profile use shared's `OffersBox`
- Filters subscriptions for `subType === "motivational"`
- Returns null if no motivational subscriptions
- Renders each subscription's product picture as SVG sticker inside BannerContainer
- `compact` mode (used in cards): stickers 100px wide, 35px tall, horizontal row
- Full mode (used in ProProfileScreen): stickers scale to fill width

### The promo line (#533)
- No component of its own any more: the cards and the profile pass `promoStickerMessage` to shared's `OffersBox` as `promoMessage`, and it draws the text offer in the OFFERS box's frame (the stickers' grey edge and corners, a `#FFEBEB` ground, 12 in from every side, the one OFFERS tab)
- This app's `components/PromoLine` wrapper (shared's `PromoLine`, the "OFFER" banner) went with its last caller; its frozen twin fixtures stay under `components/PromoLine/` as a record

### RateComponent (`components/RateComponent/`)
- 5 stars with partial fill based on score
- "New on Tappler" italic text when no reviews and `!showFullReviewText`
- `showFullReviewText` mode: larger text, "X of 5 (N reviews)"
- Compact mode: smaller text, "X of 5 (N)"

## Subscription Types

Subscriptions come from `pro.serviceCategories[0].subscriptions`. Relevant `product.subType` values:

| subType | What it renders | Component |
|---------|----------------|-----------|
| `motivational` | Stickers in the OFFERS box: icon + caption, else the picture (#533) | shared `OffersBox` + `utils/offerStickers` (FoodOrderView: OffersSection) |
| `promoLine` | Text offer: a pink box in the OFFERS box, after the stickers (#533) | shared `OffersBox` (`promoMessage`) |
| `featuredPro` | Featured badge image in profile header | ProProfileScreen only |
