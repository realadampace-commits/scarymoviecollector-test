import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const htmlInputs = Object.fromEntries(
  readdirSync(process.cwd())
    .filter((name) => name.endsWith('.html'))
    .map((name) => [name.slice(0, -5), resolve(process.cwd(), name)]),
);

export default defineConfig({
  build: {
    rollupOptions: {
      input: htmlInputs,
    },
  },
});
