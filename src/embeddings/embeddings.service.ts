import 'dotenv/config';
import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';
import { Product } from '@/generated/prisma';

const weights = {
  name: 1.0,
  description: 0.15,
  tags: 2.0,
};

@Injectable()
export class EmbeddingsService {
  openrouter = new OpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  async generateEmbeddingsFromProduct(product: Product) {
    let sumOfEmbeds: number[] = await this.generateEmbeddingFromString(
      product.name,
    );
    let sumOfWeights = weights.name;

    let descEmbed: number[], tagsEmbed: number[];
    if (product.description && product.description.length > 0) {
      descEmbed = await this.generateEmbeddingFromString(product.description);
      if (sumOfEmbeds.length != descEmbed.length)
        throw new UnprocessableEntityException(
          `Cannot add two vectors of differing size: ${sumOfEmbeds.length} and ${descEmbed.length}`,
        );
      sumOfEmbeds = sumOfEmbeds.map(
        (num, i) => num + descEmbed[i] * weights.description,
      );
      sumOfWeights += weights.description;
    }
    if (product.tags && product.tags.length > 0) {
      tagsEmbed = await this.generateEmbeddingFromString(
        product.tags.join(' '),
      );
      if (sumOfEmbeds.length != tagsEmbed.length)
        throw new UnprocessableEntityException(
          `Cannot add two vectors of differing size: ${sumOfEmbeds.length} and ${tagsEmbed.length}`,
        );
      sumOfEmbeds = sumOfEmbeds.map(
        (num, i) => num + tagsEmbed[i] * weights.tags,
      );
      sumOfWeights += weights.tags;
    }
    return sumOfEmbeds.map((num) => num / sumOfWeights);
  }
  embeddingArrayToString(embeds: number[]) {
    return `[${embeds.join(',')}]`;
  }

  async generateEmbeddingFromString(str: string) {
    const nameEmbedding: any = await this.openrouter.embeddings.generate({
      requestBody: {
        model: 'liquid/lfm-2.5-embedding-350m:free',
        input: str,
        encodingFormat: 'float',
      },
    });
    return nameEmbedding.data[0].embedding as number[];
  }
}
