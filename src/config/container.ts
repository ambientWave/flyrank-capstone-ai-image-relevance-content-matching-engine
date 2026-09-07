import 'reflect-metadata';
import { container } from 'tsyringe';

// Repositories
import { TextEmbedRepository } from '../repositories/text-embed.repository.ts';
import { ImageEmbedRepository } from '../repositories/image-embed.repository.ts';
import { ImageDBRepository } from '../repositories/image-db.repository.ts';
import { ImageUnderstandRepository } from '../repositories/image-understand.repository.ts';

// Services
import { TextEmbedService } from '../services/text-embed.service.ts';
import { ImageEmbedService } from '../services/image-embed.service.ts';
import { ImageUnderstandService } from '../services/image-understand.service.ts';
import { IngestionOrchestratorService } from '../services/ingestion-orchestrator.service.ts';
import { JobQueueService } from '../services/job-queue.service.ts';

// Create repository instances (singletons - models load once)
const textEmbedRepository = new TextEmbedRepository();
const imageEmbedRepository = new ImageEmbedRepository();
const imageDBRepository = new ImageDBRepository();
const imageUnderstandRepository = new ImageUnderstandRepository();

// Register repositories as values (already instantiated)
container.registerInstance('TextEmbedRepository', textEmbedRepository);
container.registerInstance('ImageEmbedRepository', imageEmbedRepository);
container.registerInstance('ImageDBRepository', imageDBRepository);
container.registerInstance('ImageUnderstandRepository', imageUnderstandRepository);

// Create service instances with dependencies
const textEmbedService = new TextEmbedService(textEmbedRepository);
const imageEmbedService = new ImageEmbedService(imageEmbedRepository);
const imageUnderstandService = new ImageUnderstandService(imageUnderstandRepository);
const jobQueueService = new JobQueueService();
const ingestionOrchestratorService = new IngestionOrchestratorService(
    imageDBRepository,
    imageEmbedService,
    textEmbedService,
    jobQueueService,
    imageUnderstandService
);

// Register services as values (already instantiated singletons)
container.registerInstance('TextEmbedService', textEmbedService);
container.registerInstance('ImageEmbedService', imageEmbedService);
container.registerInstance('ImageUnderstandService', imageUnderstandService);
container.registerInstance('JobQueueService', jobQueueService);
container.registerInstance('IngestionOrchestratorService', ingestionOrchestratorService);

export { container };