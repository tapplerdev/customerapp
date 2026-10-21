/**
 * The real files the parity run converts and draws, with the props each is
 * drawn with. Chosen to cover the shapes wave 2 meets: list rows, modal
 * cards, form screens, right-to-left fixes, Animated styles, clsx
 * conditions, compiler temporaries. `recipes(h)` is called inside jest (`h`
 * is React.createElement); FILES is plain data for the runner.
 */
const noop = () => undefined

const RECIPES = [
  // --- list rows
  {
    file: "src/components/SettingsItem/SettingsItem.tsx",
    cases: (h, icon) => [
      {
        name: "chevron",
        props: {
          title: "Notifications",
          mode: "default",
          onPress: noop,
          Icon: icon,
        },
      },
      {
        name: "red, done",
        props: {
          title: "Log out",
          textVariant: "red",
          isMarkDone: true,
          mode: "none",
        },
      },
      {
        name: "button",
        props: {
          title: "Version",
          btnTitle: "Update",
          mode: "none",
          titleChevron: "1.1.0",
        },
      },
    ],
  },
  {
    file: "src/components/QuotesItem/QuotesItem.tsx",
    cases: () =>
      ["awaiting", "paid", "expired", "cancelled"].map((status) => ({
        name: status,
        props: {
          status,
          onPress: noop,
          item: {
            quoteId: 7,
            quoteNumber: "Q-0007",
            price: 1250,
            date: "2025-01-01T10:00:00.000Z",
            serviceCategoryNameEn: "Plumbing",
            serviceCategoryNameAr: "سباكة",
          },
        },
      })),
  },
  {
    file: "src/components/MyPointsActivityItem/MyPointsActivityItem.tsx",
    cases: () =>
      [
        ["purchase", "done"],
        ["spend", "pending"],
      ].map(([type, status]) => ({
        name: `${type} ${status}`,
        props: {
          onPress: noop,
          item: {
            id: 1,
            type,
            status,
            pointsAdded: 20,
            amountBefore: 10,
            amountAfter: 30,
            date: "2025-01-01T10:00:00.000Z",
            proId: 1,
            pointsPackageId: null,
            pointsPackage: { id: 1, points: 20, price: 100 },
          },
        },
      })),
  },
  {
    file: "src/components/MyPointsVoucherItem/MyPointsVoucherItem.tsx",
    cases: () => [
      {
        name: "voucher",
        props: {
          onPress: noop,
          item: {
            id: 1,
            assignDate: "2025-01-01T10:00:00.000Z",
            claimDate: null,
            notes: "Welcome",
            proId: 1,
            status: "active",
          },
        },
      },
    ],
  },
  {
    file: "src/components/OpportunityItem/OpportunityItem.tsx",
    cases: () =>
      [false, true].map((isHighlighted) => ({
        name: isHighlighted ? "highlighted" : "plain",
        props: {
          now: Date.parse("2025-01-02T10:00:00.000Z"),
          onPress: noop,
          onNotInterestPress: noop,
          isHighlighted,
          item: {
            id: 42,
            isFavorite: false,
            requestedOn: "2025-01-01T10:00:00.000Z",
            customer: { firstName: "Mona", lastName: "Adel" },
            serviceCategory: {
              nameEn: "Plumbing",
              nameAr: "سباكة",
              opportunityPointsCost: 3,
            },
            address: { address: { city: "Giza" } },
            serviceArea: { name: "Dokki" },
          },
        },
      })),
  },
  // --- modal cards
  {
    file: "src/components/AccountStatusModal/AccountStatusModal.tsx",
    cases: () => [
      { name: "visible", props: { isVisible: true, onClose: noop } },
    ],
  },
  {
    file: "src/components/DocumentExpiryModal/DocumentExpiryModal.tsx",
    cases: () => [
      {
        name: "documents expired",
        props: {
          isVisible: true,
          notice: { type: "documents", state: "expired" },
          onRenew: noop,
          onLater: noop,
        },
      },
    ],
  },
  {
    file: "src/components/QuestionsOutdatedModal/QuestionsOutdatedModal.tsx",
    cases: () => [
      {
        name: "two services",
        props: {
          isVisible: true,
          services: [
            { id: 1, name: "Plumbing" },
            { id: 2, name: "Painting" },
          ],
          onUpdateNow: noop,
          onRemindLater: noop,
        },
      },
    ],
  },
  {
    file: "src/components/FoodOrderStatusModal/FoodOrderStatusModal.tsx",
    cases: () =>
      [false, true].map((isLoading) => ({
        name: isLoading ? "saving" : "idle",
        props: {
          isVisible: true,
          onClose: noop,
          onSubmit: noop,
          currentStatus: "accepted",
          isLoading,
        },
      })),
  },
  // --- forms
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountDisplayNameScreen/MyAccountDisplayNameScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountPhoneNumberScreen/MyAccountPhoneNumberScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountScreen/MyAccountScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountChangePasswordScreen/MyAccountChangePasswordScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountVerifyPasswordScreen/MyAccountVerifyPasswordScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountVerifyEmailScreen/MyAccountVerifyEmailScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountNewPasswordScreen/MyAccountNewPasswordScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountDetailsScreen/MyAccountDetailsScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountTypeScreen/MyAccountTypeScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/screens/dashboardScreens/myAccountScreens/MyAccountResetPasswordScreen/MyAccountResetPasswordScreen.tsx",
    screen: true,
    cases: () => [{ name: "screen", props: {} }],
  },
  {
    file: "src/components/InputInsideText/InputInsideText.tsx",
    cases: () => [
      {
        name: "with descr",
        props: {
          title: "Price",
          descr: "EGP",
          value: "120",
          onChangeText: noop,
        },
      },
    ],
  },
  // --- right to left
  {
    file: "src/components/PhoneInput/PhoneInput.tsx",
    cases: () => [
      { name: "number", props: { value: "1012345678", onChangeText: noop } },
    ],
  },
  {
    file: "src/components/FilterItem/FilterItem.tsx",
    cases: () =>
      [false, true].map((isSelected) => ({
        name: isSelected ? "selected" : "plain",
        props: {
          title: "Area",
          titleChevron: "Giza",
          onPress: noop,
          isSelected,
          isChevronVisible: true,
        },
      })),
  },
  {
    file: "src/components/HelpCard/HelpCard.tsx",
    cases: (h, icon) => [
      {
        name: "chevron",
        props: {
          Icon: icon,
          title: "Contact us",
          descr: "We reply within a day",
          onPress: noop,
          showChevron: true,
        },
      },
    ],
  },
  // --- Animated
  {
    file: "src/components/ScoreAccordeon/ScoreAccordeon.tsx",
    cases: () => [
      {
        name: "item",
        props: { item: { title: "score_title", descr: "score_descr" } },
      },
    ],
  },
  {
    file: "src/components/BottomPopup/BottomPopup.tsx",
    cases: (h) => [
      {
        name: "open",
        props: { isVisible: true, onClose: noop, children: h("View", null) },
      },
    ],
  },
  // --- clsx conditions
  {
    file: "src/components/StatusComponent/StatusComponent.tsx",
    cases: () =>
      ["active", "pending", "inactive"].map((status) => ({
        name: status,
        props: { status },
      })),
  },
  {
    file: "src/components/RegisterFlowProgressBar/RegisterFlowProgressBar.tsx",
    cases: () =>
      [1, 3].map((currentStep) => ({
        name: `step ${currentStep}`,
        props: { currentStep, titleCurrentStep: "Profile" },
      })),
  },
  {
    file: "src/components/MyProfileSettingsCheckboxComponent/MyProfileSettingsCheckboxComponent.tsx",
    cases: () => [
      {
        name: "subtitle",
        props: {
          title: "Languages",
          subtitle: "Arabic, English",
          onPress: noop,
        },
      },
      {
        name: "list",
        props: {
          title: "Payments",
          subtitleArrPayments: ["cash", "card"],
          checkIcon: true,
        },
      },
    ],
  },
  {
    file: "src/components/OnboardingFooter/OnboardingFooter.tsx",
    cases: () =>
      [false, true].map((isLogoVisible) => ({
        name: `logo ${isLogoVisible}`,
        props: { isLogoVisible },
      })),
  },
  {
    file: "src/components/QuestionComponent/QuestionComponent.tsx",
    cases: () => {
      const question = (style, type) => ({
        id: 1,
        assignee: "pro",
        type,
        text: "How big is the job?",
        textAr: "ما حجم العمل؟",
        order: 1,
        options: [
          { id: 1, label: "Small", labelAr: "صغير", value: "small" },
          { id: 2, label: "Large", labelAr: "كبير", value: "large" },
        ],
        style,
        layoutQuestionStyle: null,
        dateType: null,
        timeType: null,
        timeText: null,
        isFilter: false,
        filterId: null,
        filterKey: null,
      })
      return [
        ["checkmark", "oneChoice"],
        ["chips", "multipleChoice"],
        ["radio", "oneChoice"],
        ["checkbox", "multipleChoice"],
        [null, "shortAnswer"],
      ].map(([style, type]) => ({
        name: `${style} ${type}`,
        props: {
          onChangeAnswer: noop,
          note: style === "chips" ? "Answer again" : undefined,
          answers: [{ questionId: 1, optionsIds: [2], answer: "large" }],
          item: question(style, type),
        },
      }))
    },
  },
  // --- typography in a DmText's own style, moved into Text's props
  {
    file: "src/components/NotificationTestPanel/NotificationTestPanel.tsx",
    cases: () => [{ name: "panel", props: {} }],
  },
  {
    file: "src/components/OfferHistorySheet/OfferHistorySheet.tsx",
    cases: () => [
      {
        name: "two offers",
        props: { isVisible: true, onClose: noop, jobId: 9, proId: 1 },
        queries: {
          useGetOfferHistoryQuery: {
            data: [
              { id: 2, ratePerHour: 550, createdAt: "2026-10-19T10:30:00Z" },
              { id: 1, ratePerHour: 500, createdAt: "2026-10-18T09:00:00Z" },
            ],
          },
        },
      },
    ],
  },
  {
    file: "src/screens/dashboardScreens/MessagesScreens/ExpiredOpportunityScreen/ExpiredOpportunityScreen.tsx",
    screen: true,
    cases: () => [
      {
        name: "expired offer",
        props: {
          route: {
            key: "parity",
            name: "expired-opportunity",
            params: {
              job: {
                id: 9,
                pros: [
                  {
                    proId: 1,
                    selectionStatus: "selected",
                    proOpportunityOfferSentAt: "2026-10-18T09:00:00Z",
                    ratePerHour: 500,
                  },
                ],
                serviceCategory: { nameEn: "Plumbing", nameAr: "سباكة" },
                customer: { firstName: "Mona", lastName: "Ali" },
                address: {
                  address: { streetAddress: "12 Tahrir St", city: "Giza" },
                },
              },
            },
          },
        },
      },
    ],
  },
]

const FILES = RECIPES.map((r) => r.file)

module.exports = { FILES, RECIPES }
