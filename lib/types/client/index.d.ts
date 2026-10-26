import type { Context } from '@deepseek-ai/cordis';
export type { ReaderBlockOwner, ReaderBlockPresentation } from './types.js';
export type { DisplayCursor, DisplayText, DisplayTextKind, DisplayTextRequest, DisplayTextTransformer, TextTransformRegistry } from './text-transform.js';
export { McpAppFrame } from './McpAppFrame.js';
export { TEXT_TRANSFORM_SERVICE, createTextTransformRegistry, originalAnswerText } from './text-transform.js';
export declare const name = "dsh-better-display-client";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map