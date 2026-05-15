import JSZip from 'jszip';
import { createExtractorFromData } from 'node-unrar-js';

export async function extractFiles(file) {
    const arrayBuffer = await file.arrayBuffer();
    const isZip = file.name.toLowerCase().endsWith('.cbz') || file.name.toLowerCase().endsWith('.zip');
    const isRar = file.name.toLowerCase().endsWith('.cbr') || file.name.toLowerCase().endsWith('.rar');

    const fileRegex = /\.(jpg|jpeg|png|gif|webp|xml)$/i;
    let extractedFiles = [];

    if (isZip) {
        const zip = await JSZip.loadAsync(arrayBuffer);
        for (const [filename, fileData] of Object.entries(zip.files)) {
            if (!fileData.dir && fileRegex.test(filename)) {
                const buffer = await fileData.async('arraybuffer');
                extractedFiles.push({ filename, buffer });
            }
        }
    } else if (isRar) {
        const extractor = await createExtractorFromData({ data: new Uint8Array(arrayBuffer) });
        const { files } = extractor.extract({ files: (fileHeader) => {
            return !fileHeader.flags.directory && fileRegex.test(fileHeader.name);
        }});

        for (const file of files) {
            if (file.extraction) {
                extractedFiles.push({
                    filename: file.fileHeader.name,
                    buffer: file.extraction.buffer.slice(
                        file.extraction.byteOffset,
                        file.extraction.byteOffset + file.extraction.byteLength
                    )
                });
            }
        }
    }

    let images = [];
    let xmlBuffer = null;

    for (const f of extractedFiles) {
        if (f.filename.toLowerCase().endsWith('.xml')) {
            if (f.filename.toLowerCase().includes('comicinfo.xml')) {
                xmlBuffer = f.buffer;
            }
        } else {
            images.push(f);
        }
    }

    // Sort by filename alphabetically
    images.sort((a, b) => a.filename.localeCompare(b.filename));

    return { images, xmlBuffer };
}
