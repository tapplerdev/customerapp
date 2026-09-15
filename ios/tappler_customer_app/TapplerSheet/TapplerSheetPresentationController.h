#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

/// Custom presentation controller that re-implements the iOS "sheet push-back"
/// (the presenting screen recedes: scales down, rounds corners, dims) for a
/// SMALL bottom sheet — something stock UISheetPresentationController only
/// does at the large detent. This is the same animation UIKit performs
/// privately; Apple exposes no API for it at small heights, so apps (incl.
/// Airbnb) re-implement it exactly like this.
@interface TapplerSheetPresentationController : UIPresentationController

@property (nonatomic, assign) CGFloat sheetHeight;      // content height incl. bottom inset
@property (nonatomic, assign) CGFloat pushBackScale;    // default 0.92
@property (nonatomic, assign) CGFloat dimOpacity;       // default 0.4
/// Called when the user taps the dim layer (host decides how to dismiss).
@property (nonatomic, copy, nullable) void (^onDimTap)(void);

/// Put the presenting screen back exactly as it was found, with no animation.
///
/// The push-back is normally undone in dismissalTransitionWillBegin, but UIKit
/// does not always run it: dismissing a controller that has ANOTHER controller
/// presented on top of it tears the whole chain down at once and skips the
/// intermediate presentation controllers. When that happens the presenting
/// screen is left scaled, rounded and dimmed with nothing left to restore it,
/// which reads as the app having permanently shrunk.
///
/// Safe to call more than once, and safe to call after a normal dismissal — it
/// re-applies the same saved values the animated path already restored.
- (void)restorePresentingViewImmediately;

@end

/// Simple slide-up / slide-down animator for the sheet itself.
@interface TapplerSheetAnimator : NSObject <UIViewControllerAnimatedTransitioning>
@property (nonatomic, assign) BOOL presenting;
@end

NS_ASSUME_NONNULL_END
