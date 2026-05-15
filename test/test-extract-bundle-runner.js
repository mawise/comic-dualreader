import { extractFiles } from '../src/extract.js';
import JSZip from 'jszip';

async function run() {
    const cbrBase64 = 'UmFyIRoHAQAzkrXlCgEFBgAFAQGAgADqrE5BIwIDC8QABMQAtIMCr8jQV4AAAQUxLnBuZwoDEywTBmoeLyYgiVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYIIYGIZoIwIDC8QABMQAtIMCr8jQV4AAAQUyLnBuZwoDEywTBmoeLyYgiVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYIKJie7GIwIDC8QABMQAtIMCr8jQV4AAAQUzLnBuZwoDEywTBmoeLyYgiVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYIL8cRc7IwIDC8QABMQAtIMCr8jQV4AAAQU0LnBuZwoDEywTBmoeLyYgiVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYIIdd1ZRAwUEAA==';
    const buffer = Buffer.from(cbrBase64, 'base64');
    const cbrFile = {
        name: 'test.cbr',
        arrayBuffer: async () => new Uint8Array(buffer).buffer
    };

    let cbrExtracted = await extractFiles(cbrFile);
    if (cbrExtracted.length !== 4) throw new Error("CBR length failed");
    cbrExtracted.forEach(f => {
        if (f.buffer.byteLength !== 68) throw new Error("CBR byteLength failed");
        const u8 = new Uint8Array(f.buffer);
        if (u8[0] !== 0x89) throw new Error("CBR magic number failed");
    });
    console.log("CBR OK");

    const zip = new JSZip();
    const pixelData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    zip.file("1.png", pixelData);
    zip.file("2.png", pixelData);
    const cbzContent = await zip.generateAsync({type:"nodebuffer"});
    const cbzFile = {
        name: 'test.cbz',
        arrayBuffer: async () => new Uint8Array(cbzContent).buffer
    };
    let cbzExtracted = await extractFiles(cbzFile);
    if (cbzExtracted.length !== 2) throw new Error("CBZ length failed");
    cbzExtracted.forEach(f => {
        if (f.buffer.byteLength !== 68) throw new Error("CBZ byteLength failed");
        const u8 = new Uint8Array(f.buffer);
        if (u8[0] !== 0x89) throw new Error("CBZ magic number failed");
    });
    console.log("CBZ OK");
}
run().catch(e => { console.error(e); process.exit(1); });
