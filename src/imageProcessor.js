// src/imageProcessor.js
export async function processImage(arrayBuffer, forceDoublePage = false) {
    return new Promise((resolve, reject) => {
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            // Check if landscape (width > height) or forced double page
            if (img.width > img.height || forceDoublePage) {
                // Split into two pages
                const halfWidth = Math.floor(img.width / 2);

                // Left half
                const canvasLeft = document.createElement('canvas');
                canvasLeft.width = halfWidth;
                canvasLeft.height = img.height;
                const ctxLeft = canvasLeft.getContext('2d');
                ctxLeft.drawImage(img, 0, 0, halfWidth, img.height, 0, 0, halfWidth, img.height);
                const dataUrlLeft = canvasLeft.toDataURL('image/jpeg', 0.9);

                // Right half
                const canvasRight = document.createElement('canvas');
                canvasRight.width = img.width - halfWidth;
                canvasRight.height = img.height;
                const ctxRight = canvasRight.getContext('2d');
                ctxRight.drawImage(img, halfWidth, 0, canvasRight.width, img.height, 0, 0, canvasRight.width, img.height);
                const dataUrlRight = canvasRight.toDataURL('image/jpeg', 0.9);

                URL.revokeObjectURL(url);

                // Depending on manga vs western comic, right-to-left vs left-to-right might differ.
                // Assuming standard left-to-right reading for now.
                resolve([dataUrlLeft, dataUrlRight]);
            } else {
                // Portrait, single page
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                URL.revokeObjectURL(url);
                resolve([dataUrl]);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };

        img.src = url;
    });
}
