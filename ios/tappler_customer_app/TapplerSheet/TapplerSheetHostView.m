#import "TapplerSheetHostView.h"
#import "TapplerSheetPresentationController.h"

#import <React/RCTTouchHandler.h>
#import <React/RCTUtils.h>
#import <React/UIView+React.h>

@interface TapplerSheetHostView () <UIViewControllerTransitioningDelegate, UIGestureRecognizerDelegate>
@end

@implementation TapplerSheetHostView {
  __weak RCTBridge *_bridge;
  UIViewController *_sheetViewController;
  TapplerSheetPresentationController *_presentationController;
  UIView *_contentView;
  RCTTouchHandler *_touchHandler;
  BOOL _isPresented;
}

- (instancetype)initWithBridge:(RCTBridge *)bridge
{
  if (self = [super initWithFrame:CGRectZero]) {
    _bridge = bridge;
    _sheetHeight = 300;
    _pushBackScale = 0.92;

    _sheetViewController = [UIViewController new];
    _sheetViewController.view.backgroundColor = [UIColor whiteColor];
    _sheetViewController.modalPresentationStyle = UIModalPresentationCustom;
    _sheetViewController.transitioningDelegate = self;

    UIPanGestureRecognizer *pan = [[UIPanGestureRecognizer alloc] initWithTarget:self
                                                                          action:@selector(handlePan:)];
    pan.delegate = self;
    [_sheetViewController.view addGestureRecognizer:pan];
  }
  return self;
}

#pragma mark - React content hosting (RCTModalHostView pattern)

- (void)insertReactSubview:(UIView *)subview atIndex:(NSInteger)atIndex
{
  [super insertReactSubview:subview atIndex:atIndex];
  if (!_touchHandler) {
    _touchHandler = [[RCTTouchHandler alloc] initWithBridge:_bridge];
  }
  [_touchHandler attachToView:subview];
  subview.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  subview.frame = _sheetViewController.view.bounds;
  [_sheetViewController.view insertSubview:subview atIndex:0];
  _contentView = subview;
}

- (void)removeReactSubview:(UIView *)subview
{
  [super removeReactSubview:subview];
  [_touchHandler detachFromView:subview];
  [subview removeFromSuperview];
  if (_contentView == subview) _contentView = nil;
}

- (void)didUpdateReactSubviews
{
  // Content lives in the presented controller, not in self — do nothing.
}

#pragma mark - Presentation

- (void)setVisible:(BOOL)visible
{
  if (_visible == visible) return;
  _visible = visible;
  if (visible) {
    [self presentSheet];
  } else if (_isPresented) {
    [self dismissSheetNotify:NO];
  }
}

- (void)setSheetHeight:(CGFloat)sheetHeight
{
  _sheetHeight = sheetHeight;
  _presentationController.sheetHeight = sheetHeight;
  if (_isPresented) {
    // Re-run frameOfPresentedViewInContainerView so content-driven height
    // changes (self-sizing sheets) apply while presented.
    [_presentationController.containerView setNeedsLayout];
    [_presentationController.containerView layoutIfNeeded];
  }
}

- (void)presentSheet
{
  if (_isPresented || !_contentView) return;
  // Defer one runloop tick so every prop from the current React commit
  // (notably sheetHeight) is applied before the presentation reads it.
  __weak TapplerSheetHostView *weakSelf = self;
  dispatch_async(dispatch_get_main_queue(), ^{
    [weakSelf presentSheetAttemptsRemaining:5];
  });
}

/// A present requested during a navigation transition (screen still animating
/// in) can't complete yet — retry briefly instead of silently giving up.
- (void)presentSheetAttemptsRemaining:(int)attempts
{
  if (!_visible || _isPresented || !_contentView) return;
  UIViewController *presenter = RCTPresentedViewController();
  BOOL presenterReady =
      presenter && !presenter.presentedViewController && presenter.isViewLoaded && presenter.view.window;
  if (!presenterReady) {
    if (attempts > 0) {
      __weak TapplerSheetHostView *weakSelf = self;
      dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)),
                     dispatch_get_main_queue(), ^{
        [weakSelf presentSheetAttemptsRemaining:attempts - 1];
      });
    }
    return;
  }

  _isPresented = YES;
  [presenter presentViewController:_sheetViewController animated:YES completion:nil];
}

/// User-initiated close (dim tap / swipe): dismiss natively, then tell JS so
/// state stays in sync. Prop-driven close (visible=false) skips the event.
- (void)dismissSheetNotify:(BOOL)notify
{
  if (!_isPresented) return;
  _isPresented = NO;
  __weak TapplerSheetHostView *weakSelf = self;
  [_sheetViewController.presentingViewController dismissViewControllerAnimated:YES completion:^{
    TapplerSheetHostView *strongSelf = weakSelf;
    if (!strongSelf) return;
    // Clear any leftover drag offset so the next present starts clean.
    strongSelf->_sheetViewController.view.transform = CGAffineTransformIdentity;
    if (notify && strongSelf.onDismissed) {
      strongSelf.onDismissed(@{});
    }
  }];
}

