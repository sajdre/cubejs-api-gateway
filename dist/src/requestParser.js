"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestParser = exports.getRequestIdFromRequest = void 0;
const v4_1 = __importDefault(require("uuid/v4"));
function getRequestIdFromRequest(req) {
    return req.get('x-request-id') || req.get('traceparent') || v4_1.default();
}
exports.getRequestIdFromRequest = getRequestIdFromRequest;
function requestParser(req, res) {
    const path = req.originalUrl || req.path || req.url;
    const httpHeader = req.header && req.header('x-forwarded-for');
    const ip = req.ip || httpHeader || req.connection.remoteAddress;
    const requestData = {
        path,
        method: req.method,
        status: res.statusCode,
        ip,
        time: (new Date()).toISOString(),
    };
    if (res.get) {
        requestData.contentLength = res.get('content-length');
        requestData.contentType = res.get('content-type');
    }
    return requestData;
}
exports.requestParser = requestParser;
//# sourceMappingURL=requestParser.js.map