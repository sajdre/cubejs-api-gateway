"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionServer = void 0;
const v4_1 = __importDefault(require("uuid/v4"));
const UserError_1 = require("./UserError");
const methodParams = {
    load: ['query', 'queryType'],
    sql: ['query'],
    'dry-run': ['query'],
    meta: [],
    subscribe: ['query', 'queryType'],
    unsubscribe: []
};
class SubscriptionServer {
    constructor(apiGateway, sendMessage, subscriptionStore) {
        this.apiGateway = apiGateway;
        this.sendMessage = sendMessage;
        this.subscriptionStore = subscriptionStore;
    }
    resultFn(connectionId, messageId) {
        return (message, { status } = { status: 200 }) => this.sendMessage(connectionId, { messageId, message, status });
    }
    async processMessage(connectionId, message, isSubscription) {
        let authContext = {};
        let context = {};
        try {
            if (typeof message === 'string') {
                message = JSON.parse(message);
            }
            if (message.authorization) {
                authContext = { isSubscription: true };
                await this.apiGateway.checkAuthFn(authContext, message.authorization);
                await this.subscriptionStore.setAuthContext(connectionId, authContext);
                this.sendMessage(connectionId, { handshake: true });
                return;
            }
            if (message.unsubscribe) {
                await this.subscriptionStore.unsubscribe(connectionId, message.unsubscribe);
                return;
            }
            if (!message.messageId) {
                throw new UserError_1.UserError('messageId is required');
            }
            authContext = await this.subscriptionStore.getAuthContext(connectionId);
            if (!authContext) {
                await this.sendMessage(connectionId, {
                    messageId: message.messageId,
                    message: { error: 'Not authorized' },
                    status: 403
                });
                return;
            }
            if (!message.method) {
                throw new UserError_1.UserError('method is required');
            }
            if (!methodParams[message.method]) {
                throw new UserError_1.UserError(`Unsupported method: ${message.method}`);
            }
            const baseRequestId = message.requestId || `${connectionId}-${message.messageId}`;
            const requestId = `${baseRequestId}-span-${v4_1.default()}`;
            context = await this.apiGateway.contextByReq(message, authContext.securityContext, requestId);
            const allowedParams = methodParams[message.method];
            const params = allowedParams.map(k => ({ [k]: (message.params || {})[k] }))
                .reduce((a, b) => ({ ...a, ...b }), {});
            const method = message.method.replace(/[^a-z]+(.)/g, (m, chr) => chr.toUpperCase());
            await this.apiGateway[method]({
                ...params,
                context,
                isSubscription,
                res: this.resultFn(connectionId, message.messageId),
                subscriptionState: async () => {
                    const subscription = await this.subscriptionStore.getSubscription(connectionId, message.messageId);
                    return subscription && subscription.state;
                },
                subscribe: async (state) => this.subscriptionStore.subscribe(connectionId, message.messageId, {
                    message,
                    state
                }),
                unsubscribe: async () => this.subscriptionStore.unsubscribe(connectionId, message.messageId)
            });
            await this.sendMessage(connectionId, { messageProcessedId: message.messageId });
        }
        catch (e) {
            this.apiGateway.handleError({
                e,
                query: message.query,
                res: this.resultFn(connectionId, message.messageId),
                context
            });
        }
    }
    async processSubscriptions() {
        const allSubscriptions = await this.subscriptionStore.getAllSubscriptions();
        await Promise.all(allSubscriptions.map(async (subscription) => {
            await this.processMessage(subscription.connectionId, subscription.message, true);
        }));
    }
    async disconnect(connectionId) {
        await this.subscriptionStore.cleanupSubscriptions(connectionId);
    }
    clear() {
        this.subscriptionStore.clear();
    }
}
exports.SubscriptionServer = SubscriptionServer;
//# sourceMappingURL=SubscriptionServer.js.map