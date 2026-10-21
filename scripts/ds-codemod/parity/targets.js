/**
 * The real files the parity run converts and draws, with the props each is
 * drawn with: customerapp's, chosen to cover the shapes its waves meet.
 * MainModal cards whose button classes draw here (in proapp a wrapper
 * dropped them), a list row with an Animated swipe, a card with its colours
 * in DmText styles, a dead class prop, a bill whose classes wait on its
 * text style, an ActionBtn that waits for its look's proof, a form screen
 * and the onboarding screen's faces (font-sans700, font-montserrat600, and
 * the unshipped TheSans-Regular that stays for a bridge). `recipes(h)` is
 * called inside jest (`h` is React.createElement); FILES is plain data for
 * the runner. (proapp's targets were its own components.)
 */
const noop = () => undefined

const DATE = "2026-10-19T10:00:00.000Z"

const job = {
  id: 41,
  status: "active",
  requestedOn: DATE,
  serviceCategoryId: 3,
  customerId: 9,
  createdAt: DATE,
  updatedAt: DATE,
  deliveryFee: 25,
  orderDiscount: 10,
  foodOrderItems: [
    {
      id: 1,
      menuItemId: 11,
      name: "Koshary",
      price: 60,
      quantity: 2,
      selectedOptions: [
        { optionName: "Size", choices: [{ name: "Large", price: 15 }] },
      ],
    },
    { id: 2, menuItemId: 12, name: "Rice pudding", price: 35, quantity: 1 },
  ],
}

const chatPreview = (overrides = {}) => ({
  chat: {
    id: 7,
    status: "active",
    proId: 3,
    customerId: 9,
    pro: {
      id: 3,
      registeredName: "Ahmed Plumbing",
      proType: "company",
      lastSeen: DATE,
    },
    serviceCategoryId: 3,
    serviceCategory: { id: 3, nameEn: "Plumbing", nameAr: "سباكة" },
  },
  notReadMessages: 2,
  hasHumanMessages: true,
  lastMessage: {
    id: 90,
    text: "I can come tomorrow at 10",
    ownerType: "pro",
    createdAt: DATE,
  },
  ...overrides,
})

const cancelState = (overrides = {}) => ({
  cancelReasons: ["found_another", "too_expensive", "other"],
  selectedReasons: [],
  toggleReason: noop,
  otherReasonText: "",
  setOtherReasonText: noop,
  handleSubmitCancel: noop,
  isSubmitting: false,
  hasOtherSelected: false,
  canSubmit: false,
  ...overrides,
})

