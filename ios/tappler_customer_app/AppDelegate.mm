#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <GoogleMaps/GoogleMaps.h>
#import <Firebase.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];
  [GMSServices provideAPIKey:@"AIzaSyDFrq76g50cFzocliIqTMl2jynZ8AjA034"];
  self.moduleName = @"tappler_customer_app";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  BOOL didFinish = [super application:application didFinishLaunchingWithOptions:launchOptions];
  // Black window backdrop so native pageSheet presentations (Filters,
  // question flow) reveal the iOS push-back frame instead of flat white.
  self.window.backgroundColor = [UIColor blackColor];
  return didFinish;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  // Metro port (8082, to avoid clashing with proapp on 8081) is set via RCT_METRO_PORT
  // in the Podfile post_install hook, so the provider resolves the right URL directly.
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
