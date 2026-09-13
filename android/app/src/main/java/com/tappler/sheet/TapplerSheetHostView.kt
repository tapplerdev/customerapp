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

  /** Height in DIP, as sent by JS. Converted at use; 0 means "not measured yet". */
  var sheetHeight: Float = 0f

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

  var onDismissed: (() -> Unit)? = null

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
    target.setOnKeyListener { _, keyCode, event ->
      keyCode == KeyEvent.KEYCODE_BACK &&
          event.action == KeyEvent.ACTION_UP &&
          !dismissable
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

  private fun heightPx(): Int =
      if (sheetHeight > 0f) PixelUtil.toPixelFromDIP(sheetHeight).toInt()
      else ViewGroup.LayoutParams.WRAP_CONTENT

  private fun dismiss() {
    UiThreadUtil.assertOnUiThread()

    val current = dialog ?: return
    dialog = null

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
