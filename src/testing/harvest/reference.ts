/**
 * Jest only. What a class token draws by NativeWind's own resolver: the
 * reference the compiled-class check (compiledClasses.tsx) holds a drawn
 * style against. It is scripts/nw-resolve (the class-era tools' resolver,
 * 0 mismatches on proapp's 2,338 real strings, re-rooted on customerapp's
 * tailwind.config.js), required on first use, so a test that never checks
 * a token never loads it.
 */
type Resolver = {
  resolve: (className: string) => { style: Record<string, unknown> }
}

let resolver: Resolver | null = null

export const resolveClass = (token: string): Record<string, unknown> => {
  if (!resolver) {
    try {
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      resolver = require("../../../scripts/nw-resolve") as Resolver
    } catch (error) {
      throw new Error(
        `the compiled-class check needs scripts/nw-resolve.js (the class-era tools' port): ${String(error)}`
      )
    }
  }
  return resolver.resolve(token).style
}
