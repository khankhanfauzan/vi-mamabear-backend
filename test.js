import 'dotenv/config';
import { OpenRouter } from '@openrouter/sdk';

class EmbeddingsService {
    openrouter = new OpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY
    });
    async generateEmbeddingsFromProduct(product) {
        var nameEmbedding = await this.openrouter.embeddings.generate({
            requestBody: {
                model: "perplexity/pplx-embed-v1-0.6b",
                input: product.name,
                encodingFormat: "float"
            }
        });
    }

    async generateEmbeddingFromString(str, weight) {
        var nameEmbedding = await this.openrouter.embeddings.generate({
            requestBody: {
                model: "perplexity/pplx-embed-v1-0.6b",
                input: str,
                encodingFormat: "float"
            }
        });
        console.log(nameEmbedding.data[0], nameEmbedding.data[0].embedding.length);
    }
}

let service = new EmbeddingsService();
service.generateEmbeddingFromString("MamaBear Kukis Almond Oat - Camilan Kaya Nutrisi untuk Ibu Menyusui Halal BPOM");
