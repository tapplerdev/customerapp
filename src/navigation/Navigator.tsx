import React, { useEffect } from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { useDispatch } from "react-redux"
import { RootStackParamList } from "./types"
import WelcomeScreen from "screens/onboardingScreens/WelcomeScreen/WelcomeScreen"
import AuthWelcomeScreen from "screens/onboardingScreens/AuthWelcomeScreen/AuthWelcomeScreen"
import RegisterScreen from "screens/onboardingScreens/RegisterScreen/RegisterScreen"
import SignInEmailScreen from "screens/onboardingScreens/SignInEmailScreen/SignInEmailScreen"
import GuestLocationScreen from "screens/onboardingScreens/GuestLocationScreen/GuestLocationScreen"
import PickAddressScreen from "screens/PickAddressScreen"
import HomeTabs from "./HomeTabs"
import AccountDetailsScreen from "screens/dashboardScreens/AccountDetailsScreen/AccountDetailsScreen"
import MyInformationScreen from "screens/dashboardScreens/MyInformationScreen/MyInformationScreen"
import ChangePasswordScreen from "screens/dashboardScreens/ChangePasswordScreen/ChangePasswordScreen"
import UpdateMobileNumberScreen from "screens/dashboardScreens/UpdateMobileNumberScreen/UpdateMobileNumberScreen"
import UpdateEmailScreen from "screens/dashboardScreens/UpdateEmailScreen/UpdateEmailScreen"
import DeleteAccountScreen from "screens/dashboardScreens/DeleteAccountScreen/DeleteAccountScreen"
import MySavedAddressesScreen from "screens/dashboardScreens/MySavedAddressesScreen/MySavedAddressesScreen"
import AddNewAddressScreen from "screens/dashboardScreens/AddNewAddressScreen/AddNewAddressScreen"
import AboutAppScreen from "screens/dashboardScreens/AboutAppScreen/AboutAppScreen"
import ArchivedMessagesScreen from "screens/dashboardScreens/ArchivedMessagesScreen/ArchivedMessagesScreen"
import MessagesDetailsScreen from "screens/dashboardScreens/MessagesDetailsScreen/MessagesDetailsScreen"
import CategoriesScreen from "screens/dashboardScreens/CategoriesScreen/CategoriesScreen"
import SubCategoriesScreen from "screens/dashboardScreens/SubCategoriesScreen/SubCategoriesScreen"
import ProsListingScreen from "screens/dashboardScreens/ProsListingScreen/ProsListingScreen"
import ServiceRequestDetailsScreen from "screens/dashboardScreens/ServiceRequestDetailsScreen/ServiceRequestDetailsScreen"
import RequestSummaryScreen from "screens/dashboardScreens/RequestSummaryScreen/RequestSummaryScreen"
import RequestSuccessScreen from "screens/dashboardScreens/RequestSuccessScreen/RequestSuccessScreen"
import JobDetailScreen from "screens/dashboardScreens/JobDetailScreen/JobDetailScreen"
import RequestDetailsScreen from "screens/dashboardScreens/RequestDetailsScreen/RequestDetailsScreen"
import ProProfileScreen from "screens/dashboardScreens/ProProfileScreen/ProProfileScreen"
import ReviewProSelectionScreen from "screens/dashboardScreens/ReviewProSelectionScreen/ReviewProSelectionScreen"
import ReviewFormScreen from "screens/dashboardScreens/ReviewFormScreen/ReviewFormScreen"
import SearchAnimationScreen from "screens/dashboardScreens/SearchAnimationScreen/SearchAnimationScreen"
import ViewAddressScreen from "screens/dashboardScreens/ViewAddressScreen/ViewAddressScreen"
import QuestionFlowScreen from "screens/dashboardScreens/QuestionFlowScreen/QuestionFlowScreen"
import { useTypedSelector } from "store"
import { setCurrentScreen } from "store/auth/slice"

const Stack = createNativeStackNavigator<RootStackParamList>()

