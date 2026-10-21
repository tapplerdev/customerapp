/**
 * Jest only. The signed-in pro a screen renders for: made up, typed by the
 * app's own types (so a field the screens read can't silently go missing),
 * in two account types. No real account's data.
 */
import type { AuthState } from "store/auth/slice"
import type { UserType } from "types"

const ADDRESS = {
  streetAddress: "12 Tahrir Street",
  unitNumber: "4",
  longitude: 31.2357,
  latitude: 30.0444,
  city: "Dokki",
  governorate: "Giza",
  location: { lat: 30.0444, lng: 31.2357 },
}

const BASE: UserType = {
  id: 1001,
  email: "pro.parity@example.com",
  registeredName: "Omar Hassan",
  firstName: "Omar",
  lastName: "Hassan",
  displayName: "full",
  proType: "individual",
  mobileNumber: "+201000000000",
  accountStatus: "active",
  lastSeen: "2026-10-20T07:30:00.000Z",
  signupPlatform: "email",
  pointsBalance: 120,
  informationAbout:
    "Ten years fixing plumbing and electrics in Giza and Cairo. Clean work, fair prices.",
  profilePhoto: "https://example.com/parity/profile.jpg",
  dateOfBirth: "1990-05-12",
  gender: "male",
  referral: "google",
  serviceLocation: { locationType: "home", isRemote: false, cities: ["Giza"] },
  hours: [
    {
      id: 1,
      proId: 1001,
      dayOfWeek: "sunday",
      openingTime: "09:00",
      closingTime: "17:00",
    },
    {
      id: 2,
      proId: 1001,
      dayOfWeek: "monday",
      openingTime: "09:00",
      closingTime: "17:00",
    },
  ],
  documents: [],
  media: [],
  socials: [
    { id: 1, socialMedia: "facebook", socialLink: "https://facebook.com/x" },
  ],
  address: { address: ADDRESS, changedAt: "2026-01-10T10:00:00.000Z" },
  addressHistory: [],
  suspensions: [],
  businessName: "",
  paymentMethods: ["cash", "credit card"],
  profileEdits: [],
  isFeatured: false,
  responseTimeHours: 2,
  responseTimeScore: 4,
  reviewScore: {
    qualityScore: 4.5,
    completionInTimeScore: 4.2,
    jobAwarenessScore: 4.4,
    honestyScore: 4.8,
    responseTimeScore: 4,
    overallScore: 4.4,
    reviewsCount: 12,
  },
  emailVerified: true,
  photosOfWork: [],
  registrationDate: "2025-03-01T09:00:00.000Z",
  responseTimePeriods: {
    weekResponseTime: 2,
    monthResponseTime: 3,
    lifeTimeResponseTime: 4,
  },
}

/** An individual pro with a full name, active, email verified. */
export const PRO_INDIVIDUAL: UserType = BASE

/** A company: its business name, the same contact person. */
export const PRO_COMPANY: UserType = {
  ...BASE,
  id: 1002,
  proType: "company",
  businessName: "Hassan Home Services",
  registeredName: "Hassan Home Services",
  displayName: undefined,
}

/** A signed-in session for `user` (the store's auth slice). */
export const signedIn = (
  user: UserType = PRO_INDIVIDUAL
): Partial<AuthState> => ({
  isAuth: true,
  isRegistrationFlowComleted: true,
  token: "parity-token",
  refreshToken: "parity-refresh",
  user,
  isOnboardingCompleted: true,
  isFirstLoginCompleted: true,
  isDocumentLoaded: true,
  isNotificationsAllowed: true,
  notificationPermissionStatus: "granted",
  isNotificationServiceInitialized: true,
  // The two pop-ups that would cover the first screen of a fresh session.
  isWaitAMomentModalPossibleVisible: false,
  isNotificationRequestWasShowing: true,
})

/** No one signed in (onboarding, sign-up and log-in screens). */
export const signedOut: Partial<AuthState> = {
  isAuth: false,
  user: undefined,
  token: undefined,
  refreshToken: undefined,
  isOnboardingCompleted: true,
}
