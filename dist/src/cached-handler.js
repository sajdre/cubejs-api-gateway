"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachedHandler = exports.pipeFromCache = void 0;
function pipeFromCache(cache, res) {
    res.status(cache.status)
        .json(cache.json);
}
exports.pipeFromCache = pipeFromCache;
function cachedHandler(handler, options = { lifetime: 1000 }) {
    let lastCache = {
        status: 200,
        json: null,
    };
    let lastCacheExpr = new Date(Date.now() - options.lifetime);
    let lock = false;
    const queue = [];
    return async (req, res, next) => {
        if (lock) {
            queue.push(res);
        }
        else {
            if (lastCacheExpr.getTime() > new Date().getTime()) {
                pipeFromCache(lastCache, res);
                return;
            }
            lock = true;
            try {
                const responseWrapper = {
                    ...res,
                    status(code) {
                        res.status(code);
                        lastCache.status = code;
                        return responseWrapper;
                    },
                    json(json) {
                        res.json(json);
                        lastCache.json = json;
                        return responseWrapper;
                    }
                };
                await handler(req, responseWrapper, next);
                lastCacheExpr = new Date(Date.now() + options.lifetime);
                lock = false;
            }
            catch (e) {
                // console.log('cached-router exception', e);
                lock = false;
                lastCache = {
                    status: 200,
                    json: null,
                };
                lastCacheExpr = new Date(Date.now() - options.lifetime);
                next(e);
            }
            let queuedResponse;
            // eslint-disable-next-line no-cond-assign
            while (queuedResponse = queue.pop()) {
                pipeFromCache(lastCache, queuedResponse);
            }
        }
    };
}
exports.cachedHandler = cachedHandler;
//# sourceMappingURL=cached-handler.js.map