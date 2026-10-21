/**
 * Jest only. Props for the screen-local components a screen reaches only
 * through taps (the send-offer flow's later steps), by file under src, so
 * the coverage sweep can draw them on their own. A component's own parity
 * test harvests its real call sites instead (testing/harvest).
 */
const noop = () => undefined

export const COMPONENT_PROPS: Record<string, Record<string, unknown>> = {
  "screens/dashboardScreens/SendOfferScreen/components/DetailsStep.tsx": {
    path: "quote",
    amount: "300",
    message: "I can come on Thursday at 10.",
    onChangeAmount: noop,
    onChangeMessage: noop,
    onBack: noop,
    onNext: noop,
    onOpenTips: noop,
  },
  "screens/dashboardScreens/SendOfferScreen/components/ReviewStep.tsx": {
    source: "opportunity",
    path: "quote",
    amount: "300",
    message: "I can come on Thursday at 10.",
    pointsCost: 5,
    pointsBalance: 120,
    isSending: false,
    onBack: noop,
    onSend: noop,
    onBuyPoints: noop,
  },
  // A photo picked but not uploaded yet (the picker never answers here).
  "screens/dashboardScreens/MyServiceWorkPhotosScreen/components/DraftPhotoTile.tsx":
    {
      media: {
        path: "file:///parity/draft-1.jpg",
        mime: "image/jpeg",
        size: 120000,
        width: 1440,
        height: 1080,
        filename: "draft-1.jpg",
      },
      onPress: noop,
      onDelete: noop,
    },
  "screens/dashboardScreens/SendOfferScreen/components/MessageField.tsx": {
    value: "I can come on Thursday at 10.",
    onChangeText: noop,
    height: 120,
  },
}
