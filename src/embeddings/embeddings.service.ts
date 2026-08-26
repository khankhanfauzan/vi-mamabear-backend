import 'dotenv/config'
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';
import { Product } from '@/generated/prisma';

const weights = {
    name: 1.0,
    description: 0.15,
    tags: 2.0,
}

@Injectable()
export class EmbeddingsService {
    openrouter = new OpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY
    });
    async generateEmbeddingsFromProduct(product: Product) {
        var sumOfEmbeds : number[] = await this.generateEmbeddingFromString(product.name);
        var sumOfWeights = weights.name;

        var descEmbed: number[], tagsEmbed: number[];
        if(product.description && product.description.length > 0) {
            descEmbed = await this.generateEmbeddingFromString(product.description);
            if(sumOfEmbeds.length != descEmbed.length) throw new UnprocessableEntityException(`Cannot add two vectors of differing size: ${sumOfEmbeds.length} and ${descEmbed.length}`);
            sumOfEmbeds = sumOfEmbeds.map((num, i) => num + (descEmbed[i] * weights.description));
            sumOfWeights += weights.description;
        }
        if(product.tags && product.tags.length > 0) {
            tagsEmbed = await this.generateEmbeddingFromString(product.tags.join(" "));
            if(sumOfEmbeds.length != tagsEmbed.length) throw new UnprocessableEntityException(`Cannot add two vectors of differing size: ${sumOfEmbeds.length} and ${tagsEmbed.length}`);
            sumOfEmbeds = sumOfEmbeds.map((num, i) => num + (tagsEmbed[i] * weights.tags));
            sumOfWeights += weights.tags;
        }
        return sumOfEmbeds.map(num => num/sumOfWeights);
    }
    embeddingArrayToString(embeds: number[]){
        return `[${embeds.join(',')}]`;
    }

    async generateEmbeddingFromString(str: string) {
        var nameEmbedding : any = await this.openrouter.embeddings.generate({
            requestBody: {
                model: "perplexity/pplx-embed-v1-0.6b",
                input: str,
                encodingFormat: "float"
            }
        });
        return (nameEmbedding.data[0].embedding as number[]);
    }
}
