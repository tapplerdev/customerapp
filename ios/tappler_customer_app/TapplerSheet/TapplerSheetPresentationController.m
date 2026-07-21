#import "TapplerSheetPresentationController.h"

// Top corner radius of a presented sheet — also the radius a STACKED presenting
// sheet KEEPS while pushed back, so the two read identical. The root app screen
// instead recedes to the smaller iOS page-sheet radius.
static const CGFloat kSheetCornerRadius = 28.0;
static const CGFloat kRootRecedeCornerRadius = 12.0;

@implementation TapplerSheetPresentationController {
  UIView *_dimmingView;
  UIColor *_savedWindowBackground;
  BOOL _hadMasksToBounds;
  CGFloat _hadCornerRadius;
}

- (instancetype)initWithPresentedViewController:(UIViewController *)presentedViewController
                       presentingViewController:(UIViewController *)presentingViewController
{
  self = [super initWithPresentedViewController:presentedViewController
                       presentingViewController:presentingViewController];
  if (self) {
    _pushBackScale = 0.92;
    _dimOpacity = 0.4;
    _sheetHeight = 300;
  }
  return self;
}

- (CGRect)frameOfPresentedViewInContainerView
{
  CGRect bounds = self.containerView.bounds;
  // Safety cap only — callers may request near-full height (Airbnb-style
  // large detent: the sheet top sits ~10pt below the receded card's top).
  CGFloat height = MIN(_sheetHeight, bounds.size.height * 0.97);
  return CGRectMake(0, bounds.size.height - height, bounds.size.width, height);
}

/// Transform that recedes the presenting screen: scale around center, then
/// translate down so the scaled top edge sits just below the status bar —
/// matching what UIKit's page-sheet presentation does privately.
- (CGAffineTransform)pushBackTransformForView:(UIView *)view
{
  CGFloat h = view.bounds.size.height;
  if (h <= 0) return CGAffineTransformIdentity;
  CGFloat topInset = view.window.safeAreaInsets.top;
  // Where the scaled top edge would land when scaling around center:
  CGFloat naturalTop = h * (1.0 - _pushBackScale) / 2.0;
  // Target: a bit above the safe-area bottom edge (card peeks from behind
  // the status bar, like iOS page sheets). Clamp so we never move upward
  // past the top on small-inset devices.
  CGFloat targetTop = MAX(topInset - 16.0, naturalTop);
  CGFloat ty = targetTop - naturalTop;
  CGAffineTransform t = CGAffineTransformMakeTranslation(0, ty);
  return CGAffineTransformScale(t, _pushBackScale, _pushBackScale);
}

- (void)presentationTransitionWillBegin
{
  [super presentationTransitionWillBegin];

  UIView *containerView = self.containerView;
  UIView *presentingView = self.presentingViewController.view;

  // Dim layer behind the sheet, above the receded screen.
  _dimmingView = [[UIView alloc] initWithFrame:containerView.bounds];
  _dimmingView.backgroundColor = [UIColor blackColor];
  _dimmingView.alpha = 0;
  _dimmingView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  UITapGestureRecognizer *tap = [[UITapGestureRecognizer alloc] initWithTarget:self
                                                                        action:@selector(dimTapped)];
  [_dimmingView addGestureRecognizer:tap];
  [containerView insertSubview:_dimmingView atIndex:0];

  // The receded card reveals the window behind it — make sure it's black.
  UIWindow *window = presentingView.window;
  _savedWindowBackground = window.backgroundColor;
  window.backgroundColor = [UIColor blackColor];

  // Round the top corners of the sheet itself.
  UIView *presentedView = self.presentedView;
  presentedView.layer.cornerRadius = kSheetCornerRadius;
  presentedView.layer.maskedCorners = kCALayerMinXMinYCorner | kCALayerMaxXMinYCorner;
  presentedView.layer.masksToBounds = YES;
  if (@available(iOS 13.0, *)) {
    presentedView.layer.cornerCurve = kCACornerCurveContinuous;
  }

  _hadMasksToBounds = presentingView.layer.masksToBounds;
  _hadCornerRadius = presentingView.layer.cornerRadius;
  CGAffineTransform pushBack = [self pushBackTransformForView:presentingView];
  CGFloat dimOpacity = _dimOpacity;

  // Corner radius isn't animatable inside UIView blocks — drive it with CA.
  NSTimeInterval duration = 0.35;
  id<UIViewControllerTransitionCoordinator> coordinator = self.presentedViewController.transitionCoordinator;
  if (coordinator) duration = coordinator.transitionDuration;
  // A sheet stacked on ANOTHER sheet keeps the front sheet's radius so both read
  // identical while pushed back; only the root app screen recedes to the
  // smaller iOS page-sheet radius.
  BOOL presentingIsSheet = [self.presentingViewController.presentationController
                             isKindOfClass:[TapplerSheetPresentationController class]];
  CGFloat targetRadius = presentingIsSheet ? kSheetCornerRadius : kRootRecedeCornerRadius;
  [self animateLayerCornerRadius:presentingView.layer to:targetRadius duration:duration];
  presentingView.layer.masksToBounds = YES;
  if (@available(iOS 13.0, *)) {
    presentingView.layer.cornerCurve = kCACornerCurveContinuous;
  }

  void (^animations)(void) = ^{
    self->_dimmingView.alpha = dimOpacity;
    presentingView.transform = pushBack;
  };
  if (coordinator) {
    [coordinator animateAlongsideTransition:^(id<UIViewControllerTransitionCoordinatorContext> _) {
      animations();
    } completion:nil];
  } else {
    animations();
  }
}

