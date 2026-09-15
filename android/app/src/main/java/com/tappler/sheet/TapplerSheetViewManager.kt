package com.tappler.sheet

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.Event
import com.facebook.react.uimanager.events.RCTEventEmitter

/**
 * Manager for TapplerSheetView on Android.
 *
 * REACT_CLASS is deliberately identical to the iOS module name registered in
 * TapplerSheetViewManager.m. That single fact is what removes the platform branch from
 * the JS: requireNativeComponent("TapplerSheetView") now resolves on both platforms, so
 * NativePushBackSheet has nothing left to gate on.
 *
 * NATIVE CONTRACT. Every @ReactProp below has to stay in step with the iOS manager's
 * RCT_EXPORT_VIEW_PROPERTY list. A prop added on one side only is a silent no-op on the
 * other — which has already happened once, when transparentBackground shipped to
 * customerapp alone and proapp drew a white heading on a white sheet.
 *
 * Two props are deliberately one-sided, and both are declared on the other platform
 * anyway so call sites never have to know which one they are on:
 *
 *  - pushBackScale does nothing HERE. iOS gets the receding-parent effect free from
 *    UISheetPresentationController; Android has no equivalent, and hand-animating the
 *    root view to imitate it would look wrong next to Material's own motion.
 *  - interceptBackPress / onBackPress do nothing on IOS, which has no back key.
 *
 * That is a decision in both directions, not a gap.
 */
class TapplerSheetViewManager : ViewGroupManager<TapplerSheetHostView>() {

  companion object {
    const val REACT_CLASS = "TapplerSheetView"

    /** Bubbles to the onDismissed prop on the JS component. */
    private const val EVENT_DISMISSED = "topDismissed"

    /** Bubbles to the onBackPress prop on the JS component. Android only. */
    private const val EVENT_BACK_PRESS = "topBackPress"

    /** Bubbles to the onSheetLayout prop on the JS component. Android only. */
    private const val EVENT_SHEET_LAYOUT = "topSheetLayout"
  }

  override fun getName(): String = REACT_CLASS

  override fun createViewInstance(reactContext: ThemedReactContext): TapplerSheetHostView =
      TapplerSheetHostView(reactContext)

  override fun onDropViewInstance(view: TapplerSheetHostView) {
    super.onDropViewInstance(view)
    view.onDropInstance()
  }

  @ReactProp(name = "visible")
  fun setVisible(view: TapplerSheetHostView, visible: Boolean) {
    view.visible = visible
  }

  @ReactProp(name = "sheetHeight")
  fun setSheetHeight(view: TapplerSheetHostView, sheetHeight: Float) {
    view.sheetHeight = sheetHeight
  }

  @ReactProp(name = "dimOpacity", defaultFloat = TapplerSheetHostView.DEFAULT_DIM_OPACITY)
  fun setDimOpacity(view: TapplerSheetHostView, dimOpacity: Float) {
    view.dimOpacity = dimOpacity
  }

  @ReactProp(name = "dismissable", defaultBoolean = true)
  fun setDismissable(view: TapplerSheetHostView, dismissable: Boolean) {
    view.dismissable = dismissable
  }

  @ReactProp(name = "interceptBackPress")
  fun setInterceptBackPress(view: TapplerSheetHostView, intercept: Boolean) {
    view.interceptBackPress = intercept
  }

  @ReactProp(name = "transparentBackground")
  fun setTransparentBackground(view: TapplerSheetHostView, transparent: Boolean) {
    view.transparentBackground = transparent
  }

  /**
   * Accepted and ignored on purpose — see the class comment. Declared rather than
   * omitted so RN does not warn about an unknown prop on every render.
   */
  @ReactProp(name = "pushBackScale")
  fun setPushBackScale(view: TapplerSheetHostView, pushBackScale: Float) = Unit

  override fun addEventEmitters(reactContext: ThemedReactContext, view: TapplerSheetHostView) {
    val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, view.id)
    view.setEventDispatcher(dispatcher)
    view.onDismissed = {
      dispatcher?.dispatchEvent(
          DismissedEvent(UIManagerHelper.getSurfaceId(reactContext), view.id))
    }
    view.onBackPress = {
      dispatcher?.dispatchEvent(
          BackPressEvent(UIManagerHelper.getSurfaceId(reactContext), view.id))
    }
    view.onSheetLayout = { heightDip ->
      dispatcher?.dispatchEvent(
          SheetLayoutEvent(UIManagerHelper.getSurfaceId(reactContext), view.id, heightDip))
    }
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
    val constants: MutableMap<String, Any> =
        super.getExportedCustomDirectEventTypeConstants() ?: mutableMapOf()
    constants[EVENT_DISMISSED] = MapBuilder.of("registrationName", "onDismissed")
    constants[EVENT_BACK_PRESS] = MapBuilder.of("registrationName", "onBackPress")
    constants[EVENT_SHEET_LAYOUT] = MapBuilder.of("registrationName", "onSheetLayout")
    return constants
  }

  /**
   * Runs after every prop for this frame has been applied. Presenting from inside an
   * individual setter would show the sheet against a half-updated set of props — most
   * visibly a stale height. RN's Modal presents from this same hook.
   */
  override fun onAfterUpdateTransaction(view: TapplerSheetHostView) {
    super.onAfterUpdateTransaction(view)
    view.showOrUpdate()
  }

  private class DismissedEvent(surfaceId: Int, viewTag: Int) : Event<DismissedEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = EVENT_DISMISSED

    @Deprecated("Paper-only path; the app runs newArchEnabled=false.")
    override fun dispatch(rctEventEmitter: RCTEventEmitter) {
      rctEventEmitter.receiveEvent(viewTag, eventName, null)
    }
  }

  private class BackPressEvent(surfaceId: Int, viewTag: Int) : Event<BackPressEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = EVENT_BACK_PRESS

    /**
     * Event coalescing defaults to ON with a coalescing key of 0, which would merge two
     * back presses landing in the same dispatcher batch into one. For a sheet that is a
     * STACK of cards, two presses mean two cards — dropping one is a visibly dead press.
     * The window is ~16ms so a human will not hit it, but key-repeat and instrumented
     * tests will.
     */
    override fun canCoalesce(): Boolean = false

    @Deprecated("Paper-only path; the app runs newArchEnabled=false.")
    override fun dispatch(rctEventEmitter: RCTEventEmitter) {
      rctEventEmitter.receiveEvent(viewTag, eventName, null)
    }
  }

  private class SheetLayoutEvent(surfaceId: Int, viewTag: Int, private val heightDip: Float) :
      Event<SheetLayoutEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = EVENT_SHEET_LAYOUT

    private fun payload(): WritableMap =
        Arguments.createMap().apply { putDouble("height", heightDip.toDouble()) }

    /**
     * The only one of the three events carrying data, so it is the only one that breaks
     * if the deprecated dispatch path below is ever dropped — Event.dispatchModern falls
     * back to getEventData(), and the base implementation returns null, which throws.
     * Overriding both makes it correct on Paper and on Fabric.
     */
    override fun getEventData(): WritableMap = payload()

    @Deprecated("Paper path; the app runs newArchEnabled=false.")
    override fun dispatch(rctEventEmitter: RCTEventEmitter) {
      rctEventEmitter.receiveEvent(viewTag, eventName, payload())
    }
  }
}
