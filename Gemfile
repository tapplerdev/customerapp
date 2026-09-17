source 'https://rubygems.org'

# You may use http://rbenv.org/ or https://rvm.io/ to install and use this version
ruby ">= 2.6.10"

# Exclude problematic versions of cocoapods and activesupport that causes build failures.
gem 'cocoapods', '>= 1.13', '!= 1.15.0', '!= 1.15.1'
gem 'activesupport', '>= 6.1.7.5', '!= 7.1.0'

# json 3.0 is a HARD ceiling, forced by a three-link chain:
#   1. cocoapods-core (>= 1.12) requires `activesupport >= 5.0, < 8`, so no
#      CocoaPods 1.13+ can ever use activesupport 8.x.
#   2. Every activesupport below 8.1.0 calls
#      `JSON.generate(jsonified, quirks_mode: true, ...)` in
#      active_support/json/encoding.rb. 8.1.0 dropped that argument — but see 1,
#      we can't get there.
#   3. json removed `quirks_mode` in 3.0. json 2.x quietly ignored unknown
#      generator keywords; 3.x raises.
# RN's codegen calls `.to_json` on the ReactCodegen podspec hash, and
# activesupport monkeypatches `.to_json`, so json 3.x makes every `pod install`
# die with "Invalid `Podfile` file: unknown keyword: quirks_mode" — pointing
# uselessly at `use_react_native!` rather than at the gem. Revisit only when
# cocoapods-core raises its activesupport ceiling to allow 8.1+.
#
# RN 0.76.1's template also pins `xcodeproj < 1.26.0`, which we deliberately
# DON'T carry: CocoaPods 1.16+ needs xcodeproj >= 1.27, so that pin caps us at
# CocoaPods 1.15.2 (early 2024) forever. Matches proapp.
gem 'json', '< 3.0'

# Added by RN 0.77's own template. Same shape as the json pin above — a
# transitive gem held down to dodge an incompatibility, which is standard
# practice here rather than a workaround.
gem 'concurrent-ruby', '< 1.3.4'
