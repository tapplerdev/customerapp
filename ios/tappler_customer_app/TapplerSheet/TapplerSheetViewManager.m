#import <React/RCTViewManager.h>
#import "TapplerSheetHostView.h"

@interface TapplerSheetViewManager : RCTViewManager
@end

@implementation TapplerSheetViewManager

RCT_EXPORT_MODULE(TapplerSheetView)

- (UIView *)view
{
  return [[TapplerSheetHostView alloc] initWithBridge:self.bridge];
}

RCT_EXPORT_VIEW_PROPERTY(visible, BOOL)
RCT_EXPORT_VIEW_PROPERTY(sheetHeight, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(pushBackScale, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(onDismissed, RCTDirectEventBlock)

@end
