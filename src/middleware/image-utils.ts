/**
 * Converts image file to base64 encoded string
 */
async function imageToBase64(image: Buffer<ArrayBuffer>): Promise<string> {
    // const imageBuffer = await fs.promises.readFile(imagePath);
    // convert image Buffer<ArrayBuffer> to base64 string
    const base64Image = Buffer.from(image).toString('base64');
    return base64Image;
}

/**
 * Determines MIME type from file extension
 */
function getMimeType(url: string): string {
    // this is now a url
    const extension: string | undefined = url.split('.').pop()?.toLowerCase();
    if (!extension) {
        throw new Error('Failed to get extension from url');
    }
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
    };
    return mimeTypes[extension] || 'image/jpeg';
}

export {
    imageToBase64, getMimeType
};