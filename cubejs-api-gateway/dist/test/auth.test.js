"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const supertest_1 = __importDefault(require("supertest"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const shared_1 = require("@cubejs-backend/shared");
const src_1 = require("../src");
const mocks_1 = require("./mocks");
const utils_1 = require("./utils");
function createApiGateway(handler, logger, options) {
    const adapterApi = new mocks_1.AdapterApiMock();
    const dataSourceStorage = new mocks_1.DataSourceStorageMock();
    class ApiGatewayFake extends src_1.ApiGateway {
        coerceForSqlQuery(query, context) {
            return super.coerceForSqlQuery(query, context);
        }
        initApp(app) {
            const userMiddlewares = [
                this.checkAuthMiddleware,
                this.requestContextMiddleware,
            ];
            app.get('/test-auth-fake', userMiddlewares, handler);
            app.use(this.handleErrorMiddleware);
        }
    }
    const apiGateway = new ApiGatewayFake('secret', null, () => adapterApi, logger, {
        standalone: true,
        dataSourceStorage,
        basePath: '/cubejs-api',
        refreshScheduler: {},
        enforceSecurityChecks: true,
        ...options,
    });
    process.env.NODE_ENV = 'unknown';
    const app = express_1.default();
    apiGateway.initApp(app);
    return {
        apiGateway,
        app,
    };
}
describe('test authorization', () => {
    test('default authorization', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const expectSecurityContext = (securityContext) => {
            expect(securityContext.uid).toEqual(5);
            expect(securityContext.iat).toBeDefined();
            expect(securityContext.exp).toBeDefined();
        };
        const handlerMock = jest.fn((req, res) => {
            expectSecurityContext(req.context.authInfo);
            expectSecurityContext(req.context.securityContext);
            res.status(200).end();
        });
        const { app } = createApiGateway(handlerMock, loggerMock, {});
        const token = utils_1.generateAuthToken({ uid: 5, });
        await supertest_1.default(app)
            .get('/test-auth-fake')
            .set('Authorization', `Authorization: ${token}`)
            .expect(200);
        // No bad logs
        expect(loggerMock.mock.calls.length).toEqual(0);
        expect(handlerMock.mock.calls.length).toEqual(1);
        expectSecurityContext(handlerMock.mock.calls[0][0].context.securityContext);
        // authInfo was deprecated, but should exists as computability
        expectSecurityContext(handlerMock.mock.calls[0][0].context.authInfo);
    });
    test('playground auth token', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const expectSecurityContext = (securityContext) => {
            expect(securityContext.uid).toEqual(5);
            expect(securityContext.iat).toBeDefined();
            expect(securityContext.exp).toBeDefined();
        };
        const handlerMock = jest.fn((req, res) => {
            expectSecurityContext(req.context.authInfo);
            expectSecurityContext(req.context.securityContext);
            res.status(200).end();
        });
        const playgroundAuthSecret = 'playgroundSecret';
        const { app } = createApiGateway(handlerMock, loggerMock, {
            playgroundAuthSecret
        });
        const token = utils_1.generateAuthToken({ uid: 5, }, {});
        const playgroundToken = utils_1.generateAuthToken({ uid: 5, }, {}, playgroundAuthSecret);
        const badToken = utils_1.generateAuthToken({ uid: 5, }, {}, 'bad');
        await supertest_1.default(app)
            .get('/test-auth-fake')
            .set('Authorization', `Authorization: ${token}`)
            .expect(200);
        await supertest_1.default(app)
            .get('/test-auth-fake')
            .set('Authorization', `Authorization: ${playgroundToken}`)
            .expect(200);
        await supertest_1.default(app)
            .get('/test-auth-fake')
            .set('Authorization', `Authorization: ${badToken}`)
            .expect(403);
        // No bad logs
        expect(loggerMock.mock.calls.length).toEqual(0);
        expect(handlerMock.mock.calls.length).toEqual(2);
        expectSecurityContext(handlerMock.mock.calls[0][0].context.securityContext);
        // authInfo was deprecated, but should exists as computability
        expectSecurityContext(handlerMock.mock.calls[0][0].context.authInfo);
    });
    test('default authorization with JWT token and securityContext in u', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const expectSecurityContext = (securityContext) => {
            expect(securityContext.u).toEqual({
                uid: 5,
            });
            expect(securityContext.iat).toBeDefined();
            expect(securityContext.exp).toBeDefined();
        };
        const handlerMock = jest.fn((req, res) => {
            expectSecurityContext(req.context.securityContext);
            expectSecurityContext(req.context.authInfo);
            res.status(200).end();
        });
        const { app } = createApiGateway(handlerMock, loggerMock, {});
        const token = utils_1.generateAuthToken({ u: { uid: 5, } });
        await supertest_1.default(app)
            .get('/test-auth-fake')
            .set('Authorization', `Authorization: ${token}`)
            .expect(200);
        expect(loggerMock.mock.calls.length).toEqual(0);
        expect(handlerMock.mock.calls.length).toEqual(1);
    });
    test('custom checkAuth with async flow', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const expectSecurityContext = (securityContext) => {
            expect(securityContext.uid).toEqual(5);
            expect(securityContext.iat).toBeDefined();
            expect(securityContext.exp).toBeDefined();
        };
        const handlerMock = jest.fn((req, res) => {
            expectSecurityContext(req.context.securityContext);
            expectSecurityContext(req.context.authInfo);
            res.status(200).end();
        });
        const { app } = createApiGateway(handlerMock, loggerMock, {
            checkAuth: async (req, auth) => {
                if (auth) {
                    await shared_1.pausePromise(500);
                    req.authInfo = jsonwebtoken_1.default.verify(auth, 'secret');
                }
            }
        });
        const token = utils_1.generateAuthToken({ uid: 5, });
        await supertest_1.default(app)
            .get('/test-auth-fake')
            .set('Authorization', `Authorization: ${token}`)
            .expect(200);
        expect(loggerMock.mock.calls.length).toEqual(1);
        expect(loggerMock.mock.calls[0]).toEqual([
            'AuthInfo Deprecation',
            {
                warning: 'authInfo was renamed to securityContext, please migrate: https://github.com/cube-js/cube.js/blob/master/DEPRECATION.md#checkauthmiddleware',
            }
        ]);
        expect(handlerMock.mock.calls.length).toEqual(1);
        expectSecurityContext(handlerMock.mock.calls[0][0].context.securityContext);
        // authInfo was deprecated, but should exists as computability
        expectSecurityContext(handlerMock.mock.calls[0][0].context.authInfo);
    });
    test('custom checkAuth with async flow and throw exception', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const handlerMock = jest.fn((req, res) => {
            res.status(200).end();
        });
        const { app } = createApiGateway(handlerMock, loggerMock, {
            checkAuth: async () => {
                throw new src_1.CubejsHandlerError(555, 'unknown', 'unknown message');
            }
        });
        const token = utils_1.generateAuthToken({ uid: 5, });
        const res = await supertest_1.default(app)
            .get('/test-auth-fake')
            .set('Authorization', `Authorization: ${token}`)
            .expect(555);
        expect(res.body).toMatchObject({
            error: 'unknown message'
        });
    });
    test('custom checkAuth with deprecated authInfo', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const EXPECTED_SECURITY_CONTEXT = {
            exp: 2475857705, iat: 1611857705, uid: 5
        };
        const handlerMock = jest.fn((req, res) => {
            expect(req.context.securityContext).toEqual(EXPECTED_SECURITY_CONTEXT);
            expect(req.context.authInfo).toEqual(EXPECTED_SECURITY_CONTEXT);
            res.status(200).end();
        });
        const { app } = createApiGateway(handlerMock, loggerMock, {
            checkAuth: (req, auth) => {
                if (auth) {
                    req.authInfo = jsonwebtoken_1.default.verify(auth, 'secret');
                }
            }
        });
        await supertest_1.default(app)
            .get('/test-auth-fake')
            // console.log(generateAuthToken({ uid: 5, }));
            .set('Authorization', 'Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjUsImlhdCI6MTYxMTg1NzcwNSwiZXhwIjoyNDc1ODU3NzA1fQ.tTieqdIcxDLG8fHv8YWwfvg_rPVe1XpZKUvrCdzVn3g')
            .expect(200);
        expect(loggerMock.mock.calls.length).toEqual(1);
        expect(loggerMock.mock.calls[0]).toEqual([
            'AuthInfo Deprecation',
            {
                warning: 'authInfo was renamed to securityContext, please migrate: https://github.com/cube-js/cube.js/blob/master/DEPRECATION.md#checkauthmiddleware',
            }
        ]);
        expect(handlerMock.mock.calls.length).toEqual(1);
        expect(handlerMock.mock.calls[0][0].context.securityContext).toEqual(EXPECTED_SECURITY_CONTEXT);
        // authInfo was deprecated, but should exists as computability
        expect(handlerMock.mock.calls[0][0].context.authInfo).toEqual(EXPECTED_SECURITY_CONTEXT);
    });
    test('custom checkAuth with securityContext (not object)', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const EXPECTED_SECURITY_CONTEXT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjUsImlhdCI6MTYxMTg1NzcwNSwiZXhwIjoyNDc1ODU3NzA1fQ.tTieqdIcxDLG8fHv8YWwfvg_rPVe1XpZKUvrCdzVn3g';
        const handlerMock = jest.fn((req, res) => {
            expect(req.context.securityContext).toEqual(EXPECTED_SECURITY_CONTEXT);
            expect(req.context.authInfo).toEqual(EXPECTED_SECURITY_CONTEXT);
            res.status(200).end();
        });
        const { app } = createApiGateway(handlerMock, loggerMock, {
            checkAuth: (req, auth) => {
                if (auth) {
                    // It must be object, but some users are using string for securityContext
                    req.securityContext = auth;
                }
            }
        });
        await supertest_1.default(app)
            .get('/test-auth-fake')
            // console.log(generateAuthToken({ uid: 5, }));
            .set('Authorization', 'Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjUsImlhdCI6MTYxMTg1NzcwNSwiZXhwIjoyNDc1ODU3NzA1fQ.tTieqdIcxDLG8fHv8YWwfvg_rPVe1XpZKUvrCdzVn3g')
            .expect(200);
        expect(loggerMock.mock.calls.length).toEqual(1);
        expect(loggerMock.mock.calls[0]).toEqual([
            'Security Context Should Be Object',
            {
                warning: 'Value of securityContext (previously authInfo) expected to be object, actual: string',
            }
        ]);
        expect(handlerMock.mock.calls.length).toEqual(1);
        expect(handlerMock.mock.calls[0][0].context.securityContext).toEqual(EXPECTED_SECURITY_CONTEXT);
        // authInfo was deprecated, but should exists as computability
        expect(handlerMock.mock.calls[0][0].context.authInfo).toEqual(EXPECTED_SECURITY_CONTEXT);
    });
    test('custom checkAuthMiddleware with deprecated authInfo', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const expectSecurityContext = (securityContext) => {
            expect(securityContext.uid).toEqual(5);
            expect(securityContext.iat).toBeDefined();
            expect(securityContext.exp).toBeDefined();
        };
        const handlerMock = jest.fn((req, res) => {
            expectSecurityContext(req.context.securityContext);
            expectSecurityContext(req.context.authInfo);
            res.status(200).end();
        });
        const { app } = createApiGateway(handlerMock, loggerMock, {
            checkAuthMiddleware: (req, res, next) => {
                try {
                    if (req.headers.authorization) {
                        req.authInfo = jsonwebtoken_1.default.verify(req.headers.authorization, 'secret');
                    }
                    next();
                }
                catch (e) {
                    next(e);
                }
            }
        });
        const token = utils_1.generateAuthToken({ uid: 5, });
        await supertest_1.default(app)
            .get('/test-auth-fake')
            .set('Authorization', token)
            .expect(200);
        expect(loggerMock.mock.calls.length).toEqual(1);
        expect(loggerMock.mock.calls[0]).toEqual([
            'CheckAuthMiddleware Middleware Deprecation',
            {
                warning: 'Option checkAuthMiddleware is now deprecated in favor of checkAuth, please migrate: https://github.com/cube-js/cube.js/blob/master/DEPRECATION.md#checkauthmiddleware',
            }
        ]);
        expect(handlerMock.mock.calls.length).toEqual(1);
        expectSecurityContext(handlerMock.mock.calls[0][0].context.securityContext);
        // authInfo was deprecated, but should exists as computability
        expectSecurityContext(handlerMock.mock.calls[0][0].context.authInfo);
    });
    test('custom checkAuthMiddleware with securityInfo (not object)', async () => {
        const loggerMock = jest.fn();
        const EXPECTED_SECURITY_CONTEXT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjUsImlhdCI6MTYxMTg1NzcwNSwiZXhwIjoyNDc1ODU3NzA1fQ.tTieqdIcxDLG8fHv8YWwfvg_rPVe1XpZKUvrCdzVn3g';
        const handlerMock = jest.fn((req, res) => {
            expect(req.context.securityContext).toEqual(EXPECTED_SECURITY_CONTEXT);
            expect(req.context.authInfo).toEqual(EXPECTED_SECURITY_CONTEXT);
            res.status(200).end();
        });
        const { app } = createApiGateway(handlerMock, loggerMock, {
            checkAuthMiddleware: (req, res, next) => {
                if (req.headers.authorization) {
                    // It must be object, but some users are using string for securityContext
                    req.authInfo = req.headers.authorization;
                }
                if (next) {
                    next();
                }
            }
        });
        await supertest_1.default(app)
            .get('/test-auth-fake')
            // console.log(generateAuthToken({ uid: 5, }));
            .set('Authorization', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjUsImlhdCI6MTYxMTg1NzcwNSwiZXhwIjoyNDc1ODU3NzA1fQ.tTieqdIcxDLG8fHv8YWwfvg_rPVe1XpZKUvrCdzVn3g')
            .expect(200);
        expect(loggerMock.mock.calls.length).toEqual(2);
        expect(loggerMock.mock.calls[0]).toEqual([
            'CheckAuthMiddleware Middleware Deprecation',
            {
                warning: 'Option checkAuthMiddleware is now deprecated in favor of checkAuth, please migrate: https://github.com/cube-js/cube.js/blob/master/DEPRECATION.md#checkauthmiddleware',
            }
        ]);
        expect(loggerMock.mock.calls[1]).toEqual([
            'Security Context Should Be Object',
            {
                warning: 'Value of securityContext (previously authInfo) expected to be object, actual: string',
            }
        ]);
        expect(handlerMock.mock.calls.length).toEqual(1);
        expect(handlerMock.mock.calls[0][0].context.securityContext).toEqual(EXPECTED_SECURITY_CONTEXT);
        // authInfo was deprecated, but should exists as computability
        expect(handlerMock.mock.calls[0][0].context.authInfo).toEqual(EXPECTED_SECURITY_CONTEXT);
    });
    test('coerceForSqlQuery multiple', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const handlerMock = jest.fn();
        const { apiGateway } = createApiGateway(handlerMock, loggerMock, {});
        // handle null
        expect(apiGateway.coerceForSqlQuery({ timeDimensions: [] }, { securityContext: null, requestId: 'XXX' }).contextSymbols.securityContext).toEqual({});
        // no warnings, done on checkAuth/checkAuthMiddleware level
        expect(loggerMock.mock.calls.length).toEqual(0);
        // handle string
        expect(apiGateway.coerceForSqlQuery({ timeDimensions: [] }, { securityContext: 'AAABBBCCC', requestId: 'XXX' }).contextSymbols.securityContext).toEqual({});
        // no warnings, done on checkAuth/checkAuthMiddleware level
        expect(loggerMock.mock.calls.length).toEqual(0);
        /**
         * Original securityContext should not be changed by coerceForSqlQuery, because SubscriptionServer store it once
         * for all queries
         */
        const securityContext = { exp: 2475858836, iat: 1611858836, u: { uid: 5 } };
        // (move u to root)
        expect(apiGateway.coerceForSqlQuery({ timeDimensions: [] }, { securityContext, requestId: 'XXX' }).contextSymbols.securityContext).toEqual({
            exp: 2475858836,
            iat: 1611858836,
            uid: 5,
        });
        // (move u to root)
        expect(apiGateway.coerceForSqlQuery({ timeDimensions: [] }, { securityContext, requestId: 'XXX' }).contextSymbols.securityContext).toEqual({
            exp: 2475858836,
            iat: 1611858836,
            uid: 5,
        });
        expect(securityContext).toEqual({ exp: 2475858836, iat: 1611858836, u: { uid: 5 } });
        expect(loggerMock.mock.calls.length).toEqual(1);
        expect(loggerMock.mock.calls[0]).toEqual([
            'JWT U Property Deprecation',
            {
                warning: 'Storing security context in the u property within the payload is now deprecated, please migrate: https://github.com/cube-js/cube.js/blob/master/DEPRECATION.md#authinfo',
            }
        ]);
    });
    test('coerceForSqlQuery claimsNamespace', async () => {
        const loggerMock = jest.fn(() => {
            //
        });
        const handlerMock = jest.fn();
        const { apiGateway } = createApiGateway(handlerMock, loggerMock, {
            jwt: {
                claimsNamespace: 'http://localhost:4000'
            }
        });
        // handle null
        expect(apiGateway.coerceForSqlQuery({ timeDimensions: [] }, { securityContext: {}, requestId: 'XXX' }).contextSymbols.securityContext).toEqual({});
        // no warnings, done on checkAuth/checkAuthMiddleware level
        expect(loggerMock.mock.calls.length).toEqual(0);
        // handle ok
        expect(apiGateway.coerceForSqlQuery({ timeDimensions: [] }, { securityContext: { 'http://localhost:4000': { uid: 5 } }, requestId: 'XXX' }).contextSymbols.securityContext).toEqual({ uid: 5 });
        // no warnings, done on checkAuth/checkAuthMiddleware level
        expect(loggerMock.mock.calls.length).toEqual(0);
    });
});
//# sourceMappingURL=auth.test.js.map