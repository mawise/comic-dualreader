import JSZip from 'jszip';
import { createExtractorFromData } from 'node-unrar-js';

export async function extractFiles(file) {
    const arrayBuffer = await file.arrayBuffer();
    const isZip = file.name.toLowerCase().endsWith('.cbz') || file.name.toLowerCase().endsWith('.zip');
    const isRar = file.name.toLowerCase().endsWith('.cbr') || file.name.toLowerCase().endsWith('.rar');

    const imageRegex = /\.(jpg|jpeg|png|gif|webp)$/i;
    let extractedFiles = [];

    if (isZip) {
        const zip = await JSZip.loadAsync(arrayBuffer);
        for (const [filename, fileData] of Object.entries(zip.files)) {
            if (!fileData.dir && imageRegex.test(filename)) {
                const buffer = await fileData.async('arraybuffer');
                extractedFiles.push({ filename, buffer });
            }
        }
    } else if (isRar) {
        const extractor = await createExtractorFromData({ data: new Uint8Array(arrayBuffer) });
        const { files } = extractor.extract({ files: (fileHeader) => {
            return !fileHeader.flags.directory && imageRegex.test(fileHeader.name);
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

    // Sort by filename alphabetically
    extractedFiles.sort((a, b) => a.filename.localeCompare(b.filename));

    return extractedFiles;
}
