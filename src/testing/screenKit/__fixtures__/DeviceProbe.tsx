/*
 * Jest only, for screenKit.parity.tsx: what the device answers (a
 * permission, a location fix) and what a native view reports back (a map's
 * region settling, an animation finishing), drawn.
 */
import React, { useEffect, useState } from "react"
import { Text, View } from "react-native"
import Geolocation from "@react-native-community/geolocation"
import LottieView from "lottie-react-native"
import MapView from "react-native-maps"
import { PERMISSIONS, check } from "react-native-permissions"
import { getMessaging, hasPermission } from "@react-native-firebase/messaging"

const DeviceProbe = () => {
  const [permission, setPermission] = useState("asking")
  const [push, setPush] = useState("asking")
  const [fix, setFix] = useState("waiting")
  const [region, setRegion] = useState("no region")
  const [animation, setAnimation] = useState("playing")
  useEffect(() => {
    void check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE).then(setPermission)
    void hasPermission(getMessaging()).then((status) =>
      setPush(`push ${String(status)}`)
    )
    Geolocation.getCurrentPosition(
      ({ coords }) => setFix(`${coords.latitude},${coords.longitude}`),
      (error) => setFix(`error ${error.code}`)
    )
  }, [])
  return (
    <View>
      <Text testID="permission">{permission}</Text>
      <Text testID="push">{push}</Text>
      <Text testID="fix">{fix}</Text>
      <Text testID="region">{region}</Text>
      <Text testID="animation">{animation}</Text>
      <MapView
        style={{ height: 100 }}
        onRegionChangeComplete={(next: { latitude: number }) =>
          setRegion(`settled ${next.latitude}`)
        }
      />
      <LottieView
        source={{ nm: "searching" }}
        autoPlay
        loop={false}
        onAnimationFinish={() => setAnimation("finished")}
      />
    </View>
  )
}

export default DeviceProbe
