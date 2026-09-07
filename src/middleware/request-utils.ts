import { RawImage } from '@huggingface/transformers';

async function getDataFromUrls(resourceUrls: string[], isImage: boolean = false): Promise<{ id: string, content: string | RawImage }[]> {
    const data: { id: string, content: string | RawImage }[] = [];
    if (isImage) {
        for (const url of resourceUrls) {
            const response = await RawImage.read(url);
            data.push({ id: url, content: response });
        }
    } else {
        for (const url of resourceUrls) {
            const response = await fetch(url);
            data.push({ id: url, content: await response.text() });
        }
    }
    return data;
}

export { getDataFromUrls };