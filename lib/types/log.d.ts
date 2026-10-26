import type { IncomingMessage } from 'node:http';
export declare const REDACTED = "[REDACTED]";
export type LogFields = Record<string, unknown>;
export interface Logger {
    info(msg: string, fields?: LogFields): void;
    warn(msg: string, fields?: LogFields): void;
    error(msg: string, fields?: LogFields): void;
}
export interface LoggerOptions {
    readonly write?: (line: string) => void;
    readonly base?: LogFields;
    readonly clock?: () => Date;
}
export declare function redact(value: unknown): unknown;
export declare function createLogger(options?: LoggerOptions): Logger;
export declare function requestIdOf(req: IncomingMessage): string;
//# sourceMappingURL=log.d.ts.map