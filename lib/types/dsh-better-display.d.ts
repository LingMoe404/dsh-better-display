import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import { type Flags } from './flags.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        webServer?: {
            register: (route: {
                kind: 'exact' | 'prefix';
                path: string;
                handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
            }) => () => void;
        };
    }
}
export declare const name = "dsh-better-display";
export declare const inject: string[];
export declare function apply(ctx: Context, options?: {
    readonly flags?: Flags;
}): void;
//# sourceMappingURL=dsh-better-display.d.ts.map