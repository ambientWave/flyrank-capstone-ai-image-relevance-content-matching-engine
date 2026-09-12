import { injectable } from 'tsyringe';
import {
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    type PreTrainedTokenizer,
    type PreTrainedModel,
} from '@huggingface/transformers';


const MODEL_ID = 'Xenova/t5-small';

export interface PostText {
    postId: string;
    title: string;
    body: string;
}

@injectable()
export class TextSummarizeRepository {
    private readonly textSummarizingModel: Promise<PreTrainedModel>;
    private readonly tokenizer: Promise<PreTrainedTokenizer>;

    constructor() {
        this.textSummarizingModel = AutoModelForSeq2SeqLM.from_pretrained(MODEL_ID, { dtype: "fp16" });
        this.tokenizer = AutoTokenizer.from_pretrained(MODEL_ID);
    }

    async summarizePost(text: string): Promise<{
        summary: string;
        inputTokens: number;
        outputTokens: number;
    }> {
        const tokenizer = await this.tokenizer;
        const textSummarizingModel = await this.textSummarizingModel;
        const inputs = await tokenizer(`summarize: ${text}`, {
            return_tensors: 'pt',
            truncation: true,
            max_length: 512
        });
        const inputTokens = (inputs.input_ids as any).shape?.[1] ?? 0;

        const generated_ids = await textSummarizingModel.generate({
            ...inputs,
            max_new_tokens: 40,       // caption-length gist, not a 100-token paragraph — see note below
            min_new_tokens: 10,
            num_beams: 4,             // beam search, not greedy — greedy decoding is the other half of why output looked degenerate
            no_repeat_ngram_size: 3,  // stops the model looping on short phrases, common failure mode at this model size
            early_stopping: true,
        });

        const outputTokens = (generated_ids as any).shape?.[1] ?? 0;

        const summary = tokenizer.decode((generated_ids as any)[0], {
            skip_special_tokens: true,
        });

        return { summary, inputTokens, outputTokens };
    }
}
