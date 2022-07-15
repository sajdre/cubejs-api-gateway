interface LocalSubscriptionStoreOptions {
    heartBeatInterval?: number;
}
export declare class LocalSubscriptionStore {
    protected connections: {};
    protected readonly hearBeatInterval: number;
    constructor(options?: LocalSubscriptionStoreOptions);
    getSubscription(connectionId: string, subscriptionId: string): Promise<any>;
    subscribe(connectionId: string, subscriptionId: string, subscription: any): Promise<void>;
    unsubscribe(connectionId: string, subscriptionId: string): Promise<void>;
    getAllSubscriptions(): Promise<any[]>;
    cleanupSubscriptions(connectionId: string): Promise<void>;
    getAuthContext(connectionId: string): Promise<any>;
    setAuthContext(connectionId: string, authContext: any): Promise<void>;
    protected getConnection(connectionId: string): any;
    clear(): void;
}
export {};
//# sourceMappingURL=LocalSubscriptionStore.d.ts.map