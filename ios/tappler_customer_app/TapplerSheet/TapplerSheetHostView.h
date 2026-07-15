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
@property (nonatomic, copy, nullable) RCTDirectEventBlock onDismissed;

@end

NS_ASSUME_NONNULL_END
