"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiGateway = void 0;
/* eslint-disable no-restricted-syntax */
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const fixMeasures_js_1 = require("./fixMeasures.js");
const ramda_1 = __importDefault(require("ramda"));
const moment_1 = __importDefault(require("moment"));
const body_parser_1 = __importDefault(require("body-parser"));
const shared_1 = require("@cubejs-backend/shared");
const requestParser_1 = require("./requestParser");
const UserError_1 = require("./UserError");
const CubejsHandlerError_1 = require("./CubejsHandlerError");
const SubscriptionServer_1 = require("./SubscriptionServer");
const LocalSubscriptionStore_1 = require("./LocalSubscriptionStore");
const query_1 = require("./query");
const cached_handler_1 = require("./cached-handler");
const jwk_1 = require("./jwk");
const toConfigMap = (metaConfig) => ramda_1.default.fromPairs(ramda_1.default.map((c) => [c.config.name, c.config], metaConfig));
const prepareAnnotation = (metaConfig, query) => {
    const configMap = toConfigMap(metaConfig);
    const annotation = (memberType) => (member) => {
        const [cubeName, fieldName] = member.split('.');
        const memberWithoutGranularity = [cubeName, fieldName].join('.');
        const config = configMap[cubeName][memberType].find(m => m.name === memberWithoutGranularity);
        if (!config) {
            return undefined;
        }
        return [member, {
                title: config.title,
                shortTitle: config.shortTitle,
                description: config.description,
                type: config.type,
                format: config.format,
                meta: config.meta,
                ...(memberType === 'measures' ? {
                    drillMembers: config.drillMembers,
                    drillMembersGrouped: config.drillMembersGrouped
                } : {})
            }];
    };
    const dimensions = (query.dimensions || []);
    return {
        measures: ramda_1.default.fromPairs((query.measures || []).map(annotation('measures')).filter(a => !!a)),
        dimensions: ramda_1.default.fromPairs(dimensions.map(annotation('dimensions')).filter(a => !!a)),
        segments: ramda_1.default.fromPairs((query.segments || []).map(annotation('segments')).filter(a => !!a)),
        timeDimensions: ramda_1.default.fromPairs(ramda_1.default.unnest((query.timeDimensions || [])
            .filter(td => !!td.granularity)
            .map(td => [annotation('dimensions')(`${td.dimension}.${td.granularity}`)].concat(
        // TODO: deprecated: backward compatibility for referencing time dimensions without granularity
        dimensions.indexOf(td.dimension) === -1 ? [annotation('dimensions')(td.dimension)] : []).filter(a => !!a)))),
    };
};
const transformValue = (value, type) => {
    if (value && (type === 'time' || value instanceof Date)) { // TODO support for max time
        return (value instanceof Date ? moment_1.default(value) : moment_1.default.utc(value)).format(moment_1.default.HTML5_FMT.DATETIME_LOCAL_MS);
    }
    return value && value.value ? value.value : value; // TODO move to sql adapter
};
const transformData = (aliasToMemberNameMap, annotation, data, query, queryType) => (data.map(r => {
    const row = ramda_1.default.pipe(
    // @ts-ignore
    ramda_1.default.toPairs, ramda_1.default.map(p => {
        const memberName = aliasToMemberNameMap[p[0]];
        const annotationForMember = annotation[memberName];
        if (!annotationForMember) {
            throw new UserError_1.UserError(`You requested hidden member: '${p[0]}'. Please make it visible using \`shown: true\`. Please note primaryKey fields are \`shown: false\` by default: https://cube.dev/docs/joins#setting-a-primary-key.`);
        }
        const transformResult = [
            memberName,
            transformValue(p[1], annotationForMember.type)
        ];
        const path = memberName.split('.');
        // TODO: deprecated: backward compatibility for referencing time dimensions without granularity
        const memberNameWithoutGranularity = [path[0], path[1]].join('.');
        if (path.length === 3 && (query.dimensions || []).indexOf(memberNameWithoutGranularity) === -1) {
            return [
                transformResult,
                [
                    memberNameWithoutGranularity,
                    transformResult[1]
                ]
            ];
        }
        return [transformResult];
    }), 
    // @ts-ignore
    ramda_1.default.unnest, ramda_1.default.fromPairs
    // @ts-ignore
    )(r);
    // @ts-ignore
    const [{ dimension, granularity, dateRange } = {}] = query.timeDimensions;
    if (queryType === query_1.QUERY_TYPE.COMPARE_DATE_RANGE_QUERY) {
        return {
            ...row,
            compareDateRange: dateRange.join(' - ')
        };
    }
    else if (queryType === query_1.QUERY_TYPE.BLENDING_QUERY) {
        return {
            ...row,
            [['time', granularity].join('.')]: row[[dimension, granularity].join('.')]
        };
    }
    return row;
}));
class ApiGateway {
    constructor(apiSecret, compilerApi, adapterApi, logger, options) {
        this.apiSecret = apiSecret;
        this.compilerApi = compilerApi;
        this.adapterApi = adapterApi;
        this.logger = logger;
        this.releaseListeners = [];
        this.handleErrorMiddleware = async (e, req, res, next) => {
            this.handleError({
                e,
                context: req.context,
                res: this.resToResultFn(res),
                requestStarted: new Date(),
            });
            next(e);
        };
        this.checkAuth = async (req, res, next) => {
            await this.checkAuthWrapper(this.checkAuthFn, req, res, next);
        };
        this.checkAuthSystemMiddleware = async (req, res, next) => {
            await this.checkAuthWrapper(this.checkAuthSystemFn, req, res, next);
        };
        this.requestContextMiddleware = async (req, res, next) => {
            req.context = await this.contextByReq(req, req.securityContext, requestParser_1.getRequestIdFromRequest(req));
            if (next) {
                next();
            }
        };
        this.requestLogger = async (req, res, next) => {
            const details = requestParser_1.requestParser(req, res);
            this.log({ type: 'REST API Request', ...details }, req.context);
            if (next) {
                next();
            }
        };
        this.createSystemContextHandler = (basePath) => {
            const body = {
                basePath,
            };
            return (req, res) => {
                res.status(200).json(body);
            };
        };
        this.readiness = async (req, res) => {
            let health = 'HEALTH';
            if (this.standalone) {
                const orchestratorApi = await this.adapterApi({});
                try {
                    // todo: test other data sources
                    orchestratorApi.addDataSeenSource('default');
                    await orchestratorApi.testConnection();
                }
                catch (e) {
                    this.log({
                        type: 'Internal Server Error on readiness probe',
                        error: e.stack || e.toString(),
                    });
                    return this.healthResponse(res, 'DOWN');
                }
                try {
                    await orchestratorApi.testOrchestratorConnections();
                }
                catch (e) {
                    this.log({
                        type: 'Internal Server Error on readiness probe',
                        error: e.stack || e.toString(),
                    });
                    health = 'DOWN';
                }
            }
            return this.healthResponse(res, health);
        };
        this.liveness = async (req, res) => {
            let health = 'HEALTH';
            try {
                await this.dataSourceStorage.testConnections();
            }
            catch (e) {
                this.log({
                    type: 'Internal Server Error on liveness probe',
                    error: e.stack || e.toString(),
                });
                return this.healthResponse(res, 'DOWN');
            }
            try {
                // @todo Optimize this moment?
                await this.dataSourceStorage.testOrchestratorConnections();
            }
            catch (e) {
                this.log({
                    type: 'Internal Server Error on liveness probe',
                    error: e.stack || e.toString(),
                });
                health = 'DOWN';
            }
            return this.healthResponse(res, health);
        };
        this.dataSourceStorage = options.dataSourceStorage;
        this.refreshScheduler = options.refreshScheduler;
        this.scheduledRefreshContexts = options.scheduledRefreshContexts;
        this.scheduledRefreshTimeZones = options.scheduledRefreshTimeZones;
        this.standalone = options.standalone;
        this.basePath = options.basePath;
        this.playgroundAuthSecret = options.playgroundAuthSecret;
        this.queryTransformer = options.queryTransformer || (async (query) => query);
        this.subscriptionStore = options.subscriptionStore || new LocalSubscriptionStore_1.LocalSubscriptionStore();
        this.enforceSecurityChecks = options.enforceSecurityChecks || (process.env.NODE_ENV === 'production');
        this.extendContext = options.extendContext;
        this.checkAuthFn = this.createCheckAuthFn(options);
        this.checkAuthSystemFn = this.createCheckAuthSystemFn();
        this.checkAuthMiddleware = options.checkAuthMiddleware
            ? this.wrapCheckAuthMiddleware(options.checkAuthMiddleware)
            : this.checkAuth;
        this.securityContextExtractor = this.createSecurityContextExtractor(options.jwt);
        this.requestLoggerMiddleware = options.requestLoggerMiddleware || this.requestLogger;
    }
    initApp(app) {
        const userMiddlewares = [
            this.checkAuthMiddleware,
            this.requestContextMiddleware,
            this.requestLoggerMiddleware
        ];
        // @todo Should we pass requestLoggerMiddleware?
        const guestMiddlewares = [];
        app.get(`${this.basePath}/tiva/load`, userMiddlewares, (async (req, res) => {
            await this.load({
                query: req.query.query,
                context: req.context,
                res: this.resToResultFn(res),
                queryType: req.query.queryType
            });
        }));
        const jsonParser = body_parser_1.default.json({ limit: '1mb' });
        app.post(`${this.basePath}/tiva/load`, jsonParser, userMiddlewares, (async (req, res) => {
            await this.load({
                query: req.body.query,
                context: req.context,
                res: this.resToResultFn(res),
                queryType: req.body.queryType
            });
        }));
        app.get(`${this.basePath}/tiva/subscribe`, userMiddlewares, (async (req, res) => {
            await this.load({
                query: req.query.query,
                context: req.context,
                res: this.resToResultFn(res),
                queryType: req.query.queryType
            });
        }));
        app.get(`${this.basePath}/tiva/sql`, userMiddlewares, (async (req, res) => {
            await this.sql({
                query: req.query.query,
                context: req.context,
                res: this.resToResultFn(res)
            });
        }));
        app.get(`${this.basePath}/tiva/meta`, userMiddlewares, (async (req, res) => {
            await this.meta({
                context: req.context,
                res: this.resToResultFn(res)
            });
        }));
        app.get(`${this.basePath}/tiva/run-scheduled-refresh`, userMiddlewares, (async (req, res) => {
            await this.runScheduledRefresh({
                queryingOptions: req.query.queryingOptions,
                context: req.context,
                res: this.resToResultFn(res)
            });
        }));
        app.get(`${this.basePath}/tiva/dry-run`, userMiddlewares, (async (req, res) => {
            await this.dryRun({
                query: req.query.query,
                context: req.context,
                res: this.resToResultFn(res)
            });
        }));
        app.post(`${this.basePath}/tiva/dry-run`, jsonParser, userMiddlewares, (async (req, res) => {
            await this.dryRun({
                query: req.body.query,
                context: req.context,
                res: this.resToResultFn(res)
            });
        }));
        if (this.playgroundAuthSecret) {
            const systemMiddlewares = [
                this.checkAuthSystemMiddleware,
                this.requestContextMiddleware,
                this.requestLoggerMiddleware
            ];
            app.get('/cubejs-system/tiva/context', systemMiddlewares, this.createSystemContextHandler(this.basePath));
            app.get('/cubejs-system/tiva/pre-aggregations', systemMiddlewares, (async (req, res) => {
                await this.getPreAggregations({
                    context: req.context,
                    res: this.resToResultFn(res)
                });
            }));
            app.get('/cubejs-system/tiva/pre-aggregations/security-contexts', systemMiddlewares, (async (req, res) => {
                const contexts = this.scheduledRefreshContexts ? await this.scheduledRefreshContexts() : [];
                this.resToResultFn(res)({
                    securityContexts: contexts
                        .filter(c => c && c.securityContext)
                        .map(context => context.securityContext)
                });
            }));
            app.get('/cubejs-system/tiva/pre-aggregations/timezones', systemMiddlewares, (async (req, res) => {
                this.resToResultFn(res)({
                    timezones: this.scheduledRefreshTimeZones || []
                });
            }));
            app.post('/cubejs-system/tiva/pre-aggregations/partitions', jsonParser, systemMiddlewares, (async (req, res) => {
                await this.getPreAggregationPartitions({
                    query: req.body.query,
                    context: req.context,
                    res: this.resToResultFn(res)
                });
            }));
        }
        app.get('/readyz', guestMiddlewares, cached_handler_1.cachedHandler(this.readiness));
        app.get('/livez', guestMiddlewares, cached_handler_1.cachedHandler(this.liveness));
        app.use(this.handleErrorMiddleware);
    }
    initSubscriptionServer(sendMessage) {
        return new SubscriptionServer_1.SubscriptionServer(this, sendMessage, this.subscriptionStore);
    }
    duration(requestStarted) {
        return requestStarted && (new Date().getTime() - requestStarted.getTime());
    }
    async runScheduledRefresh({ context, res, queryingOptions }) {
        const requestStarted = new Date();
        try {
            const refreshScheduler = this.refreshScheduler();
            res(await refreshScheduler.runScheduledRefresh(context, {
                ...this.parseQueryParam(queryingOptions || {}),
                throwErrors: true
            }));
        }
        catch (e) {
            this.handleError({
                e, context, res, requestStarted
            });
        }
    }
    async meta({ context, res }) {
        const requestStarted = new Date();
        try {
            const metaConfig = await this.getCompilerApi(context).metaConfig({ requestId: context.requestId });
            const cubes = metaConfig.map(c => c.config);
            res({ cubes });
        }
        catch (e) {
            this.handleError({
                e, context, res, requestStarted
            });
        }
    }
    async getPreAggregations({ context, res }) {
        const requestStarted = new Date();
        try {
            const preAggregations = await this.getCompilerApi(context).preAggregations();
            res({ preAggregations });
        }
        catch (e) {
            this.handleError({
                e, context, res, requestStarted
            });
        }
    }
    async getPreAggregationPartitions({ query, context, res }) {
        const requestStarted = new Date();
        try {
            query = query_1.normalizeQueryPreAggregations(this.parseQueryParam(query), { timezones: this.scheduledRefreshTimeZones });
            const orchestratorApi = this.getAdapterApi(context);
            const compilerApi = this.getCompilerApi(context);
            const preAggregationPartitions = await this.refreshScheduler()
                .preAggregationPartitions(context, compilerApi, query);
            const preAggregationVersionEntries = preAggregationPartitions &&
                await orchestratorApi.getPreAggregationVersionEntries(context, preAggregationPartitions, compilerApi.preAggregationsSchema);
            const mergePartitionsAndVersionEntries = () => {
                const preAggregationVersionEntriesByName = preAggregationVersionEntries.reduce((obj, versionEntry) => {
                    if (!obj[versionEntry.table_name])
                        obj[versionEntry.table_name] = [];
                    obj[versionEntry.table_name].push(versionEntry);
                    return obj;
                }, {});
                return ({ preAggregation, partitions, ...props }) => ({
                    ...props,
                    preAggregation,
                    partitions: partitions.map(partition => {
                        partition.versionEntries = preAggregationVersionEntriesByName[partition.sql.tableName];
                        return partition;
                    }),
                });
            };
            res({
                preAggregationPartitions: preAggregationPartitions.map(mergePartitionsAndVersionEntries())
            });
        }
        catch (e) {
            this.handleError({
                e, context, res, requestStarted
            });
        }
    }
    async getNormalizedQueries(query, context) {
        query = this.parseQueryParam(query);
        let queryType = query_1.QUERY_TYPE.REGULAR_QUERY;
        if (!Array.isArray(query)) {
            query = this.compareDateRangeTransformer(query);
            if (Array.isArray(query)) {
                queryType = query_1.QUERY_TYPE.COMPARE_DATE_RANGE_QUERY;
            }
        }
        else {
            queryType = query_1.QUERY_TYPE.BLENDING_QUERY;
        }
        const queries = Array.isArray(query) ? query : [query];
        const normalizedQueries = await Promise.all(queries.map((currentQuery) => this.queryTransformer(query_1.normalizeQuery(currentQuery), context)));
        if (normalizedQueries.find((currentQuery) => !currentQuery)) {
            throw new Error('queryTransformer returned null query. Please check your queryTransformer implementation');
        }
        if (queryType === query_1.QUERY_TYPE.BLENDING_QUERY) {
            const queryGranularity = query_1.getQueryGranularity(normalizedQueries);
            if (queryGranularity.length > 1) {
                throw new UserError_1.UserError('Data blending query granularities must match');
            }
            if (queryGranularity.filter(Boolean).length === 0) {
                throw new UserError_1.UserError('Data blending query without granularity is not supported');
            }
        }
        return [queryType, normalizedQueries];
    }
    async sql({ query, context, res }) {
        const requestStarted = new Date();
        try {
            query = this.parseQueryParam(query);
            const [queryType, normalizedQueries] = await this.getNormalizedQueries(query, context);
            const sqlQueries = await Promise.all(normalizedQueries.map((normalizedQuery) => this.getCompilerApi(context).getSql(this.coerceForSqlQuery(normalizedQuery, context), { includeDebugInfo: shared_1.getEnv('devMode') || context.signedWithPlaygroundAuthSecret })));
            const toQuery = (sqlQuery) => ({
                ...sqlQuery,
                order: ramda_1.default.fromPairs(sqlQuery.order.map(({ id: key, desc }) => [key, desc ? 'desc' : 'asc']))
            });
            res(queryType === query_1.QUERY_TYPE.REGULAR_QUERY ?
                { sql: toQuery(sqlQueries[0]) } :
                sqlQueries.map((sqlQuery) => ({ sql: toQuery(sqlQuery) })));
        }
        catch (e) {
            this.handleError({
                e, context, query, res, requestStarted
            });
        }
    }
    createSecurityContextExtractor(options) {
        if (options === null || options === void 0 ? void 0 : options.claimsNamespace) {
            return (ctx) => {
                if (typeof ctx.securityContext === 'object' && ctx.securityContext !== null) {
                    if (options.claimsNamespace in ctx.securityContext) {
                        return ctx.securityContext[options.claimsNamespace];
                    }
                }
                return {};
            };
        }
        let checkAuthDeprecationShown = false;
        return (ctx) => {
            let securityContext = {};
            if (typeof ctx.securityContext === 'object' && ctx.securityContext !== null) {
                if (ctx.securityContext.u) {
                    if (!checkAuthDeprecationShown) {
                        this.logger('JWT U Property Deprecation', {
                            warning: ('Storing security context in the u property within the payload is now deprecated, please migrate: ' +
                                'https://github.com/cube-js/cube.js/blob/master/DEPRECATION.md#authinfo')
                        });
                        checkAuthDeprecationShown = true;
                    }
                    securityContext = {
                        ...ctx.securityContext,
                        ...ctx.securityContext.u,
                    };
                    delete securityContext.u;
                }
                else {
                    securityContext = ctx.securityContext;
                }
            }
            return securityContext;
        };
    }
    coerceForSqlQuery(query, context) {
        return {
            ...query,
            timeDimensions: query.timeDimensions || [],
            contextSymbols: {
                securityContext: this.securityContextExtractor(context),
            },
            requestId: context.requestId
        };
    }
    async dryRun({ query, context, res }) {
        const requestStarted = new Date();
        try {
            const [queryType, normalizedQueries] = await this.getNormalizedQueries(query, context);
            const sqlQueries = await Promise.all(normalizedQueries.map((normalizedQuery) => this.getCompilerApi(context).getSql(this.coerceForSqlQuery(normalizedQuery, context), { includeDebugInfo: shared_1.getEnv('devMode') || context.signedWithPlaygroundAuthSecret })));
            res({
                queryType,
                normalizedQueries,
                queryOrder: sqlQueries.map((sqlQuery) => ramda_1.default.fromPairs(sqlQuery.order.map(({ id: member, desc }) => [member, desc ? 'desc' : 'asc']))),
                pivotQuery: query_1.getPivotQuery(queryType, normalizedQueries)
            });
        }
        catch (e) {
            this.handleError({
                e, context, query, res, requestStarted
            });
        }
    }
    async load({ query, context, res, ...props }) {
        const requestStarted = new Date();
        try {
            query = this.parseQueryParam(query);
            this.log({
                type: 'Load Request',
                query
            }, context);
            const metaConfigResult = await this.getCompilerApi(context).metaConfig({ requestId: context.requestId });
            fixMeasures_js_1.fixMeasures(query, metaConfigResult);
            const [queryType, normalizedQueries] = await this.getNormalizedQueries(query, context);
            const [_, ...sqlQueries] = await Promise.all([
                this.getCompilerApi(context).metaConfig({ requestId: context.requestId })
            ].concat(normalizedQueries.map(async (normalizedQuery, index) => {
                const loadRequestSQLStarted = new Date();
                const sqlQuery = await this.getCompilerApi(context).getSql(this.coerceForSqlQuery(normalizedQuery, context));
                this.log({
                    type: 'Load Request SQL',
                    duration: this.duration(loadRequestSQLStarted),
                    query: normalizedQueries[index],
                    sqlQuery
                }, context);
                return sqlQuery;
            })));
            let slowQuery = false;
            const results = await Promise.all(normalizedQueries.map(async (normalizedQuery, index) => {
                var _a;
                const sqlQuery = sqlQueries[index];
                const annotation = prepareAnnotation(metaConfigResult, normalizedQuery);
                const aliasToMemberNameMap = sqlQuery.aliasNameToMember;
                const toExecute = {
                    ...sqlQuery,
                    query: sqlQuery.sql[0],
                    values: sqlQuery.sql[1],
                    continueWait: true,
                    renewQuery: normalizedQuery.renewQuery,
                    requestId: context.requestId,
                    context
                };
                const response = await this.getAdapterApi(context).executeQuery(toExecute);
                const flattenAnnotation = {
                    ...annotation.measures,
                    ...annotation.dimensions,
                    ...annotation.timeDimensions
                };
                slowQuery = slowQuery || Boolean(response.slowQuery);
                return {
                    query: normalizedQuery,
                    data: transformData(aliasToMemberNameMap, flattenAnnotation, response.data, normalizedQuery, queryType),
                    lastRefreshTime: (_a = response.lastRefreshTime) === null || _a === void 0 ? void 0 : _a.toISOString(),
                    ...(shared_1.getEnv('devMode') || context.signedWithPlaygroundAuthSecret ? {
                        refreshKeyValues: response.refreshKeyValues,
                        usedPreAggregations: response.usedPreAggregations,
                        transformedQuery: sqlQuery.canUseTransformedQuery,
                    } : null),
                    annotation,
                    dataSource: response.dataSource,
                    dbType: response.dbType,
                    extDbType: response.extDbType,
                    external: response.external,
                    slowQuery: Boolean(response.slowQuery)
                };
            }));
            this.log({
                type: 'Load Request Success',
                query,
                duration: this.duration(requestStarted)
            }, context);
            if (queryType !== query_1.QUERY_TYPE.REGULAR_QUERY && props.queryType == null) {
                throw new UserError_1.UserError(`'${queryType}' query type is not supported by the client. Please update the client.`);
            }
            if (props.queryType === 'multi') {
                res({
                    queryType,
                    results,
                    pivotQuery: query_1.getPivotQuery(queryType, normalizedQueries),
                    slowQuery
                });
            }
            else {
                res(results[0]);
            }
        }
        catch (e) {
            this.handleError({
                e, context, query, res, requestStarted
            });
        }
    }
    async subscribe({ query, context, res, subscribe, subscriptionState, queryType }) {
        const requestStarted = new Date();
        try {
            this.log({
                type: 'Subscribe',
                query
            }, context);
            let result = null;
            let error = null;
            if (!subscribe) {
                await this.load({ query, context, res, queryType });
                return;
            }
            // TODO subscribe to refreshKeys instead of constantly firing load
            await this.load({
                query,
                context,
                res: (message, opts) => {
                    if (message.error) {
                        error = { message, opts };
                    }
                    else {
                        result = { message, opts };
                    }
                },
                queryType
            });
            const state = await subscriptionState();
            if (result && (!state || JSON.stringify(state.result) !== JSON.stringify(result))) {
                res(result.message, result.opts);
            }
            else if (error) {
                res(error.message, error.opts);
            }
            await subscribe({ error, result });
        }
        catch (e) {
            this.handleError({
                e, context, query, res, requestStarted
            });
        }
    }
    resToResultFn(res) {
        // @ts-ignore
        return (message, { status } = {}) => (status ? res.status(status).json(message) : res.json(message));
    }
    parseQueryParam(query) {
        if (!query || query === 'undefined') {
            throw new UserError_1.UserError('query param is required');
        }
        if (typeof query === 'string') {
            query = JSON.parse(query);
        }
        return query;
    }
    getCompilerApi(context) {
        if (typeof this.compilerApi === 'function') {
            return this.compilerApi(context);
        }
        return this.compilerApi;
    }
    getAdapterApi(context) {
        if (typeof this.adapterApi === 'function') {
            return this.adapterApi(context);
        }
        return this.adapterApi;
    }
    async contextByReq(req, securityContext, requestId) {
        const extensions = typeof this.extendContext === 'function' ? await this.extendContext(req) : {};
        return {
            securityContext,
            // Deprecated, but let's allow it for now.
            authInfo: securityContext,
            signedWithPlaygroundAuthSecret: Boolean(req.signedWithPlaygroundAuthSecret),
            requestId,
            ...extensions
        };
    }
    handleError({ e, context, query, res, requestStarted }) {
        if (e instanceof CubejsHandlerError_1.CubejsHandlerError) {
            this.log({
                type: e.type,
                query,
                error: e.message,
                duration: this.duration(requestStarted)
            }, context);
            res({ error: e.message }, { status: e.status });
        }
        else if (e.error === 'Continue wait') {
            this.log({
                type: 'Continue wait',
                query,
                error: e.message,
                duration: this.duration(requestStarted)
            }, context);
            res(e, { status: 200 });
        }
        else if (e.error) {
            this.log({
                type: 'Orchestrator error',
                query,
                error: e.error,
                duration: this.duration(requestStarted)
            }, context);
            res(e, { status: 400 });
        }
        else if (e.type === 'UserError') {
            this.log({
                type: e.type,
                query,
                error: e.message,
                duration: this.duration(requestStarted)
            }, context);
            res({
                type: e.type,
                error: e.message
            }, { status: 400 });
        }
        else {
            this.log({
                type: 'Internal Server Error',
                query,
                error: e.stack || e.toString(),
                duration: this.duration(requestStarted)
            }, context);
            res({ error: e.toString() }, { status: 500 });
        }
    }
    wrapCheckAuthMiddleware(fn) {
        this.logger('CheckAuthMiddleware Middleware Deprecation', {
            warning: ('Option checkAuthMiddleware is now deprecated in favor of checkAuth, please migrate: ' +
                'https://github.com/cube-js/cube.js/blob/master/DEPRECATION.md#checkauthmiddleware')
        });
        let showWarningAboutNotObject = false;
        return (req, res, next) => {
            fn(req, res, (e) => {
                // We renamed authInfo to securityContext, but users can continue to use both ways
                if (req.securityContext && !req.authInfo) {
                    req.authInfo = req.securityContext;
                }
                else if (req.authInfo) {
                    req.securityContext = req.authInfo;
                }
                if ((typeof req.securityContext !== 'object' || req.securityContext === null) && !showWarningAboutNotObject) {
                    this.logger('Security Context Should Be Object', {
                        warning: (`Value of securityContext (previously authInfo) expected to be object, actual: ${shared_1.getRealType(req.securityContext)}`)
                    });
                    showWarningAboutNotObject = true;
                }
                next(e);
            });
        };
    }
    wrapCheckAuth(fn) {
        // We dont need to span all logs with deprecation message
        let warningShowed = false;
        // securityContext should be object
        let showWarningAboutNotObject = false;
        return async (req, auth) => {
            await fn(req, auth);
            // We renamed authInfo to securityContext, but users can continue to use both ways
            if (req.securityContext && !req.authInfo) {
                req.authInfo = req.securityContext;
            }
            else if (req.authInfo) {
                if (!warningShowed) {
                    this.logger('AuthInfo Deprecation', {
                        warning: ('authInfo was renamed to securityContext, please migrate: ' +
                            'https://github.com/cube-js/cube.js/blob/master/DEPRECATION.md#checkauthmiddleware')
                    });
                    warningShowed = true;
                }
                req.securityContext = req.authInfo;
            }
            if ((typeof req.securityContext !== 'object' || req.securityContext === null) && !showWarningAboutNotObject) {
                this.logger('Security Context Should Be Object', {
                    warning: (`Value of securityContext (previously authInfo) expected to be object, actual: ${shared_1.getRealType(req.securityContext)}`)
                });
                showWarningAboutNotObject = true;
            }
        };
    }
    createDefaultCheckAuth(options, internalOptions) {
        const verifyToken = (auth, secret) => jsonwebtoken_1.default.verify(auth, secret, {
            algorithms: options === null || options === void 0 ? void 0 : options.algorithms,
            issuer: options === null || options === void 0 ? void 0 : options.issuer,
            audience: options === null || options === void 0 ? void 0 : options.audience,
            subject: options === null || options === void 0 ? void 0 : options.subject,
        });
        let checkAuthFn = verifyToken;
        if (options === null || options === void 0 ? void 0 : options.jwkUrl) {
            const jwks = jwk_1.createJWKsFetcher(options, {
                onBackgroundException: (e) => {
                    this.logger('JWKs Background Fetching Error', {
                        error: e.message,
                    });
                },
            });
            this.releaseListeners.push(jwks.release);
            // Precache JWKs response to speedup first auth
            if (options.jwkUrl && typeof options.jwkUrl === 'string') {
                jwks.fetchOnly(options.jwkUrl).catch((e) => this.logger('JWKs Prefetching Error', {
                    error: e.message,
                }));
            }
            checkAuthFn = async (auth) => {
                const decoded = jsonwebtoken_1.default.decode(auth, { complete: true });
                if (!decoded) {
                    throw new CubejsHandlerError_1.CubejsHandlerError(403, 'Forbidden', 'Unable to decode JWT key');
                }
                if (!decoded.header || !decoded.header.kid) {
                    throw new CubejsHandlerError_1.CubejsHandlerError(403, 'Forbidden', 'JWT without kid inside headers');
                }
                const jwk = await jwks.getJWKbyKid(typeof options.jwkUrl === 'function' ? options.jwkUrl(decoded) : options.jwkUrl, decoded.header.kid);
                if (!jwk) {
                    throw new CubejsHandlerError_1.CubejsHandlerError(403, 'Forbidden', `Unable to verify, JWK with kid: "${decoded.header.kid}" not found`);
                }
                return verifyToken(auth, jwk);
            };
        }
        const secret = (options === null || options === void 0 ? void 0 : options.key) || this.apiSecret;
        return async (req, auth) => {
            if (auth) {
                try {
                    req.securityContext = await checkAuthFn(auth, secret);
                    req.signedWithPlaygroundAuthSecret = Boolean(internalOptions === null || internalOptions === void 0 ? void 0 : internalOptions.isPlaygroundCheckAuth);
                }
                catch (e) {
                    if (this.enforceSecurityChecks) {
                        throw new CubejsHandlerError_1.CubejsHandlerError(403, 'Forbidden', 'Invalid token');
                    }
                    else {
                        this.log({
                            type: e.message,
                            token: auth,
                            error: e.stack || e.toString()
                        }, req);
                    }
                }
            }
            else if (this.enforceSecurityChecks) {
                // @todo Move it to 401 or 400
                throw new CubejsHandlerError_1.CubejsHandlerError(403, 'Forbidden', 'Authorization header isn\'t set');
            }
        };
    }
    createCheckAuthFn(options) {
        const mainCheckAuthFn = options.checkAuth
            ? this.wrapCheckAuth(options.checkAuth)
            : this.createDefaultCheckAuth(options.jwt);
        if (this.playgroundAuthSecret) {
            const systemCheckAuthFn = this.createCheckAuthSystemFn();
            return async (ctx, authorization) => {
                try {
                    await mainCheckAuthFn(ctx, authorization);
                }
                catch (error) {
                    await systemCheckAuthFn(ctx, authorization);
                }
            };
        }
        return (ctx, authorization) => mainCheckAuthFn(ctx, authorization);
    }
    createCheckAuthSystemFn() {
        const systemCheckAuthFn = this.createDefaultCheckAuth({
            key: this.playgroundAuthSecret,
            algorithms: ['HS256']
        }, { isPlaygroundCheckAuth: true });
        return async (ctx, authorization) => {
            await systemCheckAuthFn(ctx, authorization);
        };
    }
    extractAuthorizationHeaderWithSchema(req) {
        if (typeof req.headers.authorization === 'string') {
            const parts = req.headers.authorization.split(' ', 2);
            if (parts.length === 1) {
                return parts[0];
            }
            return parts[1];
        }
        return undefined;
    }
    async checkAuthWrapper(checkAuthFn, req, res, next) {
        const token = this.extractAuthorizationHeaderWithSchema(req);
        try {
            await checkAuthFn(req, token);
            if (next) {
                next();
            }
        }
        catch (e) {
            if (e instanceof CubejsHandlerError_1.CubejsHandlerError) {
                res.status(e.status).json({ error: e.message });
            }
            else {
                this.log({
                    type: 'Auth Error',
                    token,
                    error: e.stack || e.toString()
                }, req);
                res.status(500).json({ error: e.toString() });
            }
        }
    }
    compareDateRangeTransformer(query) {
        let queryCompareDateRange;
        let compareDateRangeTDIndex;
        (query.timeDimensions || []).forEach((td, index) => {
            if (td.compareDateRange != null) {
                if (queryCompareDateRange != null) {
                    throw new UserError_1.UserError('compareDateRange can only exist for one timeDimension');
                }
                queryCompareDateRange = td.compareDateRange;
                compareDateRangeTDIndex = index;
            }
        });
        if (queryCompareDateRange == null) {
            return query;
        }
        return queryCompareDateRange.map((dateRange) => ({
            ...ramda_1.default.clone(query),
            timeDimensions: query.timeDimensions.map((td, index) => {
                if (compareDateRangeTDIndex === index) {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { compareDateRange, ...timeDimension } = td;
                    return {
                        ...timeDimension,
                        dateRange
                    };
                }
                return td;
            })
        }));
    }
    log(event, context) {
        const { type, ...restParams } = event;
        this.logger(type, {
            ...restParams,
            ...(!context ? undefined : {
                securityContext: context.securityContext,
                requestId: context.requestId
            })
        });
    }
    healthResponse(res, health) {
        res.status(health === 'HEALTH' ? 200 : 500).json({
            health,
        });
    }
    release() {
        for (const releaseListener of this.releaseListeners) {
            releaseListener();
        }
    }
}
exports.ApiGateway = ApiGateway;
//# sourceMappingURL=gateway.js.map