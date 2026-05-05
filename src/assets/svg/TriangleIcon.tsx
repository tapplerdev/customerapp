import React from "react"
import { View } from "react-native"
import Svg, { Polygon } from "react-native-svg"

const TriangleIcon = ({
  color = "red",
  direction = "up",
  width = 20,
  height = 20,
}) => {
  const getPoints = () => {
    switch (direction) {
      case "up":
        return `0,${height} ${width / 2},0 ${width},${height}`
      case "down":
        return `0,0 ${width / 2},${height} ${width},0`
      case "left":
        return `${width},0 0,${height / 2} ${width},${height}`
      case "right":
        return `0,0 ${width},${height / 2} 0,${height}`
      default:
        return ""
    }
  }

  return (
    <View style={{ width, height }}>
      <Svg height={height} width={width}>
        <Polygon points={getPoints()} fill={color} />
      </Svg>
    </View>
  )
}

export default TriangleIcon
