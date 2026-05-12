const JSZip = require('jszip');
const fs = require('fs');

async function create() {
    const zip = new JSZip();
    // 100x100 red png
    const p1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGQAAABkAQMAAABKLAcXAAAABlBMVEX/AAD///9BHTQRAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAADUlEQVR42mP8/5+BBAwY4//5P74MwgAAAABJRU5ErkJggg==', 'base64');
    // 200x100 blue png (landscape to test splitting)
    const p2 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMgAAABkAQMAAAD1yS1XAAAABlBMVEUAAP///+l2Z/dAAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAEElEQVR42mP8/5+BAgwwIAD5P74MwgAAAABJRU5ErkJggg==', 'base64');

    zip.file('page1.png', p1);
    zip.file('page2.png', p2);

    const content = await zip.generateAsync({type: 'nodebuffer'});
    fs.writeFileSync('/home/jules/test_data/test.cbz', content);
    console.log('Created test.cbz');
}
create();
