import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';

// Import manifest.json directly
import manifest from './manifest.json';

export default defineConfig({
    // The project root remains the same since all files are in the root directory
    root: resolve(__dirname, './'),

    build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
    },

    plugins: [
        crx({
            manifest,
            contentScript: {
                reloadPage: true,
            },
        }),
    ],
});
