package com.tappler.sheet

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
 * pushBackScale is the one prop with no Android implementation, and that is a decision
 * rather than a gap. iOS gets the receding-parent effect free from
 * UISheetPresentationController; Android has no equivalent, and hand-animating the root
 * view to imitate it would look wrong next to Material's own motion. It is accepted and
 * ignored so callers can pass the same props to both platforms.
 */
class TapplerSheetViewManager : ViewGroupManager<TapplerSheetHostView>() {

  companion object {
    const val REACT_CLASS = "TapplerSheetView"

    /** Bubbles to the onDismissed prop on the JS component. */
    private const val EVENT_DISMISSED = "topDismissed"
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
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
    val constants: MutableMap<String, Any> =
        super.getExportedCustomDirectEventTypeConstants() ?: mutableMapOf()
    constants[EVENT_DISMISSED] = MapBuilder.of("registrationName", "onDismissed")
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
}
