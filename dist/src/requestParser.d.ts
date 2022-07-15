import type { Request, Response } from 'express';
interface RequestParserResult {
    path: string;
    method: string;
    status: number;
    ip: string;
    time: string;
    contentLength?: string;
    contentType?: string;
}
export declare function getRequestIdFromRequest(req: Request): string;
export declare function requestParser(req: Request, res: Response): RequestParserResult;
export {};
//# sourceMappingURL=requestParser.d.ts.map