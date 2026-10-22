/* eslint-disable global-require, @typescript-eslint/no-var-requires --
   resolved on first use, not when the mock is made (see below). */
/**
 * Jest only. What `store` (src/store/index.ts) is under the parity config
 * (setup.ts mocks it with this). The same exports, with `store` the render's
 * own store (store.ts makes a fresh one per render from the app's reducers).
 *
 * Nothing here loads app code when the mock is made: the store's reducers
 * import services/api, whose imports reach modules that import "store"
 * again, so everything is required on first use instead.
 */
const kit = () =>
  require("testing/screenKit/store") as typeof import("testing/screenKit/store")

export const storeModule = () => {
  const module = {
    __esModule: true,
    useTypedSelector: (...args: unknown[]) =>
      (require("react-redux").useSelector as (...a: unknown[]) => unknown)(
        ...args
      ),
  }
  Object.defineProperties(module, {
    store: { enumerable: true, get: () => kit().currentStore() },
    persistor: { enumerable: true, get: () => kit().persistor },
    default: { enumerable: true, get: () => kit().currentStore() },
  })
  return module
}
