/**
 * Jest only. Who a screen renders for: a signed-in customer, a guest who has
 * picked a location, and a fresh install. Made up, typed by the app's own
 * types (so a field the screens read can't silently go missing). No real
 * account's data.
 */
import type { AuthState } from "store/auth/slice"
import type { CustomerMeResponse, CustomerSavedAddress } from "types/auth"

/** A saved address, as GET /customers/me lists it. */
export const SAVED_HOME: CustomerSavedAddress = {
  id: 501,
  name: "Home",
  type: "home",
  address: {
    streetAddress: "12 Tahrir Street",
    city: "Dokki",
    governorate: "Giza",
    unitNumber: "4",
    location: { lat: 30.0444, lng: 31.2357 },
  },
}

export const SAVED_WORK: CustomerSavedAddress = {
  id: 502,
  name: "Work",
  type: "work",
  address: {
    streetAddress: "3 Nile Corniche",
    city: "Zamalek",
    governorate: "Cairo",
    location: { lat: 30.0626, lng: 31.2197 },
  },
}

/** GET /customers/me for the signed-in customer. */
export const CUSTOMER: CustomerMeResponse = {
  id: 2001,
  firstName: "Mona",
  lastName: "Adel",
  email: "customer.parity@example.com",
  mobileNumber: "+201000000001",
  gender: "female",
  status: "active",
  emailVerified: true,
  addresses: [SAVED_HOME, SAVED_WORK],
  preferredLanguage: "en",
}

/** Where a guest said they are (GuestLocationScreen / the map). */
export const GUEST_LOCATION: AuthState["guestLocation"] = {
  coords: { lat: 30.0444, lng: 31.2357 },
  address: {
    address: "12 Tahrir Street, Dokki",
    city: "Dokki",
    governorate: "Giza",
    coords: { lat: 30.0444, lon: 31.2357 },
  },
}

/**
 * A signed-in session for `customer` (the store's auth slice), with the
 * language picked, as after a sign-in. The auth slice keeps a slim copy of
 * the customer (getCustomerMe's matcher writes it).
 */
export const signedIn = (
  customer: CustomerMeResponse = CUSTOMER
): Partial<AuthState> => ({
  isAuth: true,
  token: "parity-token",
  refreshToken: "parity-refresh",
  hasPickedLanguage: true,
  user: {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    mobileNumber: customer.mobileNumber,
    gender: customer.gender,
  },
  // ProsListing's best-deal tooltip would cover the first visit.
  dontShowBestDealTooltip: true,
})

/** A guest browsing from a picked location (signed out, language picked). */
export const guest: Partial<AuthState> = {
  isAuth: false,
  token: undefined,
  refreshToken: undefined,
  user: undefined,
  hasPickedLanguage: true,
  guestLocation: GUEST_LOCATION,
  dontShowBestDealTooltip: true,
}

/** A fresh install: nobody signed in, no language picked, no location. */
export const freshInstall: Partial<AuthState> = {
  isAuth: false,
  token: undefined,
  refreshToken: undefined,
  user: undefined,
  hasPickedLanguage: false,
  guestLocation: { coords: null, address: null },
}
