import { injectable } from 'tsyringe';
import {
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    type PreTrainedTokenizer,
    type PreTrainedModel,
} from '@huggingface/transformers';


const MODEL_ID = 'google-t5/t5-small';

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

    async summarizePost(text: string): Promise<string> {
        const tokenizer = await this.tokenizer;
        const textSummarizingModel = await this.textSummarizingModel;
        
        const inputs = await tokenizer(text, { return_tensors: 'pt' });
        
        const generated_ids = await textSummarizingModel.generate({
            ...inputs,
            max_new_tokens: 10,
            do_sample: false,
        });

        const decoded_text = tokenizer.decode((generated_ids as any)[0], {
            skip_special_tokens: true,
        });
        
        return decoded_text;
    }
}
