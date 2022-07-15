"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAuthToken = void 0;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function generateAuthToken(payload = {}, options, secret = 'secret') {
    return jsonwebtoken_1.default.sign(payload, secret, {
        expiresIn: '10000d',
        ...options,
    });
}
exports.generateAuthToken = generateAuthToken;
//# sourceMappingURL=utils.js.map