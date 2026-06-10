import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'storage/supabase': 'src/storage/supabase.ts',
    'storage/memory': 'src/storage/memory.ts',
    'adapters/hono': 'src/adapters/hono.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  target: 'es2022',
  treeshake: true,
  clean: true,
  external: ['@supabase/supabase-js', 'hono'],
});
