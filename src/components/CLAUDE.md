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
5. **OFFERS banner** — `OffersSection` component, only if pro has `motivational` subscriptions
6. **Promo line** — `PromoLine` component, only if pro has a `promoLine` subscription with `promoStickerMessage`
7. **Action buttons** — Chat (message icon, flex: 1) + Select Me (flex: 2, toggles selected state)

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
6. **Promo line** — same as ProCard
7. **OFFERS banner** — same as ProCard (compact mode)
8. **SELECT ME / PASS buttons** — two `ActionBtn` bordered buttons, only if `showSelectPassButtons && !isRejected`
9. **"Passed" label** — italic grey text, only if `isRejected`

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
Wrapper used by both OffersSection and PromoLine:
- Red tab at top-left ("OFFERS" or "OFFER" text, uppercase, white on red)
- Bordered content area below with configurable `borderRadius`
- Tab has top-rounded corners, content box has `borderTopRightRadius` on right side (creating the tab-detached effect)

### OffersSection (`components/OffersSection/`)
- Filters subscriptions for `subType === "motivational"`
- Returns null if no motivational subscriptions
- Renders each subscription's product picture as SVG sticker inside BannerContainer
- `compact` mode (used in cards): stickers 100px wide, 35px tall, horizontal row
- Full mode (used in ProProfileScreen): stickers scale to fill width

### PromoLine (`components/PromoLine/`)
- Renders `promoStickerMessage` text inside BannerContainer
- Pink background (`colors.pink5`)
- Banner tab says "OFFER" (singular)

### RateComponent (`components/RateComponent/`)
- 5 stars with partial fill based on score
- "New on Tappler" italic text when no reviews and `!showFullReviewText`
- `showFullReviewText` mode: larger text, "X of 5 (N reviews)"
- Compact mode: smaller text, "X of 5 (N)"

## Subscription Types

Subscriptions come from `pro.serviceCategories[0].subscriptions`. Relevant `product.subType` values:

| subType | What it renders | Component |
|---------|----------------|-----------|
| `motivational` | SVG sticker badges in OFFERS banner | OffersSection |
| `promoLine` | Text message in pink banner | PromoLine |
| `featuredPro` | Featured badge image in profile header | ProProfileScreen only |