// NOTE: no uiManager setSize here (the RCTModalHostView trick) — the JS
// wrapper gives the content an explicit width (and height when fixed), and
// forcing a size natively pins the shadow height, breaking self-sizing
// sheets whose content re-measures via onLayout.

#pragma mark - UIViewControllerTransitioningDelegate

- (UIPresentationController *)presentationControllerForPresentedViewController:(UIViewController *)presented
                                                       presentingViewController:(UIViewController *)presenting
                                                           sourceViewController:(UIViewController *)source
{
  _presentationController =
      [[TapplerSheetPresentationController alloc] initWithPresentedViewController:presented
                                                         presentingViewController:presenting];
  _presentationController.sheetHeight = _sheetHeight;
  _presentationController.pushBackScale = _pushBackScale;
  __weak TapplerSheetHostView *weakSelf = self;
  _presentationController.onDimTap = ^{
    [weakSelf dismissSheetNotify:YES];
  };
  return _presentationController;
}

- (id<UIViewControllerAnimatedTransitioning>)animationControllerForPresentedController:(UIViewController *)presented
                                                                   presentingController:(UIViewController *)presenting
                                                                       sourceController:(UIViewController *)source
{
  TapplerSheetAnimator *animator = [TapplerSheetAnimator new];
  animator.presenting = YES;
  return animator;
}

- (id<UIViewControllerAnimatedTransitioning>)animationControllerForDismissedController:(UIViewController *)dismissed
{
  TapplerSheetAnimator *animator = [TapplerSheetAnimator new];
  animator.presenting = NO;
  return animator;
}

#pragma mark - Drag to dismiss

- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)gestureRecognizer
{
  if (![gestureRecognizer isKindOfClass:[UIPanGestureRecognizer class]]) return YES;
  UIPanGestureRecognizer *pan = (UIPanGestureRecognizer *)gestureRecognizer;
  UIView *sheetView = _sheetViewController.view;
  CGPoint v = [pan velocityInView:sheetView];
  // Only claim clearly-downward drags so horizontal scrollers keep working.
  if (v.y <= fabs(v.x)) return NO;
  // Don't hijack the drag while an inner vertical scroll view can still
  // scroll up — dismiss only engages from the top of the content.
  UIView *hit = [sheetView hitTest:[pan locationInView:sheetView] withEvent:nil];
  for (UIView *cur = hit; cur && cur != sheetView; cur = cur.superview) {
    if ([cur isKindOfClass:[UIScrollView class]]) {
      UIScrollView *scrollView = (UIScrollView *)cur;
      BOOL isVertical = scrollView.contentSize.height > scrollView.bounds.size.height + 1;
      if (isVertical && scrollView.contentOffset.y > -scrollView.adjustedContentInset.top + 1) {
        return NO;
      }
    }
  }
  return YES;
}

// Run alongside inner scroll views: at the top of a (non-bouncing) list a
// downward drag then moves the sheet instead of being swallowed by the
// scroll view's own pan recognizer.
- (BOOL)gestureRecognizer:(UIGestureRecognizer *)gestureRecognizer
    shouldRecognizeSimultaneouslyWithGestureRecognizer:(UIGestureRecognizer *)otherGestureRecognizer
{
  return YES;
}

- (void)handlePan:(UIPanGestureRecognizer *)pan
{
  UIView *sheetView = _sheetViewController.view;
  CGPoint translation = [pan translationInView:sheetView];
  CGFloat dy = MAX(0, translation.y);

  switch (pan.state) {
    case UIGestureRecognizerStateChanged:
      sheetView.transform = CGAffineTransformMakeTranslation(0, dy);
      break;
    case UIGestureRecognizerStateEnded:
    case UIGestureRecognizerStateCancelled: {
      CGFloat vy = [pan velocityInView:sheetView].y;
      if (dy > 80 || vy > 800) {
        // Keep the drag offset — the dismiss animator continues from where
        // the finger left off; the offset is cleared in the completion.
        [self dismissSheetNotify:YES];
      } else {
        [UIView animateWithDuration:0.25
                              delay:0
             usingSpringWithDamping:0.85
              initialSpringVelocity:0
                            options:0
                         animations:^{ sheetView.transform = CGAffineTransformIdentity; }
                         completion:nil];
      }
      break;
    }
    default:
      break;
  }
}

#pragma mark - Teardown

- (void)didMoveToWindow
{
  [super didMoveToWindow];
  // Host removed from the RN tree (screen unmounted) while presented — close.
  if (!self.window && _isPresented) {
    _isPresented = NO;
    [_sheetViewController.presentingViewController dismissViewControllerAnimated:NO completion:nil];
  }
}

- (void)invalidate
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self->_isPresented) {
      self->_isPresented = NO;
      [self->_sheetViewController.presentingViewController dismissViewControllerAnimated:NO completion:nil];
    }
  });
}

@end
