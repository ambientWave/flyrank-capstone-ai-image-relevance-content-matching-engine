
export class MatchEvaluateService {
    constructor(
        private postRepo: PostRepository,
        private imageRepo: ImageRepository,
        private matchingService: MatchingService,
        private costService: CostService,
    ) { }


    async evaluateMatch(postId: string): Promise<GuardDecision> {
        const post = await this.postRepo.get(postId);          // has .subject jsonb
        const top = await this.matchingService.rankCandidates(postId, 1);

        if (!top.length || top[0].similarity < SIMILARITY_FLOOR) {
            return this.persist(postId, null, "no_match", "no candidate above similarity threshold", top[0]?.similarity ?? 0);
        }

        const image = await this.imageRepo.get(top[0].imageId);  // has .tags jsonb
        if (image.tags.category !== post.subject.category || image.tags.subject !== post.subject.subject) {
            return this.persist(postId, image.id, "rejected",
                `category mismatch: expected ${post.subject.subject}, detected ${image.tags.subject}`, top[0].similarity);
        }

        return this.persist(postId, image.id, "accepted", "category and similarity both matched", top[0].similarity);
    }
}