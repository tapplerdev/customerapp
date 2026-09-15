package com.tappler.sheet

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Color
import android.graphics.Outline
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.FrameLayout
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.JSTouchDispatcher
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.RootView
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.events.EventDispatcher
import com.facebook.react.views.view.ReactViewGroup
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import java.util.ArrayList

/**
 * Android half of TapplerSheetView — the counterpart to
 * ios/<app>/TapplerSheet/TapplerSheetHostView.m.
 *
 * Registered under the SAME native name as iOS ("TapplerSheetView"), which is what
 * lets the JS component drop its Platform check entirely instead of growing a second
 * branch. See tappler-shared/src/components/NativePushBackSheet/NativePushBackSheet.tsx.
 *
 * SHAPE. This is React Native's own ReactModalHostView with the plain Dialog swapped
 * for Material's BottomSheetDialog. Almost nothing here is novel: hosting React
 * children in a second window — reparenting them, routing touches into them — is a
 * solved problem in
 * node_modules/react-native/ReactAndroid/.../views/modal/ReactModalHostView.java, and
 * this follows it closely on purpose. Read that file before changing this one.
 *
 * The host view itself is invisible and never lays anything out; children are
 * forwarded to [SheetRootViewGroup], which lives inside the dialog's window.
 */
class TapplerSheetHostView(context: ThemedReactContext) :
    ViewGroup(context), LifecycleEventListener {

  companion object {
    /** Matches the iOS controller's default so both platforms dim identically. */
    const val DEFAULT_DIM_OPACITY = 0.4f

    /**
     * Top-corner radius, in DIP.
     *
     * Material does NOT round this for us. BottomSheetDialog picks its theme from
     * ?attr/bottomSheetDialogTheme, and AppTheme (Theme.AppCompat.Light.NoActionBar)
     * never defines it — so it falls back to Theme.Design.Light.BottomSheetDialog,
     * whose Widget.Design.BottomSheet.Modal background is a flat colorBackground with
     * shapeAppearance=@null. Square. The gorhom sheets this replaced rounded
     * themselves at 28, and iOS gets it from the presentation controller's clip.
     *
     * 28 matches inputBarSheet and sheetContentRound on the JS side.
     */
    private const val CORNER_RADIUS_DIP = 28f
  }

  private val sheetRoot = SheetRootViewGroup(context)
  private var dialog: BottomSheetDialog? = null
  private var contentFrame: FrameLayout? = null

  /**
   * Dialogs WE are closing, as opposed to ones the user swiped or tapped away.
   *
   * Only a user-initiated dismissal is news to JS; echoing a programmatic one back
   * calls the caller's close handler a second time, which in chat means committing a
   * partial answer twice.
   *
   * A set keyed by dialog, NOT a single boolean. Dialog.dismiss() tears the window
   * down synchronously but delivers OnDismissListener through a POSTED handler message
   * (Dialog.sendDismissMessage), so the callback lands a loop turn later — by which
   * time a replacement dialog may already exist and be mid-dismissal of its own. With
   * one shared flag, the first callback to land clears it and the second reports a
   * programmatic close as a user one.
   */
  private val programmaticDismissals = mutableSetOf<BottomSheetDialog>()

  var visible: Boolean = false

  /**
   * Height in DIP, as sent by JS. Converted at use; 0 means "not measured yet".
   *
   * A CHANGE here invalidates whatever we last told JS about the room available
   * (see lastReportedPx), so the next layout re-reports even if the room itself
   * has not moved.
   */
  var sheetHeight: Float = 0f
    set(value) {
      if (field != value) {
        field = value
        lastReportedPx = -1
      }
    }

  var dimOpacity: Float = DEFAULT_DIM_OPACITY

  /**
   * Whether the pro may close the sheet themselves.
   *
   * Blocks the drag, the outside tap and the back button. Deliberately does
   * NOT touch isHideable or setCancelable: Material's setCancelable also
   * clears isHideable, which would break the programmatic dismiss JS relies
   * on to end the sheet on a payment timeout.
   *
   * Applied to a live dialog rather than requiring a new one, because it
   * flips while the sheet is open — the moment a charge starts.
   */
  var dismissable: Boolean = true
    set(value) {
      if (field != value) {
        field = value
        dialog?.let { applyDismissable(it) }
      }
    }

  var transparentBackground: Boolean = false
    set(value) {
      if (field != value) {
        field = value
        // Material stamps its own background onto the sheet container at creation.
        // Swapping it back and forth on a live dialog means tracking what the default
        // was; recreating is cheaper and cannot drift. Same trick RN uses for the
        // props that affect its Dialog's theme.
        propertyRequiresNewDialog = true
      }
    }

  /**
   * Whether the back key should be handed to JS instead of dismissing the sheet.
   *
   * The sheet's own content sometimes has somewhere to go back TO. The first-time
   * question flow is a stack of cards inside one sheet, and "back" there means the
   * previous card, not the whole flow — which is what the user expects and what the
   * iOS chevron already does. Android's BottomSheetDialog owns its own window, so a
   * JS BackHandler registered by the content never sees the key at all: the dialog
   * consumes it and cancels. Handing it up through this prop is the only way the
   * content gets a say.
   *
   * The content is then responsible for closing: it decides between stepping back and
   * setting visible={false}. That is why the key is swallowed here rather than passed
   * through — a sheet that both notified JS and dismissed itself would drop a card and
   * close in the same press.
   *
   * dismissable=false still wins. A sheet that refuses the drag and the outside tap
   * refuses back too, whatever its content would like.
   *
   * Read live by the listener in applyDismissable, so flipping it on an open sheet
   * takes effect on the next press with no re-registration.
   */
  var interceptBackPress: Boolean = false

  var onDismissed: (() -> Unit)? = null

  /** Fired instead of dismissing when interceptBackPress is on. */
  var onBackPress: (() -> Unit)? = null

  /**
   * Reports the height the sheet ACTUALLY got, in DIP, whenever it changes.
   *
   * Not the same as sheetHeight. JS computes a near-full height from the window and
   * the safe-area insets, and on Android that number can be too big: the dialog gets
   * its own window, and that window stops at the navigation bar. Measured on an API 35
   * emulator, RN reports the window as 914dp (the full 2400px display) while both the
   * activity window and the dialog end at 2337px — 890dp — and safe-area-context
   * reports insets.bottom as 0, so nothing in JS can see the missing 24dp. The
   * BottomSheetBehavior clamps the sheet to what it has; JS laid the content out at
   * the number it asked for, and the last 24dp fell off the bottom edge. Which is
   * exactly the "Show results" / "Next" footer, clipped, with no scroll container to
   * reach it.
   *
   * So the sheet measures itself and JS lays the content out at whatever came back.
   * This is what RN's own Modal does through uiManager setSize; it converges in one
   * extra pass, because a second layout at the clamped height clamps to the same
   * value and JS then has no new state to set.
   */
  var onSheetLayout: ((Float) -> Unit)? = null

  /**
   * Last room-for-the-sheet handed to onSheetLayout, in px, so a re-layout at the same
   * size is quiet. -1 means "nothing reported for this dialog yet".
   *
   * Deliberately NOT a monotonic maximum, and that was measured the hard way. An
   * earlier version only ever reported an INCREASE, on the theory that JS wants one
   * answer — how tall can this sheet ever be — and that shrinks are transient noise
   * from the keyboard or a dismissal drag. The keyboard half of that is simply wrong:
   * SOFT_INPUT_ADJUST_RESIZE (set in createDialog) is honoured, and on an API 35
   * emulator with a real docked IME the coordinator goes from 2274px to 1454px. A
   * monotonic guard swallows that, JS keeps laying 866dp of content into a 546dp
   * window, and the footer button is clipped clean out of the view tree — which is the
   * exact bug this mechanism exists to prevent, reintroduced by the guard meant to
   * protect it. Forwarding the shrink is also just correct: it is what the Android
   * route this sheet replaced got for free from the manifest's adjustResize.
   *
   * (What made this hard to see: the emulator defaults to a FLOATING mini-IME, which
   * reports no content inset and resizes nothing, so the sheet looked immune. Docking
   * the keyboard — `adb shell pm clear com.google.android.inputmethod.latin` — is what
   * surfaced it. Measure the keyboard with a docked keyboard.)
   *
   * A dismissal drag does not come through here at all: BottomSheetBehavior moves the
   * sheet with ViewCompat.offsetTopAndBottom, which never calls layout(), and the
   * quantity reported is the parent's height rather than the sheet's own top edge.
   */
  private var lastReportedPx = -1


  private var propertyRequiresNewDialog = false

  init {
    context.addLifecycleEventListener(this)
  }

  // --- child forwarding ----------------------------------------------------
  // Everything added to this host actually belongs to the dialog's root view, so the
  // whole ViewGroup surface is forwarded rather than implemented.

  override fun addView(child: View, index: Int) {
    UiThreadUtil.assertOnUiThread()
    sheetRoot.addView(child, index)
  }

  override fun getChildCount(): Int {
    // Called by the ViewGroup constructor before sheetRoot is assigned.
    @Suppress("SENSELESS_COMPARISON")
    return if (sheetRoot == null) 0 else sheetRoot.childCount
  }

  override fun getChildAt(index: Int): View? = sheetRoot.getChildAt(index)

  override fun removeView(child: View) {
    UiThreadUtil.assertOnUiThread()
    sheetRoot.removeView(child)
  }

  override fun removeViewAt(index: Int) {
    UiThreadUtil.assertOnUiThread()
    sheetRoot.removeView(getChildAt(index))
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    // Nothing to lay out — this view is a handle, not a container. The children are
    // positioned by UIManager inside the dialog.
  }

  override fun addChildrenForAccessibility(outChildren: ArrayList<View>) {
    // Children are announced from inside the dialog, not from here.
  }

  override fun dispatchPopulateAccessibilityEvent(event: AccessibilityEvent): Boolean = false

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // Counterpart to the dismiss() below, and NOT inherited from RN's Modal — which
    // lacks it, and gets away with it because a Modal is rarely open across a
    // navigation push.
    //
    // react-native-screens detaches a screen once another is pushed over it. Without
    // this, an open sheet was dismissed on the way out (programmatically, so JS was
    // never told) and nothing re-presented it on the way back: JS still believed the
    // sheet was open, and there was no gesture left that could close it.
    showOrUpdate()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    dismiss()
  }

  // --- lifecycle -----------------------------------------------------------

  override fun onHostResume() = showOrUpdate()

  override fun onHostPause() = Unit

  override fun onHostDestroy() = onDropInstance()

  fun onDropInstance() {
    (context as ThemedReactContext).removeLifecycleEventListener(this)
    dismiss()
  }

  fun setEventDispatcher(eventDispatcher: EventDispatcher?) {
    sheetRoot.eventDispatcher = eventDispatcher
  }

  // --- presentation --------------------------------------------------------

  /**
   * Called from the manager's onAfterUpdateTransaction, i.e. once every prop for this
   * frame has landed. Creating the dialog any earlier would present it against a
   * half-applied set of props — the reason RN funnels its Modal through the same hook.
   */
  fun showOrUpdate() {
    UiThreadUtil.assertOnUiThread()

    if (!visible) {
      dismiss()
      return
    }

    if (dialog != null && propertyRequiresNewDialog) {
      dismiss()
    }
    propertyRequiresNewDialog = false

    val activity = (context as ThemedReactContext).currentActivity
    if (activity == null || activity.isFinishing) {
      // No window to attach to. onHostResume runs this again once there is one.
      return
    }

    if (dialog == null) {
      dialog = createDialog(activity)
    }
    applyProperties()

    dialog?.let { if (!it.isShowing) it.show() }
  }

  private fun createDialog(activity: Activity): BottomSheetDialog {
    val created = BottomSheetDialog(activity)

    // sheetRoot may still be parented to the frame of a dialog we just tore down.
    detachSheetRoot()

    val frame = FrameLayout(context)
    frame.addView(
        sheetRoot,
        FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
    contentFrame = frame

    created.setContentView(
        frame, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, heightPx()))

    created.behavior.apply {
      // The sheet is opened at a height JS already decided, so there is no collapsed
      // resting state to fall back to — a drag down is a dismissal, not a collapse.
      skipCollapsed = true
      isHideable = true
      isFitToContents = true
      state = BottomSheetBehavior.STATE_EXPANDED
    }

    applyDismissable(created)

    watchSheetHeight(created)

    styleSheetContainer(created)

    // The content hosts text inputs (chat, search), and a dialog gets its own window,
    // so it does not inherit the activity's soft-input mode.
    created.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

    created.setOnDismissListener {
      val wasProgrammatic = programmaticDismissals.remove(created)
      // Only tear down what still belongs to THIS dialog. The callback is posted, so
      // by the time it lands a replacement may already be on screen — clearing
      // unconditionally pulled sheetRoot out of the live dialog and left an empty
      // sheet behind, with every later height update silently dropped.
      //
      // `dialog == null` is the programmatic case and has to be included: dismiss()
      // nulls the field BEFORE calling dismiss(), so an identity check alone never
      // matches there and contentFrame kept the dead dialog's FrameLayout — and
      // through it the decor view and its Activity context — alive until the next
      // open. A replacement dialog makes this neither null nor `created`, which is
      // exactly the case that must be skipped.
      if (dialog == null || dialog === created) {
        dialog = null
        detachSheetRoot()
        contentFrame = null
        // Same reason as in dismiss(): the next dialog measures itself from scratch, and
        // a stale value here would swallow its report as "nothing new" and leave JS
        // laying content out at the old dialog's size. This is the USER-dismissal path —
        // swipe, dim tap, back — which is the common one, so leaving it out made the
        // wedge permanent rather than transient.
        lastReportedPx = -1
      }
      if (!wasProgrammatic) onDismissed?.invoke()
    }

    return created
  }

  /**
   * Rounds the sheet's top corners, or clears its surface entirely.
   *
   * Done by CLIPPING the container rather than by giving it a rounded background,
   * because the content draws its own opaque white surface — a rounded background
   * underneath would just be covered up and the corners would still read as square.
   * That is why rounding sheetContentRound on the JS side was not enough.
   *
   * The outline is deliberately taller than the view by one radius, so the bottom
   * corners' curve falls below the screen and only the top two round.
   *
   * Runs once per dialog. transparentBackground is the one prop that forces a fresh
   * dialog (see its setter), so this never needs re-applying on update.
   */
  private fun applyDismissable(target: BottomSheetDialog) {
    target.behavior.isDraggable = dismissable
    target.setCanceledOnTouchOutside(dismissable)
    // Back is the third way out, and setCancelable(false) would take
    // isHideable with it, so the key is swallowed instead.
    //
    // Only ACTION_UP is answered. The matching ACTION_DOWN is deliberately passed
    // through to the dialog, which is what makes Dialog.onKeyUp's isTracking check
    // meaningful; swallowing both would work today but relies on Material never
    // looking at the down event.
    target.setOnKeyListener { _, keyCode, event ->
      if (keyCode != KeyEvent.KEYCODE_BACK || event.action != KeyEvent.ACTION_UP) {
        false
      } else if (!dismissable) {
        true
      } else if (interceptBackPress) {
        // Swallowed on purpose — the content closes itself if that is what back
        // means where it currently is. See interceptBackPress.
        onBackPress?.invoke()
        true
      } else {
        false
      }
    }
  }

  private fun styleSheetContainer(dialog: BottomSheetDialog) {
    val container =
        dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet) ?: return

    if (transparentBackground) {
      // Content draws its own surfaces and may deliberately float parts of itself
      // on the dim layer, so it must NOT be clipped to the sheet's bounds.
      container.setBackgroundColor(Color.TRANSPARENT)
      return
    }

    val radius = PixelUtil.toPixelFromDIP(CORNER_RADIUS_DIP)
    container.outlineProvider =
        object : ViewOutlineProvider() {
          override fun getOutline(view: View, outline: Outline) {
            outline.setRoundRect(0, 0, view.width, view.height + radius.toInt(), radius)
          }
        }
    container.clipToOutline = true
  }

  private fun applyProperties() {
    val current = dialog ?: return

    val height = heightPx()
    contentFrame?.let { frame ->
      val params = frame.layoutParams
      if (params != null && params.height != height) {
        params.height = height
        frame.layoutParams = params
        frame.requestLayout()
      }
    }

    // Surface styling is NOT re-applied here — styleSheetContainer does it once per
    // dialog, and transparentBackground forces a fresh one when it changes.
    current.window?.setDimAmount(dimOpacity)
  }

  /**
   * Watch Material's own sheet container, NOT the content view we hand to
   * setContentView.
   *
   * That distinction is the whole bug. Our FrameLayout carries an EXACT height in its
   * LayoutParams, and FrameLayout.getChildMeasureSpec turns an exact child dimension
   * into MeasureSpec.EXACTLY — so it measures at the height JS asked for no matter how
   * little room the parent has, and asking it how tall it is just reads our own number
   * back.
   *
   * What gets reported is the ROOM, not the sheet, and it is simply the coordinator's
   * own height. Measured on an API 35 emulator with the diagnostic below: the
   * coordinator is 2274px against a 2400px display, so it is ALREADY inset by both
   * system bars (63px status + 63px nav), and the sheet's `top` inside it is 0 when
   * expanded. 2274px is 866dp, against the 890dp JS asks for — the 24dp that used to
   * fall off the bottom edge and take the footer button with it.
   *
   * Two formulas were tried and both were wrong, in opposite directions, which is why
   * this comment is long:
   *
   *  - `parentHeight - v.top` was right by accident. `v.top` is 0 here, but it is moved
   *    outside layout by ViewCompat.offsetTopAndBottom during a drag or settle, so
   *    whether a layout pass sees the pre- or post-offset value is Material's business
   *    and not a contract.
   *  - `parentHeight - topInset` subtracted the status bar a SECOND time (reported
   *    2211px), because the coordinator is inset already.
   *
   * Both failures are silent — too small clamps the content to a sliver, too large
   * clamps to nothing and this whole mechanism no-ops back into the clipped footer it
   * exists to fix. The parent's height depends on neither the drag nor the inset.
   */
  private fun watchSheetHeight(dialog: BottomSheetDialog) {
    val container =
        dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet) ?: return
    container.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
      // Only the LIVE dialog may speak. A layout pass on an outgoing dialog's container
      // can land after a replacement exists — the same posted-callback race the dismiss
      // listener guards against — and it would report the dead dialog's geometry
      // against the new sheet.
      if (this.dialog !== dialog) return@addOnLayoutChangeListener
      val parentHeight = (v.parent as? View)?.height ?: return@addOnLayoutChangeListener
      reportAvailableHeight(parentHeight)
    }
  }

  private fun reportAvailableHeight(availablePx: Int) {
    if (availablePx <= 0 || availablePx == lastReportedPx) return
    lastReportedPx = availablePx
    onSheetLayout?.invoke(PixelUtil.toDIPFromPixel(availablePx.toFloat()))
  }

  private fun heightPx(): Int =
      if (sheetHeight > 0f) PixelUtil.toPixelFromDIP(sheetHeight).toInt()
      else ViewGroup.LayoutParams.WRAP_CONTENT

  private fun dismiss() {
    UiThreadUtil.assertOnUiThread()

    val current = dialog ?: return
    dialog = null
    // A fresh dialog measures itself again; without this a same-size sheet would be
    // treated as "nothing new" and JS would keep the stale value.
    lastReportedPx = -1

    val hostActivity = findActivity(current.context)
    if (current.isShowing && (hostActivity == null || !hostActivity.isFinishing)) {
      // Removed by the dismiss listener, not here — see the field's comment.
      programmaticDismissals.add(current)
      current.dismiss()
    } else {
      programmaticDismissals.remove(current)
      detachSheetRoot()
      contentFrame = null
    }
  }

  /**
   * sheetRoot is reused across dialogs, so it has to leave the old one's view tree
   * before it can join the next. Skipping this throws "the specified child already has
   * a parent" the second time the sheet opens.
   */
  private fun detachSheetRoot() {
    (sheetRoot.parent as? ViewGroup)?.removeView(sheetRoot)
  }

  private fun findActivity(from: Context?): Activity? {
    var cursor = from
    while (cursor is ContextWrapper) {
      if (cursor is Activity) return cursor
      cursor = cursor.baseContext
    }
    return null
  }

  /**
   * The view the dialog actually shows. It is a RootView because React's touch
   * pipeline only delivers events through one — a child hosted in another window with
   * an ordinary ViewGroup above it renders perfectly and ignores every tap.
   *
   * Deliberately does NOT report its size back through UIManager the way RN's
   * DialogRootViewGroup does. A Modal always fills the window so it has to discover
   * its own bounds; this sheet is told its height by JS, which measures the content
   * itself and passes the result down as sheetHeight. Adding updateNodeSize here would
   * fight that value.
   */
  private class SheetRootViewGroup(context: Context) : ReactViewGroup(context), RootView {

    var eventDispatcher: EventDispatcher? = null

    private val touchDispatcher = JSTouchDispatcher(this)

    override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
      eventDispatcher?.let { touchDispatcher.handleTouchEvent(event, it) }
      return super.onInterceptTouchEvent(event)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
      eventDispatcher?.let { touchDispatcher.handleTouchEvent(event, it) }
      super.onTouchEvent(event)
      // Claim the gesture even when nothing below wants it, so the rest of the stream
      // still arrives. Same reasoning as ReactRootView.
      return true
    }

    override fun onChildStartedNativeGesture(childView: View?, ev: MotionEvent) {
      eventDispatcher?.let { touchDispatcher.onChildStartedNativeGesture(ev, it) }
    }

    override fun onChildEndedNativeGesture(childView: View?, ev: MotionEvent) {
      eventDispatcher?.let { touchDispatcher.onChildEndedNativeGesture(ev, it) }
    }

    /**
     * Forward the request, but do NOT let it apply to us.
     *
     * React's touch events are produced by the JSTouchDispatcher above, and that only
     * runs from onInterceptTouchEvent / onTouchEvent on this root. The default
     * ViewGroup behaviour sets FLAG_DISALLOW_INTERCEPT, which stops
     * dispatchTouchEvent from calling onInterceptTouchEvent for the rest of the
     * gesture — so the moment any descendant scroller or gesture handler asks for
     * exclusivity, JS stops receiving touchMove/touchEnd and buttons stick in their
     * pressed state. ReactRootView overrides this for exactly that reason.
     *
     * Forwarding still matters: the parent here is Material's BottomSheetBehavior,
     * which needs to know a child is scrolling or it will drag the whole sheet closed
     * instead. This is why it is ReactRootView's forwarding form and not
     * DialogRootViewGroup's no-op.
     */
    override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
      parent?.requestDisallowInterceptTouchEvent(disallowIntercept)
    }

    override fun handleException(t: Throwable) {
      (context as ThemedReactContext).reactApplicationContext.handleException(RuntimeException(t))
    }
  }
}
