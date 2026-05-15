const { expect } = require('chai');

// We have compiled test/run-tests.js which returns 0 on success.
// We can just execute it via child_process
const { execSync } = require('child_process');
const path = require('path');

describe('Extraction Unit Tests', function () {
    it('should correctly slice byteOffset for CBR files and extract CBZ files without offset issues', function () {
        // Compile the runner
        execSync('npx esbuild test/test-extract-bundle-runner.js --bundle --outfile=test/run-tests.js --platform=node');
        // Copy unrar.wasm if it doesnt exist
        if (!require('fs').existsSync(path.join(__dirname, 'unrar.wasm'))) {
            execSync('cp node_modules/node-unrar-js/dist/js/unrar.wasm test/');
        }

        // Run it
        const output = execSync('node test/run-tests.js').toString();
        expect(output).to.include('CBR OK');
        expect(output).to.include('CBZ OK');
    });
});