- (void)dismissalTransitionWillBegin
{
  [super dismissalTransitionWillBegin];

  UIView *presentingView = self.presentingViewController.view;
  NSTimeInterval duration = 0.28;
  id<UIViewControllerTransitionCoordinator> coordinator = self.presentedViewController.transitionCoordinator;
  if (coordinator) duration = coordinator.transitionDuration;
  // Restore the presenting view's ORIGINAL radius (28 if it's a sheet behind
  // us, 0 if it's the root screen) — not a hardcoded 0.
  [self animateLayerCornerRadius:presentingView.layer to:_hadCornerRadius duration:duration];

  void (^animations)(void) = ^{
    self->_dimmingView.alpha = 0;
    presentingView.transform = CGAffineTransformIdentity;
  };
  if (coordinator) {
    [coordinator animateAlongsideTransition:^(id<UIViewControllerTransitionCoordinatorContext> _) {
      animations();
    } completion:nil];
  } else {
    animations();
  }
}

- (void)dismissalTransitionDidEnd:(BOOL)completed
{
  [super dismissalTransitionDidEnd:completed];
  if (completed) {
    UIView *presentingView = self.presentingViewController.view;
    presentingView.layer.masksToBounds = _hadMasksToBounds;
    presentingView.window.backgroundColor = _savedWindowBackground;
    [_dimmingView removeFromSuperview];
    _dimmingView = nil;
  }
}

- (void)presentationTransitionDidEnd:(BOOL)completed
{
  [super presentationTransitionDidEnd:completed];
  if (!completed) {
    // Presentation was cancelled — undo everything.
    UIView *presentingView = self.presentingViewController.view;
    presentingView.transform = CGAffineTransformIdentity;
    presentingView.layer.cornerRadius = _hadCornerRadius;
    presentingView.layer.masksToBounds = _hadMasksToBounds;
    presentingView.window.backgroundColor = _savedWindowBackground;
    [_dimmingView removeFromSuperview];
    _dimmingView = nil;
  }
}

- (void)containerViewWillLayoutSubviews
{
  [super containerViewWillLayoutSubviews];
  self.presentedView.frame = [self frameOfPresentedViewInContainerView];
  _dimmingView.frame = self.containerView.bounds;
}

- (void)animateLayerCornerRadius:(CALayer *)layer to:(CGFloat)radius duration:(NSTimeInterval)duration
{
  CABasicAnimation *anim = [CABasicAnimation animationWithKeyPath:@"cornerRadius"];
  anim.fromValue = @(layer.cornerRadius);
  anim.toValue = @(radius);
  anim.duration = duration;
  anim.timingFunction = [CAMediaTimingFunction functionWithName:kCAMediaTimingFunctionEaseInEaseOut];
  layer.cornerRadius = radius;
  [layer addAnimation:anim forKey:@"tappler.cornerRadius"];
}

- (void)dimTapped
{
  if (self.onDimTap) self.onDimTap();
}

@end

#pragma mark - Animator

@implementation TapplerSheetAnimator

- (NSTimeInterval)transitionDuration:(id<UIViewControllerContextTransitioning>)transitionContext
{
  return self.presenting ? 0.42 : 0.28;
}

- (void)animateTransition:(id<UIViewControllerContextTransitioning>)transitionContext
{
  if (self.presenting) {
    UIViewController *toVC = [transitionContext viewControllerForKey:UITransitionContextToViewControllerKey];
    UIView *toView = [transitionContext viewForKey:UITransitionContextToViewKey];
    CGRect finalFrame = [transitionContext finalFrameForViewController:toVC];
    [transitionContext.containerView addSubview:toView];
    toView.frame = CGRectOffset(finalFrame, 0, finalFrame.size.height);
    [UIView animateWithDuration:[self transitionDuration:transitionContext]
                          delay:0
         usingSpringWithDamping:0.86
          initialSpringVelocity:0
                        options:UIViewAnimationOptionCurveEaseOut
                     animations:^{ toView.frame = finalFrame; }
                     completion:^(BOOL finished) {
                       [transitionContext completeTransition:!transitionContext.transitionWasCancelled];
                     }];
  } else {
    UIView *fromView = [transitionContext viewForKey:UITransitionContextFromViewKey];
    CGRect endFrame = CGRectOffset(fromView.frame, 0, fromView.frame.size.height);
    [UIView animateWithDuration:[self transitionDuration:transitionContext]
                          delay:0
                        options:UIViewAnimationOptionCurveEaseIn
                     animations:^{ fromView.frame = endFrame; }
                     completion:^(BOOL finished) {
                       [transitionContext completeTransition:!transitionContext.transitionWasCancelled];
                     }];
  }
}

@end
