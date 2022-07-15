import type { Response, Application as ExpressApplication, RequestHandler, ErrorRequestHandler } from 'express';
import { SubscriptionServer, WebSocketSendMessageFn } from './SubscriptionServer';
import { CheckAuthFn, CheckAuthMiddlewareFn, ExtendContextFn, QueryTransformerFn, RequestContext, RequestLoggerMiddlewareFn, Request, ExtendedRequestContext, JWTOptions, SecurityContextExtractorFn } from './interfaces';
declare type ResponseResultFn = (message: object, extra?: {
    status: number;
}) => void;
declare type CheckAuthInternalOptions = {
    isPlaygroundCheckAuth: boolean;
};
export declare type UserBackgroundContext = {
    authInfo?: any;
    securityContext: any;
};
export interface ApiGatewayOptions {
    standalone: boolean;
    dataSourceStorage: any;
    refreshScheduler: any;
    scheduledRefreshContexts?: () => Promise<UserBackgroundContext[]>;
    scheduledRefreshTimeZones?: String[];
    basePath: string;
    extendContext?: ExtendContextFn;
    checkAuth?: CheckAuthFn;
    checkAuthMiddleware?: CheckAuthMiddlewareFn;
    jwt?: JWTOptions;
    requestLoggerMiddleware?: RequestLoggerMiddlewareFn;
    queryTransformer?: QueryTransformerFn;
    subscriptionStore?: any;
    enforceSecurityChecks?: boolean;
    playgroundAuthSecret?: string;
}
export declare class ApiGateway {
    protected readonly apiSecret: string;
    protected readonly compilerApi: any;
    protected readonly adapterApi: any;
    protected readonly logger: any;
    protected readonly refreshScheduler: any;
    protected readonly scheduledRefreshContexts: ApiGatewayOptions['scheduledRefreshContexts'];
    protected readonly scheduledRefreshTimeZones: ApiGatewayOptions['scheduledRefreshTimeZones'];
    protected readonly basePath: string;
    protected readonly queryTransformer: QueryTransformerFn;
    protected readonly subscriptionStore: any;
    protected readonly enforceSecurityChecks: boolean;
    protected readonly standalone: boolean;
    protected readonly extendContext?: ExtendContextFn;
    protected readonly dataSourceStorage: any;
    readonly checkAuthFn: CheckAuthFn;
    readonly checkAuthSystemFn: CheckAuthFn;
    protected readonly checkAuthMiddleware: CheckAuthMiddlewareFn;
    protected readonly requestLoggerMiddleware: RequestLoggerMiddlewareFn;
    protected readonly securityContextExtractor: SecurityContextExtractorFn;
    protected readonly releaseListeners: (() => any)[];
    protected readonly playgroundAuthSecret?: string;
    constructor(apiSecret: string, compilerApi: any, adapterApi: any, logger: any, options: ApiGatewayOptions);
    initApp(app: ExpressApplication): void;
    initSubscriptionServer(sendMessage: WebSocketSendMessageFn): SubscriptionServer;
    protected duration(requestStarted: any): any;
    runScheduledRefresh({ context, res, queryingOptions }: {
        context: RequestContext;
        res: ResponseResultFn;
        queryingOptions: any;
    }): Promise<void>;
    meta({ context, res }: {
        context: RequestContext;
        res: ResponseResultFn;
    }): Promise<void>;
    getPreAggregations({ context, res }: {
        context: RequestContext;
        res: ResponseResultFn;
    }): Promise<void>;
    getPreAggregationPartitions({ query, context, res }: {
        query: any;
        context: RequestContext;
        res: ResponseResultFn;
    }): Promise<void>;
    protected getNormalizedQueries(query: any, context: RequestContext): Promise<any>;
    sql({ query, context, res }: {
        query: any;
        context: RequestContext;
        res: ResponseResultFn;
    }): Promise<void>;
    protected createSecurityContextExtractor(options?: JWTOptions): SecurityContextExtractorFn;
    protected coerceForSqlQuery(query: any, context: Readonly<RequestContext>): any;
    protected dryRun({ query, context, res }: {
        query: any;
        context: RequestContext;
        res: ResponseResultFn;
    }): Promise<void>;
    load({ query, context, res, ...props }: any): Promise<void>;
    subscribe({ query, context, res, subscribe, subscriptionState, queryType }: {
        query: any;
        context: any;
        res: any;
        subscribe: any;
        subscriptionState: any;
        queryType: any;
    }): Promise<void>;
    protected resToResultFn(res: Response): (message: any, { status }?: {
        status: any;
    }) => Response<any, Record<string, any>>;
    protected parseQueryParam(query: any): any;
    protected getCompilerApi(context: any): any;
    protected getAdapterApi(context: any): any;
    contextByReq(req: Request, securityContext: any, requestId: string): Promise<ExtendedRequestContext>;
    protected handleErrorMiddleware: ErrorRequestHandler;
    handleError({ e, context, query, res, requestStarted }: any): void;
    protected wrapCheckAuthMiddleware(fn: CheckAuthMiddlewareFn): CheckAuthMiddlewareFn;
    protected wrapCheckAuth(fn: CheckAuthFn): CheckAuthFn;
    protected createDefaultCheckAuth(options?: JWTOptions, internalOptions?: CheckAuthInternalOptions): CheckAuthFn;
    protected createCheckAuthFn(options: ApiGatewayOptions): CheckAuthFn;
    protected createCheckAuthSystemFn(): CheckAuthFn;
    protected extractAuthorizationHeaderWithSchema(req: Request): string | undefined;
    protected checkAuthWrapper(checkAuthFn: CheckAuthFn, req: Request, res: Response, next: any): Promise<void>;
    protected checkAuth: RequestHandler;
    protected checkAuthSystemMiddleware: RequestHandler;
    protected requestContextMiddleware: RequestHandler;
    protected requestLogger: RequestHandler;
    protected compareDateRangeTransformer(query: any): any;
    protected log(event: {
        type: string;
        [key: string]: any;
    }, context?: RequestContext): void;
    protected healthResponse(res: Response, health: 'HEALTH' | 'DOWN'): void;
    protected createSystemContextHandler: (basePath: string) => RequestHandler;
    protected readiness: RequestHandler;
    protected liveness: RequestHandler;
    release(): void;
}
export {};
//# sourceMappingURL=gateway.d.ts.map