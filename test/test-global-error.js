const puppeteer = require('puppeteer');
const { execSync, spawn } = require('child_process');
const assert = require('assert');

(async () => {
    console.log('--- Step 1: Ensure the bug can be caught when present ---');
    // Using the original broken command to reproduce.
    execSync('npx esbuild src/client.js --bundle --outfile=public/bundle.js');

    let caughtBug = false;
    let browser1 = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    let serverProcess = spawn('node', ['server.js']);
    await new Promise(r => setTimeout(r, 2000));

    try {
        const page1 = await browser1.newPage();
        page1.on('pageerror', err => { if (err.toString().includes('global is not defined')) caughtBug = true; });
        await page1.goto('http://localhost:3000');
        await page1.type('#session-id', 'test999');
        await page1.select('#role-select', 'left');
        await page1.click('#join-btn');

        const page2 = await browser1.newPage();
        page2.on('pageerror', err => { if (err.toString().includes('global is not defined')) caughtBug = true; });
        await page2.goto('http://localhost:3000');
        await page2.type('#session-id', 'test999');
        await page2.select('#role-select', 'right');
        await page2.click('#join-btn');

        await new Promise(r => setTimeout(r, 3000));
        assert.strictEqual(caughtBug, true, 'Failed to reproduce the bug when it should be present');
        console.log('Successfully confirmed the test can catch the bug.');
    } finally {
        await browser1.close();
        serverProcess.kill();
    }

    console.log('--- Step 2: Ensure the bug does NOT happen with npm run build ---');
    execSync('npm run build');

    let caughtFixed = false;
    let browser2 = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    let serverProcess2 = spawn('node', ['server.js']);
    await new Promise(r => setTimeout(r, 2000));

    try {
        const page1 = await browser2.newPage();
        page1.on('pageerror', err => { if (err.toString().includes('global is not defined')) caughtFixed = true; });
        await page1.goto('http://localhost:3000');
        await page1.type('#session-id', 'test888');
        await page1.select('#role-select', 'left');
        await page1.click('#join-btn');

        const page2 = await browser2.newPage();
        page2.on('pageerror', err => { if (err.toString().includes('global is not defined')) caughtFixed = true; });
        await page2.goto('http://localhost:3000');
        await page2.type('#session-id', 'test888');
        await page2.select('#role-select', 'right');
        await page2.click('#join-btn');

        await new Promise(r => setTimeout(r, 3000));
        assert.strictEqual(caughtFixed, false, 'The bug is still happening with npm run build!');
        console.log('Successfully verified that npm run build is free of the bug.');
    } finally {
        await browser2.close();
        serverProcess2.kill();
    }
})();
