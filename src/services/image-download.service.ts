import { query } from "../repositories/image-download.repository.ts";
import { type PhotosWithTotalResults, type ErrorResponse, type Photo } from 'pexels';
/**
 * downloadImagesList isn't the same as fetchPostsText
 * There are two methods for /images, GET and POST. That's because we are downloading images from pexels.
 * However, there is a single POST method for /posts.
 * @param search 
 * @returns 
 */
async function downloadImagesList(search: string): Promise<{ photos: Photo[] }> {
    const imageList: PhotosWithTotalResults | ErrorResponse = await query(search)
    if ('photos' in imageList) {
        return { photos: imageList.photos };
    } else {
        throw new Error(imageList.error);
    }
}

export { downloadImagesList };