// Lets a plain .mjs script import the app's TypeScript modules, which are written
// with extensionless imports the way bundlers expect. Node strips the types; this
// only fills in the missing .ts extension.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
    throw err;
  }
}
