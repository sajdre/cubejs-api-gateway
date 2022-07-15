import type { ApiGateway } from './gateway';
import type { LocalSubscriptionStore } from './LocalSubscriptionStore';
export declare type WebSocketSendMessageFn = (connectionId: string, message: any) => void;
export declare class SubscriptionServer {
    protected readonly apiGateway: ApiGateway;
    protected readonly sendMessage: WebSocketSendMessageFn;
    protected readonly subscriptionStore: LocalSubscriptionStore;
    constructor(apiGateway: ApiGateway, sendMessage: WebSocketSendMessageFn, subscriptionStore: LocalSubscriptionStore);
    resultFn(connectionId: string, messageId: string): (message: any, { status }?: {
        status: number;
    }) => void;
    processMessage(connectionId: string, message: any, isSubscription: any): Promise<void>;
    processSubscriptions(): Promise<void>;
    disconnect(connectionId: string): Promise<void>;
    clear(): void;
}
//# sourceMappingURL=SubscriptionServer.d.ts.map