import type { Handler, Response } from 'express';
declare type CachedRouterOptions = {
    lifetime: number;
};
interface CachedResponse {
    status: number;
    json: any;
}
export declare function pipeFromCache(cache: CachedResponse, res: Response): void;
export declare function cachedHandler(handler: Handler, options?: CachedRouterOptions): Handler;
export {};
//# sourceMappingURL=cached-handler.d.ts.map