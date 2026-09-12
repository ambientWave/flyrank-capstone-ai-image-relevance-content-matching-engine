import { injectable } from 'tsyringe';
import { ImageDBRepository } from '../repositories/image-db.repository.ts';
import { PostDBRepository } from '../repositories/post-db.repository.ts';
import { CostLogDBRepository } from '../repositories/cost-log-db.repository.ts';
import { SuggestionDBRepository } from '../repositories/suggestion-db.repository.ts';

@injectable()
export class DatabaseInitializerService {
    constructor(
        private imageDBRepository: ImageDBRepository,
        private postDBRepository: PostDBRepository,
        private costLogDBRepository: CostLogDBRepository,
        private suggestionDBRepository: SuggestionDBRepository
    ) { }

    async initializeAll(): Promise<void> {
        await this.imageDBRepository.initDB();
        await this.postDBRepository.initDB();
        await this.costLogDBRepository.initDB();
        await this.suggestionDBRepository.initDB();
    }
}