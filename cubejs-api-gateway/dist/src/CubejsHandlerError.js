"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CubejsHandlerError = void 0;
class CubejsHandlerError extends Error {
    constructor(status, type, message) {
        super(message || type);
        this.status = status;
        this.type = type;
    }
}
exports.CubejsHandlerError = CubejsHandlerError;
//# sourceMappingURL=CubejsHandlerError.js.map