#import <UIKit/UIKit.h>
#import <React/RCTBridge.h>
#import <React/RCTComponent.h>
#import <React/RCTInvalidating.h>

NS_ASSUME_NONNULL_BEGIN

/// Invisible RN host view (RCTModalHostView pattern): its React subview is
/// reparented into a natively-presented view controller that uses
/// TapplerSheetPresentationController for the push-back effect.
@interface TapplerSheetHostView : UIView <RCTInvalidating>

- (instancetype)initWithBridge:(RCTBridge *)bridge;

@property (nonatomic, assign) BOOL visible;
@property (nonatomic, assign) CGFloat sheetHeight;
@property (nonatomic, assign) CGFloat pushBackScale;
@property (nonatomic, assign) CGFloat dimOpacity;
/// Clear sheet background: content draws its own surfaces, so parts of it
/// (e.g. a header) can float visually on the dim layer.
@property (nonatomic, assign) BOOL transparentBackground;
/// Whether the pro may close the sheet themselves.
///
/// NO blocks the drag-down, the dim tap and (on Android) the back button. It
/// does NOT block a programmatic close, so JS can always get the sheet off
/// screen — which is what keeps a payment's timeout able to end the sheet
/// even while the gesture is refused.
///
/// Added for the card sheet: a swipe mid-charge is not a cancel, it is an
/// unknown outcome, so the pro was being shown "your payment is being
/// processed" for a charge they thought they had backed out of. Better to
/// refuse the gesture than to explain it afterwards.
@property (nonatomic, assign) BOOL dismissable;
/// Android only — declared here so the JS prop list is identical on both
/// platforms (the same reason Android declares pushBackScale and ignores it).
/// There is no back key on iOS; a swipe-down or dim tap is the only way out and
/// it already goes through onDismissed.
@property (nonatomic, assign) BOOL interceptBackPress;
@property (nonatomic, copy, nullable) RCTDirectEventBlock onDismissed;
/// Android only — never fired here. See interceptBackPress.
@property (nonatomic, copy, nullable) RCTDirectEventBlock onBackPress;
/// Android only — never fired here. There the dialog's own window stops at the
/// navigation bar, so the sheet can end up shorter than the height JS asked
/// for and has to report back what it got. iOS clamps too (97% of the
/// container in frameOfPresentedViewInContainerView) but does not report it;
/// the hand-computed heights at the call sites are what cover that.
@property (nonatomic, copy, nullable) RCTDirectEventBlock onSheetLayout;

@end

NS_ASSUME_NONNULL_END