const RECIPES = [
  // --- MainModal cards: their button classes draw (shared's own buttons)
  {
    file: "src/components/ErrorModal/ErrorModal.tsx",
    cases: () => [
      {
        name: "title and description",
        props: {
          isVisible: true,
          onClose: noop,
          title: "Something went wrong",
          descr: "Please try again",
        },
      },
    ],
  },
  {
    file: "src/components/LogoutModal/LogoutModal.tsx",
    cases: () => [
      {
        name: "idle",
        props: {
          isVisible: true,
          onClose: noop,
          onModalHide: noop,
          onPress: noop,
        },
      },
      {
        name: "signing out",
        props: {
          isVisible: true,
          onClose: noop,
          onModalHide: noop,
          onPress: noop,
          isLoading: true,
        },
      },
    ],
  },
  {
    file: "src/components/SuccessModal/SuccessModal.tsx",
    cases: () => [
      {
        name: "title and description",
        props: {
          isVisible: true,
          onClose: noop,
          title: "Done",
          descr: "Your request was sent",
        },
      },
    ],
  },
  {
    file: "src/components/LeaveReviewModal/LeaveReviewModal.tsx",
    cases: () => [
      {
        name: "plumbing",
        props: {
          isVisible: true,
          onClose: noop,
          onLeaveReview: noop,
          categoryName: "Plumbing",
        },
      },
    ],
  },
  {
    file: "src/components/CancelJobFeedbackModal/CancelJobFeedbackModal.tsx",
    cases: () => [
      { name: "nothing picked", props: { isVisible: true, onClose: noop, cancel: cancelState() } },
      {
        name: "other, typed, ready",
        props: {
          isVisible: true,
          onClose: noop,
          cancel: cancelState({
            selectedReasons: ["other"],
            hasOtherSelected: true,
            otherReasonText: "Changed my plans",
            canSubmit: true,
          }),
        },
      },
    ],
  },
  // --- a card whose colours sit in DmText styles (dsColors' whiteAlpha65/90)
  {
    file: "src/components/OfferUpdateCard/OfferUpdateCard.tsx",
    cases: () => [
      { name: "price down", props: { previous: 1200, next: 950, time: "10:30" } },
      { name: "no time", props: { previous: 300, next: 450 } },
    ],
  },
  // --- a dead className prop beside live classes
  {
    file: "src/components/RateComponent/RateComponent.tsx",
    cases: () => [
      { name: "rate and reviews", props: { rate: 4.5, reviewsCount: 12 } },
      {
        name: "full text, small stars",
        props: { rate: 3, reviewsCount: 1, itemSize: 12, showFullReviewText: true },
      },
    ],
  },
  // --- border-0.2: a class NativeWind drops, left out and listed
  {
    file: "src/components/SearchMessagesComponent/SearchMessagesComponent.tsx",
    cases: () => [
      { name: "empty", props: { searchText: "", onChangeText: noop } },
      { name: "typed", props: { searchText: "plumb", onChangeText: noop } },
    ],
  },
  // --- a list row: Animated swipe, an unread badge, right to left
  {
    file: "src/components/MessagesComponent/MessagesComponent.tsx",
    cases: () => [
      { name: "unread text", props: { item: chatPreview(), onPress: noop, onArchive: noop } },
      {
        name: "read, no message",
        props: {
          item: chatPreview({ notReadMessages: 0, lastMessage: undefined }),
          onPress: noop,
        },
      },
    ],
  },
  // --- a bill whose texts wait on their caller's textStyle (left), its
  // rows converted
  {
    file: "src/components/OrderBill/OrderBill.tsx",
    cases: () => [
      { name: "delivery", props: { job } },
      { name: "pickup", props: { job, isPickup: true } },
    ],
  },
  // --- an ActionBtn badge, left until its look is proven, in a row that
  // converts around it
  {
    file: "src/components/FoodMenuItemRow/FoodMenuItemRow.tsx",
    cases: () => [
      {
        name: "in stock, none in the cart",
        props: {
          item: {
            id: 11,
            name: "Koshary",
            description: "Rice, lentils, pasta and a spicy tomato sauce",
            price: 60,
            discountPrice: 0,
            isExpressDeliveryAvailable: true,
            isPreOrderOnly: false,
            photo: "",
            inStock: true,
          },
          onPress: noop,
          onQuickAdd: noop,
        },
      },
      {
        name: "discounted, two in the cart",
        props: {
          item: {
            id: 12,
            name: "Rice pudding",
            description: "",
            price: 35,
            discountPrice: 30,
            isExpressDeliveryAvailable: false,
            isPreOrderOnly: true,
            leadTimeHours: 24,
            photo: "",
          },
          cartQty: 2,
          onPress: noop,
          onQuickAdd: noop,
          onQuickRemove: noop,
        },
      },
    ],
  },
  // --- screens
  {
    file: "src/screens/dashboardScreens/AboutAppScreen/AboutAppScreen.tsx",
    screen: true,
    cases: () => [{ name: "as opened", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/DeleteAccountScreen/DeleteAccountScreen.tsx",
    screen: true,
    cases: () => [{ name: "as opened", props: {} }],
  },
  {
    file: "src/screens/onboardingScreens/WelcomeScreen/WelcomeScreen.tsx",
    screen: true,
    cases: () => [{ name: "fresh install", props: {} }],
  },
]

const FILES = RECIPES.map((r) => r.file)

module.exports = { FILES, RECIPES }
