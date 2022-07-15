"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJWKsFetcher = void 0;
/* eslint-disable no-restricted-syntax */
const crypto_1 = __importDefault(require("crypto"));
const shared_1 = require("@cubejs-backend/shared");
const node_fetch_1 = __importDefault(require("node-fetch"));
const jwk_to_pem_1 = __importDefault(require("jwk-to-pem"));
const HEADER_REGEXP = /([a-zA-Z][a-zA-Z_-]*)\s*(?:=(?:"([^"]*)"|([^ \t",;]*)))?/g;
const cacheControlMap = {
    public: ['public', () => true],
    'max-age': ['maxAge', (v) => v && parseInt(v, 10)],
    'stale-while-revalidate': ['staleWhileRevalidate', (v) => v && parseInt(v, 10)],
    'stale-if-error': ['staleIfError', (v) => v && parseInt(v, 10)],
};
function parseCacheControl(header) {
    const result = {
        maxAge: 0,
        public: false,
        staleWhileRevalidate: null,
        staleIfError: null,
    };
    const matches = header.match(HEADER_REGEXP) || [];
    for (const match of matches) {
        const tokens = match.split('=', 2);
        const [key] = tokens;
        let value = null;
        if (tokens.length > 1) {
            value = tokens[1].trim();
        }
        const parseParams = cacheControlMap[key.toLowerCase()];
        if (parseParams) {
            const [toKey, toValue] = parseParams;
            // @ts-ignore
            result[toKey] = toValue(value);
        }
    }
    return result;
}
const createJWKsFetcher = (jwtOptions, options) => {
    const fetchJwkUrl = shared_1.asyncMemoizeBackground(async (url) => {
        const response = await shared_1.asyncRetry(() => node_fetch_1.default(url), {
            times: jwtOptions.jwkRetry || 3,
        });
        const json = await response.json();
        if (!json.keys) {
            throw new Error('Unable to find keys inside response from JWK_URL');
        }
        const result = new Map();
        // eslint-disable-next-line no-restricted-syntax
        for (const jwk of json.keys) {
            if (!jwk.kid) {
                throw new Error('Unable to find kid inside JWK');
            }
            result.set(jwk.kid, jwk_to_pem_1.default(jwk));
        }
        let lifeTime = 0;
        const cacheControlHeader = response.headers.get('cache-control');
        if (cacheControlHeader) {
            const cacheControl = parseCacheControl(cacheControlHeader);
            lifeTime = cacheControl.maxAge * 1000;
        }
        return {
            doneDate: Date.now(),
            lifeTime,
            result,
        };
    }, {
        extractKey: (url) => crypto_1.default.createHash('md5').update(url).digest('hex'),
        extractCacheLifetime: ({ lifeTime }) => {
            if (lifeTime) {
                return lifeTime;
            }
            if (jwtOptions.jwkDefaultExpire) {
                return jwtOptions.jwkDefaultExpire * 1000;
            }
            return 5 * 60 * 1000;
        },
        // 1 minute is ok, if rotation will be done it will be refreshed by jwkRefetchWindow
        backgroundRefreshInterval: 60 * 1000,
        ...options,
    });
    const jwkRefetchWindow = jwtOptions.jwkRefetchWindow || 60 * 1000;
    return {
        // Fetch only, it's needed to speedup first auth
        fetchOnly: async (url) => fetchJwkUrl(url),
        /**
         * Fetch JWK from cache or load it from jwkUrl
         */
        getJWKbyKid: async (url, kid) => {
            const { result, doneDate } = await fetchJwkUrl(url);
            if (result.has(kid)) {
                return result.get(kid);
            }
            /**
             * If it's cached and We are not able to find JWK key by kid,
             * Let's re-fetch JWK keys from jwkUrl, because it can be keys rotation
             * But dont forget that it can be wrongly generated tokens and protect it by jwkRefetchWindow
             */
            if ((Date.now() - doneDate) > jwkRefetchWindow) {
                const newResults = await fetchJwkUrl.force(url);
                if (newResults.result.has(kid)) {
                    return newResults.result.get(kid);
                }
            }
            return null;
        },
        release: fetchJwkUrl.release,
    };
};
exports.createJWKsFetcher = createJWKsFetcher;
//# sourceMappingURL=jwk.js.map