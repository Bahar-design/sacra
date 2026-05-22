const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // @supabase/supabase-js v2.106+ ships an ESM build (index.mjs) that uses
  // `import(OTEL_PKG)` — a dynamic import with a variable. Hermes cannot
  // compile variable-argument dynamic imports, so we redirect to the CJS
  // build which uses `require(s)` wrapped in a Promise instead.
  if (moduleName === '@supabase/supabase-js') {
    return {
      filePath: require.resolve('@supabase/supabase-js/dist/index.cjs'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