const Navigator = () => {
  const dispatch = useDispatch()
  const { hasPickedLanguage, currentScreen, isAuth, guestLocation } =
    useTypedSelector((store) => store.auth)

  const hasGuestLocation = !!(
    guestLocation?.coords || guestLocation?.address
  )

  let initialRouteName: keyof RootStackParamList = "WelcomeScreen"
  if (isAuth || hasGuestLocation) {
    initialRouteName = "HomeTabs"
  } else if (hasPickedLanguage) {
    initialRouteName = "AuthWelcomeScreen"
  }

  // Honor currentScreen if set (e.g., after RNRestart for language change)
  if (currentScreen === "auth-welcome") initialRouteName = "AuthWelcomeScreen"
  if (currentScreen === "home") initialRouteName = "HomeTabs"
  if (currentScreen === "welcome") initialRouteName = "WelcomeScreen"

  // Clear currentScreen after it's been consumed (like proapp pattern)
  useEffect(() => {
    if (currentScreen) {
      setTimeout(() => {
        dispatch(setCurrentScreen(undefined))
      }, 1000)
    }
  }, [])

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="WelcomeScreen" component={WelcomeScreen} />
      <Stack.Screen name="AuthWelcomeScreen" component={AuthWelcomeScreen} />
      <Stack.Screen name="RegisterScreen" component={RegisterScreen} />
      <Stack.Screen name="SignInEmailScreen" component={SignInEmailScreen} />
      <Stack.Screen
        name="GuestLocationScreen"
        component={GuestLocationScreen}
      />
      <Stack.Screen
        name="PickAddressScreen"
        component={PickAddressScreen}
        options={{
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
          headerShown: false,
        }}
      />
      <Stack.Screen name="HomeTabs" component={HomeTabs} />
      <Stack.Screen name="AccountDetailsScreen" component={AccountDetailsScreen} />
      <Stack.Screen name="MyInformationScreen" component={MyInformationScreen} />
      <Stack.Screen name="ChangePasswordScreen" component={ChangePasswordScreen} />
      <Stack.Screen name="UpdateMobileNumberScreen" component={UpdateMobileNumberScreen} />
      <Stack.Screen name="UpdateEmailScreen" component={UpdateEmailScreen} />
      <Stack.Screen name="DeleteAccountScreen" component={DeleteAccountScreen} />
      <Stack.Screen name="MySavedAddressesScreen" component={MySavedAddressesScreen} />
      <Stack.Screen name="AddNewAddressScreen" component={AddNewAddressScreen} />
      <Stack.Screen name="AboutAppScreen" component={AboutAppScreen} />
      <Stack.Screen name="ArchivedMessagesScreen" component={ArchivedMessagesScreen} />
      <Stack.Screen name="MessagesDetailsScreen" component={MessagesDetailsScreen} />
      <Stack.Screen name="CategoriesScreen" component={CategoriesScreen} />
      <Stack.Screen name="SubCategoriesScreen" component={SubCategoriesScreen} />
      <Stack.Screen name="SearchAnimationScreen" component={SearchAnimationScreen} />
      <Stack.Screen name="ProsListingScreen" component={ProsListingScreen} />
      {/* QuestionFlowScreen — native modal approach (kept as fallback)
      <Stack.Screen
        name="QuestionFlowScreen"
        component={QuestionFlowScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      */}
      <Stack.Screen name="ServiceRequestDetailsScreen" component={ServiceRequestDetailsScreen} />
      <Stack.Screen name="RequestSummaryScreen" component={RequestSummaryScreen} />
      <Stack.Screen name="RequestSuccessScreen" component={RequestSuccessScreen} />
      <Stack.Screen name="ViewAddressScreen" component={ViewAddressScreen} />
      <Stack.Screen name="JobDetailScreen" component={JobDetailScreen} />
      <Stack.Screen name="RequestDetailsScreen" component={RequestDetailsScreen} options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="ProProfileScreen" component={ProProfileScreen} options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="ReviewProSelectionScreen" component={ReviewProSelectionScreen} />
      <Stack.Screen name="ReviewFormScreen" component={ReviewFormScreen} />
    </Stack.Navigator>
  )
}

export default Navigator
