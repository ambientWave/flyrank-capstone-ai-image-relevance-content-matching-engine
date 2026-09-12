import { injectable } from 'tsyringe';
import { getDataFromUrls } from '../middleware/request-utils.ts';

export interface PostContent {
    title: string;
    body: string;
}

@injectable()
export class PostDownloadService {
    async fetchPostsText(urls: string[]): Promise<{ url: string, content: any }[]> {
        const responses = await getDataFromUrls(urls, false);
        return responses;
    }
}