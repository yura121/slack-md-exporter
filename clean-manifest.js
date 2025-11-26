import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine the path to the final manifest in the 'dist' folder
const manifestPath = resolve(__dirname, 'dist', 'manifest.json');

try {
    // Reading the manifest
    const manifestContent = readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    // Cleaning up host_permissions
    if (manifest.host_permissions) {
        // Filtering and removing localhost
        manifest.host_permissions = manifest.host_permissions.filter(
            (permission) => !permission.startsWith('http://localhost')
        );
    }

    // Removing web_accessible_resources (if required)
    if (manifest.web_accessible_resources) {
        delete manifest.web_accessible_resources;
        console.log('Removed block: web_accessible_resources');
    }

    // Writing the cleaned manifest
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log('manifest.json cleanup complete.');

} catch (error) {
    console.error('Error cleaning up manifest.json:', error);
    process.exit(1);
}
