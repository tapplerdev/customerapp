package com.tappler.sheet

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers TapplerSheetView. Added by hand in MainApplication.getPackages(), since
 * this lives in the app rather than in an autolinked node module.
 *
 * The package name is com.tappler.sheet in BOTH apps — not com.tappler_mob_app.* /
 * com.tappler_customer_app.* — so the three files here stay byte-identical across
 * proapp and customerapp and a plain diff can prove they have not drifted. That is the
 * same guarantee the iOS side asks for in prose and cannot check.
 */
class TapplerSheetPackage : ReactPackage {

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      emptyList()

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = listOf(TapplerSheetViewManager())
}
