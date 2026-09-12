async function getDataFromUrls(resourceUrls: string[], isImage: boolean = false): Promise<{ url: string, content: string | any }[]> {
    const data: { url: string, content: string | any }[] = [];
    try {
        if (isImage) {
            for (const url of resourceUrls) {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                    },
                    redirect: 'follow'
                });
                if (!response.ok) {
                    throw new Error(`Failed to fetch image ${url}: ${response.status} ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                data.push({ url, content: buffer });
            }
        } else {
            for (const url of resourceUrls) {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                }
                data.push({ url, content: await response.text() });
            }
        }
    } catch (error) {
        console.error('Error fetching URLs:', error);
        throw error;
    }
    return data;
}

export { getDataFromUrls };