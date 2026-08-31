import express, { type Express } from 'express';
import imageRoutes from './routes/image.routes.ts';
import { ImageEmbedService } from './services/image-embed.service.ts';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
app.use(express.json());
//need to instantiate image-embed.service (this, by itself, instantiates its repository) so that it stores the state of the collections, and embeddings
// we need to use the same model for embedding image and post vectors because the cosine similarity only works when the vectors are generated using the same model
const imageEmbedService = new ImageEmbedService();

// 2. Attach it to Express app settings
app.set('imageEmbedService', imageEmbedService);
app.use('/', imageRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});