/*
 * Jest only, the control for App.parity.tsx's font pin: an app entry that
 * registers Poppins as proapp's index.js does, through an aliased import, so
 * a search for the call by its name misses it. Loading it changes the faces
 * shared's helpers hold, which is what the pin reads after loading index.js.
 */
import { setLatinFontWeights as registerFaces } from "@tappler/shared/src/helpers/helpers"

registerFaces({
  "400": "Poppins-Regular",
  "500": "Poppins-Medium",
  "600": "Poppins-SemiBold",
  "700": "Poppins-Bold",
})
