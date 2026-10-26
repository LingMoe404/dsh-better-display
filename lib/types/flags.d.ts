/** Startup kill switch loaded from flags.json. This is not the reader glass setting. */
export interface Flags {
    readonly readerEnabled: boolean;
}
export declare const defaultFlags: Flags;
export declare function loadFlags(source?: string | Flags): Flags;
//# sourceMappingURL=flags.d.ts.map