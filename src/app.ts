import 'reflect-metadata';
import { container } from './config/container.ts';
import express, { type Express } from 'express';
import imageRoutes from './routes/image.routes.ts';
import { ImageDBRepository } from './repositories/image-db.repository.ts';
import { visionWorker } from './workers/image-understand.worker.ts';
import { textEmbedWorker } from './workers/text-embed.worker.ts';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
app.use(express.json());

// Initialize DB (creates tables)
const imageDBRepository = container.resolve('ImageDBRepository') as ImageDBRepository;
await imageDBRepository.initDB();

// Start workers
visionWorker().then(worker => {
    console.log('Vision worker started');
    worker.on('error', err => console.error('Vision worker error:', err));
});

textEmbedWorker().then(worker => {
    console.log('Text embed worker started');
    worker.on('error', err => console.error('Text embed worker error:', err));
});

app.use('/', imageRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

/**import express, { type Express } from 'express';
import imageRoutes from './routes/image.routes.ts';
import { ImageEmbedService } from './services/image-embed.service.ts';
import { TextEmbedService } from './services/text-embed.service.ts';
import dotenv from 'dotenv';
import { ImageDBRepository } from './repositories/image-db.repository.ts';
import { visionWorker } from './workers/image-understand.worker.ts';
import { textEmbedWorker } from './workers/text-embed.worker.ts';

dotenv.config();

const app: Express = express();
app.use(express.json());

const imageEmbedService = new ImageEmbedService();
app.set('imageEmbedService', imageEmbedService);

const textEmbedService = new TextEmbedService();
app.set('textEmbedService', textEmbedService);

const imageDBRepository = new ImageDBRepository();
await imageDBRepository.initDB();
app.set('imageDBRepository', imageDBRepository);

app.use('/', imageRoutes);

visionWorker(app).then(worker => {
    console.log('Vision worker started');
    worker.on('error', err => console.error('Vision worker error:', err));
});

textEmbedWorker(app).then(worker => {
    console.log('Text embed worker started');
    worker.on('error', err => console.error('Text embed worker error:', err));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

/**import express, { type Express } from 'express';
import imageRoutes from './routes/image.routes.ts';
import { ImageEmbedService } from './services/image-embed.service.ts';
import { TextEmbedService } from './services/text-embed.service.ts';
import dotenv from 'dotenv';
import { ImageDBRepository } from './repositories/image-db.repository.ts';

dotenv.config();

const app: Express = express();
app.use(express.json());
//need to instantiate image-embed.service (this, by itself, instantiates its repository) so that it stores the state of the collections, and embeddings
// we need to use the same model for embedding image and post vectors because the cosine similarity only works when the vectors are generated using the same model
const imageEmbedService = new ImageEmbedService();
app.set('imageEmbedService', imageEmbedService);
const textEmbedService = new TextEmbedService();
app.set('textEmbedService', textEmbedService);
const imageDBRepository = new ImageDBRepository();
app.set('imageDBRepository', imageDBRepository);
app.use('/', imageRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
}); */