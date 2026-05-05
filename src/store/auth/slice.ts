import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { api } from "services/api"

export type CurrentScreen = "welcome" | "auth-welcome" | "home"

export interface GuestLocationCoords {
  lat: number
  lng: number
}

export interface GuestLocationAddress {
  address: string
  city?: string
  governorate?: string
  coords: { lat: number; lon: number }
}

export interface GuestLocationState {
  coords: GuestLocationCoords | null
  address: GuestLocationAddress | null
}

export interface AuthState {
  isAuth: boolean
  token?: string
  refreshToken?: string
  user?: { id?: number; firstName?: string; lastName?: string; email?: string; mobileNumber?: string; gender?: "male" | "female" }
  language: "en" | "ar"
  hasPickedLanguage: boolean
  currentScreen?: CurrentScreen
  isLogout?: boolean
  guestLocation: GuestLocationState
  dontShowBestDealTooltip?: boolean
}

const initialState: AuthState = {
  isAuth: false,
  language: "en",
  hasPickedLanguage: false,
  isLogout: false,
  guestLocation: {
    coords: null,
    address: null,
  },
}

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setIsAuth: (state, action: PayloadAction<boolean>) => {
      state.isAuth = action.payload
    },
    setTokens: (
      state,
      action: PayloadAction<{ token: string; refreshToken: string }>
    ) => {
      state.token = action.payload.token
      state.refreshToken = action.payload.refreshToken
    },
    setLanguage: (state, action: PayloadAction<"en" | "ar">) => {
      state.language = action.payload
      state.hasPickedLanguage = true
    },
    setCurrentScreen: (
      state,
      action: PayloadAction<CurrentScreen | undefined>
    ) => {
      state.currentScreen = action.payload
    },
    setGuestLocation: (
      state,
      action: PayloadAction<{
        coords?: GuestLocationCoords | null
        address?: GuestLocationAddress | null
      }>
    ) => {
      if (!state.guestLocation) {
        state.guestLocation = { coords: null, address: null }
      }
      if (action.payload.coords !== undefined) {
        state.guestLocation.coords = action.payload.coords
      }
      if (action.payload.address !== undefined) {
        state.guestLocation.address = action.payload.address
      }
    },
    setDontShowBestDealTooltip: (state, action: PayloadAction<boolean>) => {
      state.dontShowBestDealTooltip = action.payload
    },
    logout: (state) => {
      state.isAuth = false
      state.user = undefined
      state.token = undefined
      state.refreshToken = undefined
      state.isLogout = false
      // Keep guestLocation so user can continue browsing after logout
      state.currentScreen = undefined
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(api.endpoints.auth.matchFulfilled, (state, { payload }) => {
      state.token = payload.token
      state.refreshToken = payload.refreshToken
      state.user = { ...state.user, id: payload.id }
      state.isAuth = true
    })
    builder.addMatcher(api.endpoints.getCustomerMe.matchFulfilled, (state, { payload }) => {
      state.user = {
        ...state.user,
        id: payload.id,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        mobileNumber: payload.mobileNumber,
        gender: payload.gender,
      }
    })
    builder.addMatcher(api.endpoints.updateCustomer.matchFulfilled, (state, { payload }) => {
      state.user = {
        ...state.user,
        id: payload.id,
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        mobileNumber: payload.mobileNumber,
        gender: payload.gender,
      }
    })
  },
})

export const {
  setIsAuth,
  setTokens,
  setLanguage,
  setCurrentScreen,
  setGuestLocation,
  setDontShowBestDealTooltip,
  logout,
} = authSlice.actions

export default authSlice.reducer
