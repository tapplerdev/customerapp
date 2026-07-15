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

@end

/// Simple slide-up / slide-down animator for the sheet itself.
@interface TapplerSheetAnimator : NSObject <UIViewControllerAnimatedTransitioning>
@property (nonatomic, assign) BOOL presenting;
@end

NS_ASSUME_NONNULL_END
