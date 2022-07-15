"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserError = void 0;
const CubejsHandlerError_1 = require("./CubejsHandlerError");
class UserError extends CubejsHandlerError_1.CubejsHandlerError {
    constructor(message) {
        super(400, 'User Error', message);
    }
}
exports.UserError = UserError;
//# sourceMappingURL=UserError.js.map