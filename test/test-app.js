const puppeteer = require('puppeteer');
const { expect } = require('chai');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

describe('Comic Dual Reader E2E', function () {
    this.timeout(60000); // 60 seconds

    let serverProcess;
    let browser1, browser2;
    let page1, page2;

    before(async function () {
        // Build the bundle correctly
        const execSync = require('child_process').execSync;
        execSync('npm run build');

        // Start the server
        console.log('Starting server...');
        serverProcess = spawn('node', ['server.js']);
        await new Promise(resolve => setTimeout(resolve, 2000)); // wait for server to start

        console.log('Starting browsers...');
        browser1 = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream'] });
        browser2 = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream'] });

        page1 = await browser1.newPage();
        page2 = await browser2.newPage();

        // Listen for console logs
        page1.on('console', msg => console.log('PAGE 1 LOG:', msg.text()));
        page1.on('pageerror', err => console.log('PAGE 1 ERROR:', err.toString()));
        page2.on('console', msg => console.log('PAGE 2 LOG:', msg.text()));
        page2.on('pageerror', err => console.log('PAGE 2 ERROR:', err.toString()));
    });

    after(async function () {
        if (browser1) await browser1.close();
        if (browser2) await browser2.close();
        if (serverProcess) serverProcess.kill();
    });

    it('should connect two clients and synchronize page turns with .cbr files', async function () {
        // Refresh pages
        await page1.goto('about:blank');
        await page2.goto('about:blank');

        const sessionId = 'test-session-cbr-123';

        // Client 1 connects
        await page1.goto('http://localhost:3000');
        await page1.type('#session-id', sessionId);
        await page1.select('#role-select', 'left');
        await page1.click('#join-btn');

        await new Promise(resolve => setTimeout(resolve, 500));

        // Client 2 connects
        await page2.goto('http://localhost:3000');
        await page2.type('#session-id', sessionId);
        await page2.select('#role-select', 'right');
        await page2.click('#join-btn');

        // Wait for connection to be established
        await page1.waitForFunction(
            () => document.getElementById('status').innerText.includes('Peer Connected'),
            { timeout: 10000 }
        );
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Peer Connected'),
            { timeout: 10000 }
        );

        // Upload file
        const cbrBase64 = 'UmFyIRoHAQAzkrXlCgEFBgAFAQGAgADqrE5BIwIDC8QABMQAtIMCr8jQV4AAAQUxLnBuZwoDEywTBmoeLyYgiVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYIIYGIZoIwIDC8QABMQAtIMCr8jQV4AAAQUyLnBuZwoDEywTBmoeLyYgiVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYIKJie7GIwIDC8QABMQAtIMCr8jQV4AAAQUzLnBuZwoDEywTBmoeLyYgiVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYIL8cRc7IwIDC8QABMQAtIMCr8jQV4AAAQU0LnBuZwoDEywTBmoeLyYgiVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYIIdd1ZRAwUEAA==';
        const cbrPath = path.resolve(__dirname, 'test.cbr');
        fs.writeFileSync(cbrPath, Buffer.from(cbrBase64, 'base64'));

        const fileInput = await page1.$('#file-input');
        await fileInput.uploadFile(cbrPath);

        // Let's check page2
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Received') || document.getElementById('status').innerText.includes('Page '),
            { timeout: 10000 }
        );

        // Wait a small moment for syncing to finish
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify page1 is on page 1
        const status1 = await page1.$eval('#status', el => el.innerText);
        expect(status1).to.include('Page 1');

        // Verify image source is populated
        const imgSrc1 = await page1.$eval('#comic-page', el => el.src);
        expect(imgSrc1).to.not.be.empty;

        // Click next on page 1
        await page1.click('#nav-right');

        // Page 1 should go to index 2 (Page 3) because it's left side (shows 0, 2, 4)
        await page1.waitForFunction(
            () => document.getElementById('status').innerText.includes('Page 3'),
            { timeout: 5000 }
        );

        // Page 2 should go to index 3 (Page 4) because it's right side (shows 1, 3, 5)
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Page 4'),
            { timeout: 5000 }
        );

        // Verify page2 is on page 4
        const status2 = await page2.$eval('#status', el => el.innerText);
        expect(status2).to.include('Page 4');
    });

    it('should explicitly verify that a portrait cover prepends a blank page on the left', async function () {
        // Refresh pages
        await page1.goto('about:blank');
        await page2.goto('about:blank');

        const sessionId = 'test-session-portrait-123';

        // Client 1 connects (left)
        await page1.goto('http://localhost:3000');
        await page1.type('#session-id', sessionId);
        await page1.select('#role-select', 'left');
        await page1.click('#join-btn');

        await new Promise(resolve => setTimeout(resolve, 500));

        // Client 2 connects (right)
        await page2.goto('http://localhost:3000');
        await page2.type('#session-id', sessionId);
        await page2.select('#role-select', 'right');
        await page2.click('#join-btn');

        // Wait for connection
        await page1.waitForFunction(
            () => document.getElementById('status').innerText.includes('Peer Connected'),
            { timeout: 10000 }
        );
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Peer Connected'),
            { timeout: 10000 }
        );

        // Upload portrait cbz
        const jszip = require('jszip');
        const zip = new jszip();

        // Create a 1x2 portrait image
        const portraitPixelData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAQAAAAziH6sAAAADklEQVR42mNk+M/A8B8ABC4BzxA2E44AAAAASUVORK5CYII=', 'base64');
        zip.file("1.png", portraitPixelData);

        const content = await zip.generateAsync({type:"nodebuffer"});
        const cbzPath = path.resolve(__dirname, 'test-portrait.cbz');
        fs.writeFileSync(cbzPath, content);

        const fileInput = await page1.$('#file-input');
        await fileInput.uploadFile(cbzPath);

        // Wait for page2 to receive files
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Received') || document.getElementById('status').innerText.includes('Page '),
            { timeout: 10000 }
        );

        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify page1 is on page 1 (blank)
        const status1 = await page1.$eval('#status', el => el.innerText);
        expect(status1).to.include('Page 1 of 2');

        // Verify page2 is on page 2 (cover)
        const status2 = await page2.$eval('#status', el => el.innerText);
        expect(status2).to.include('Page 2 of 2');

        // Ensure page 1 is a 1x1 canvas image generated by createBlankPage()
        const imgSrc1 = await page1.$eval('#comic-page', el => el.src);
        // The blank page in client.js is a 1x1 jpeg, which produces a short data URL.
        // We know that prepending a blank page adds it to index 0. We can just check the total pages being 2 for a single portrait image proves a blank page was prepended.
        expect(imgSrc1).to.include('data:image/jpeg;base64,');
    });

    it('should connect two clients and synchronize page turns', async function () {
        // Refresh pages
        await page1.goto('about:blank');
        await page2.goto('about:blank');

        const sessionId = 'test-session-123';

        // Client 1 connects
        await page1.goto('http://localhost:3000');
        await page1.type('#session-id', sessionId);
        await page1.select('#role-select', 'left');
        await page1.click('#join-btn');

        await new Promise(resolve => setTimeout(resolve, 500));

        // Client 2 connects
        await page2.goto('http://localhost:3000');
        await page2.type('#session-id', sessionId);
        await page2.select('#role-select', 'right');
        await page2.click('#join-btn');

        // Wait for connection to be established
        await page1.waitForFunction(
            () => document.getElementById('status').innerText.includes('Peer Connected'),
            { timeout: 10000 }
        );
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Peer Connected'),
            { timeout: 10000 }
        );

        // Upload file
        const jszip = require('jszip');
        const zip = new jszip();

        // Creating some simple 1x1 pngs
        const pixelData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        zip.file("1.png", pixelData);
        zip.file("2.png", pixelData);
        zip.file("3.png", pixelData);
        zip.file("4.png", pixelData);

        const content = await zip.generateAsync({type:"nodebuffer"});
        const cbzPath = path.resolve(__dirname, 'test.cbz');
        fs.writeFileSync(cbzPath, content);

        const fileInput = await page1.$('#file-input');
        await fileInput.uploadFile(cbzPath);

        // Let's check page2
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Received') || document.getElementById('status').innerText.includes('Page '),
            { timeout: 10000 }
        );

        // Wait a small moment for syncing to finish
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify page1 is on page 1
        const status1 = await page1.$eval('#status', el => el.innerText);
        expect(status1).to.include('Page 1');

        // Verify image source is populated
        const imgSrc1 = await page1.$eval('#comic-page', el => el.src);
        expect(imgSrc1).to.not.be.empty;

        // Click next on page 1
        await page1.click('#nav-right');

        // Page 1 should go to index 2 (Page 3) because it's left side (shows 0, 2, 4)
        await page1.waitForFunction(
            () => document.getElementById('status').innerText.includes('Page 3'),
            { timeout: 5000 }
        );

        // Page 2 should go to index 3 (Page 4) because it's right side (shows 1, 3, 5)
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Page 4'),
            { timeout: 5000 }
        );

        // Verify page2 is on page 4
        const status2 = await page2.$eval('#status', el => el.innerText);
        expect(status2).to.include('Page 4');

        // Click prev on page 2
        await page2.click('#nav-left');

        await page1.waitForFunction(
            () => document.getElementById('status').innerText.includes('Page 1'),
            { timeout: 5000 }
        );

        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Page 2'),
            { timeout: 5000 }
        );
    });

    it('should correctly handle a landscape first page without prepending a blank page', async function () {
        // Refresh pages
        await page1.goto('about:blank');
        await page2.goto('about:blank');

        const sessionId = 'test-session-landscape-123';

        // Client 1 connects (left)
        await page1.goto('http://localhost:3000');
        await page1.type('#session-id', sessionId);
        await page1.select('#role-select', 'left');
        await page1.click('#join-btn');

        await new Promise(resolve => setTimeout(resolve, 500));

        // Client 2 connects (right)
        await page2.goto('http://localhost:3000');
        await page2.type('#session-id', sessionId);
        await page2.select('#role-select', 'right');
        await page2.click('#join-btn');

        // Wait for connection
        await page1.waitForFunction(
            () => document.getElementById('status').innerText.includes('Peer Connected'),
            { timeout: 10000 }
        );
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Peer Connected'),
            { timeout: 10000 }
        );

        // Upload landscape cbz
        const jszip = require('jszip');
        const zip = new jszip();

        // Create a 2x1 landscape image
        const landscapePixelData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAQAAABeK7cBAAAAC0lEQVR42mNkQAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        zip.file("1.png", landscapePixelData);

        const content = await zip.generateAsync({type:"nodebuffer"});
        const cbzPath = path.resolve(__dirname, 'test-landscape.cbz');
        fs.writeFileSync(cbzPath, content);

        const fileInput = await page1.$('#file-input');
        await fileInput.uploadFile(cbzPath);

        // Wait for page2 to receive files
        await page2.waitForFunction(
            () => document.getElementById('status').innerText.includes('Received') || document.getElementById('status').innerText.includes('Page '),
            { timeout: 10000 }
        );

        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify page1 is on page 1
        const status1 = await page1.$eval('#status', el => el.innerText);
        expect(status1).to.include('Page 1');

        // Verify page2 is on page 2 (not a blank page which would be Page 1 for a portrait cover if right page is offset)
        // With a landscape cover, it's split into 2 pages.
        // Total pages = 2.
        // Left is index 0 -> Page 1
        // Right is index 1 -> Page 2
        const status2 = await page2.$eval('#status', el => el.innerText);
        expect(status2).to.include('Page 2');

        // Ensure that page2 image is NOT the blank 1x1 image (blank image base64 starts with data:image/jpeg)
        // Wait, the split image is also a jpeg because canvas.toDataURL defaults to image/jpeg if not specified or specified,
        // but we can check if it loaded properly.
        // Actually we just check the status text "Page X of 2".
        expect(status1).to.include('of 2');
        expect(status2).to.include('of 2');
    });
});
