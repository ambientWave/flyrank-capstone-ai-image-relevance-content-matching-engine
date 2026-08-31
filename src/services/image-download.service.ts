import { query, store } from "../repositories/image-download.repository.ts";
import { type PhotosWithTotalResults, type ErrorResponse } from 'pexels';

async function downloadImagesList(search: string): Promise<void> {
    const imageList: PhotosWithTotalResults | ErrorResponse = await query(search)
    if ('photos' in imageList) {
        const imageMap: Map<string, string> = new Map();
        console.log("imageList", imageList);
        for (let i = 0; i < imageList.photos.length; i++) {
            const photo = imageList.photos[i];
            console.log("photo", photo);
            // split after photos/
            // const fileName = element.src.large.split('photos/')[1];
            // imageMap.set(fileName, element.src.large);
        }
        // await store(imageMap);
        return;
    } else {
        throw new Error(imageList.error);
    }
}

export { downloadImagesList };