/// <reference types="jest" />
export declare const preAggregationsResultFactory: () => {
    preAggregationName: string;
    preAggregation: {
        type: string;
        scheduledRefresh: boolean;
    };
    cube: string;
    references: {
        dimensions: string[];
        measures: string[];
        timeDimensions: {
            dimension: string;
            granularity: string;
        }[];
        rollups: never[];
    };
}[];
export declare const preAggregationPartitionsResultFactory: () => {
    timezone: string;
    preAggregation: {
        preAggregationName: string;
        preAggregation: {
            type: string;
            scheduledRefresh: boolean;
        };
        cube: string;
        references: {
            dimensions: string[];
            measures: string[];
            timeDimensions: {
                dimension: string;
                granularity: string;
            }[];
            rollups: never[];
        };
    };
    partitions: {
        timezone: string;
        dimensions: string[];
        measures: string[];
        timeDimensions: {
            dimension: string;
            granularity: string;
            dateRange: string[];
        }[];
        rollups: never[];
        sql: {
            tableName: string;
        };
    }[];
}[];
export declare const preAggregationVersionEntriesResultFactory: () => {
    table_name: string;
    content_version: string;
    structure_version: string;
    last_updated_at: number;
    naming_version: number;
}[];
export declare const compilerApi: jest.Mock<any, any>;
export declare class RefreshSchedulerMock {
    preAggregationPartitions(): Promise<{
        timezone: string;
        preAggregation: {
            preAggregationName: string;
            preAggregation: {
                type: string;
                scheduledRefresh: boolean;
            };
            cube: string;
            references: {
                dimensions: string[];
                measures: string[];
                timeDimensions: {
                    dimension: string;
                    granularity: string;
                }[];
                rollups: never[];
            };
        };
        partitions: {
            timezone: string;
            dimensions: string[];
            measures: string[];
            timeDimensions: {
                dimension: string;
                granularity: string;
                dateRange: string[];
            }[];
            rollups: never[];
            sql: {
                tableName: string;
            };
        }[];
    }[]>;
}
export declare class DataSourceStorageMock {
    $testConnectionsDone: boolean;
    $testOrchestratorConnectionsDone: boolean;
    testConnections(): Promise<never[]>;
    testOrchestratorConnections(): Promise<never[]>;
}
export declare class AdapterApiMock {
    $testConnectionsDone: boolean;
    $testOrchestratorConnectionsDone: boolean;
    testConnection(): Promise<never[]>;
    testOrchestratorConnections(): Promise<never[]>;
    executeQuery(): Promise<{
        data: {
            foo__bar: number;
        }[];
    }>;
    addDataSeenSource(): undefined;
    getPreAggregationVersionEntries(): {
        table_name: string;
        content_version: string;
        structure_version: string;
        last_updated_at: number;
        naming_version: number;
    }[];
}
//# sourceMappingURL=mocks.d.ts.map