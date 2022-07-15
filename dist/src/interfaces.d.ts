import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
export interface QueryFilter {
    member: string;
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'gt' | 'gte' | 'lt' | 'lte' | 'set' | 'notSet' | 'inDateRange' | 'notInDateRange' | 'beforeDate' | 'afterDate';
    values?: string[];
}
export declare type QueryTimeDimensionGranularity = 'hour' | 'day' | 'week' | 'month' | 'year';
export interface QueryTimeDimension {
    dimension: string;
    dateRange?: string[] | string;
    granularity?: QueryTimeDimensionGranularity;
}
export interface Query {
    measures: string[];
    dimensions?: string[];
    filters?: QueryFilter[];
    timeDimensions?: QueryTimeDimension[];
    segments?: string[];
    limit?: number;
    offset?: number;
    order?: 'asc' | 'desc';
    timezone?: string;
    renewQuery?: boolean;
    ungrouped?: boolean;
}
export interface NormalizedQueryFilter extends QueryFilter {
    dimension?: string;
}
export interface NormalizedQuery extends Query {
    filters?: NormalizedQueryFilter[];
    rowLimit?: number;
}
export interface RequestContext {
    securityContext: any;
    requestId: string;
    signedWithPlaygroundAuthSecret?: boolean;
}
export declare type RequestExtension = Record<string, any>;
export declare type ExtendedRequestContext = RequestContext & RequestExtension;
export interface Request extends ExpressRequest {
    context?: ExtendedRequestContext;
    authInfo?: any;
    securityContext?: any;
    signedWithPlaygroundAuthSecret?: boolean;
}
export interface JWTOptions {
    jwkRetry?: number;
    jwkDefaultExpire?: number;
    jwkUrl?: ((payload: any) => string) | string;
    jwkRefetchWindow?: number;
    key?: string;
    algorithms?: string[];
    issuer?: string[];
    audience?: string;
    subject?: string;
    claimsNamespace?: string;
}
export declare type QueryTransformerFn = (query: Query, context: RequestContext) => Promise<Query>;
export declare type CheckAuthMiddlewareFn = (req: Request, res: ExpressResponse, next: ExpressNextFunction) => void;
export declare type SecurityContextExtractorFn = (ctx: Readonly<RequestContext>) => any;
export declare type RequestLoggerMiddlewareFn = (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => void;
export declare type CheckAuthFn = (ctx: any, authorization?: string) => Promise<void> | void;
export declare type ExtendContextFn = (req: ExpressRequest) => Promise<RequestExtension> | RequestExtension;
//# sourceMappingURL=interfaces.d.ts.map