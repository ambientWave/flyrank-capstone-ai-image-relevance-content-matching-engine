import dotenv from 'dotenv';
dotenv.config();

export const chromadbConfig = {
    host: process.env.CHROMADB_HOST || "chromadb",
    port: 8000
};
