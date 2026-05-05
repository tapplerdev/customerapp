// POST /customers — request
export interface CustomerSignUpRequest {
  firstName: string
  lastName: string
  email: string
  password: string
  mobileNumber: string
  gender: "male" | "female"
  signupPlatform: "email" | "google" | "facebook"
}

// POST /customers — response
export interface CustomerSignUpResponse {
  id: number
  firstName: string
  lastName: string
  email: string
  mobileNumber: string
  gender: "male" | "female"
  status: string
  signupPlatform: string
}

// POST /auth — request
export interface AuthRequest {
  email: string
  password: string
  userType: "customer"
  rememberMe: boolean
}

// POST /auth — response
export interface AuthResponse {
  token: string
  refreshToken: string
  id: number
  userType: "customer"
}

// Customer saved address types
export interface CustomerAddressLocation {
  lat: number
  lng: number
}

export interface CustomerAddressDetail {
  streetAddress?: string
  city: string
  governorate: string
  unitNumber?: string
  location: CustomerAddressLocation
}

export interface CustomerSavedAddress {
  id: number
  name: string
  type: string
  address: CustomerAddressDetail
}

export interface CreateCustomerAddressRequest {
  name: string
  type: string
  streetAddress: string
  city: string
  governorate: string
  location: CustomerAddressLocation
}

// GET /customers/me — response
export interface CustomerMeResponse {
  id: number
  firstName: string
  lastName: string
  email: string
  mobileNumber: string
  gender: "male" | "female"
  status: string
  emailVerified: boolean
  addresses?: CustomerSavedAddress[]
}

// PATCH /customers — request
export interface UpdateCustomerRequest {
  firstName?: string
  lastName?: string
  gender?: "male" | "female"
  mobileNumber?: string
  email?: string
  password?: { currentPassword: string; newPassword: string }
}
