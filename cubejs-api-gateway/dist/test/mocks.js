"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdapterApiMock = exports.DataSourceStorageMock = exports.RefreshSchedulerMock = exports.compilerApi = exports.preAggregationVersionEntriesResultFactory = exports.preAggregationPartitionsResultFactory = exports.preAggregationsResultFactory = void 0;
const preAggregationsResultFactory = () => ([
    {
        preAggregationName: 'usages',
        preAggregation: {
            type: 'rollup',
            scheduledRefresh: true,
        },
        cube: 'Usage',
        references: {
            dimensions: [
                'Usage.deploymentId',
                'Usage.tenantId'
            ],
            measures: [
                'Usage.count'
            ],
            timeDimensions: [
                {
                    dimension: 'Usage.createdAt',
                    granularity: 'day'
                }
            ],
            rollups: []
        }
    }
]);
exports.preAggregationsResultFactory = preAggregationsResultFactory;
const preAggregationPartitionsResultFactory = () => ([
    {
        timezone: 'UTC',
        preAggregation: exports.preAggregationsResultFactory()[0],
        partitions: [
            {
                timezone: 'UTC',
                dimensions: [
                    'Usage.deploymentId',
                    'Usage.tenantId'
                ],
                measures: [
                    'Usage.count'
                ],
                timeDimensions: [
                    {
                        dimension: 'Usage.createdAt',
                        granularity: 'day',
                        dateRange: [
                            '2021-04-30T00:00:00.000',
                            '2021-04-30T23:59:59.999'
                        ]
                    }
                ],
                rollups: [],
                sql: {
                    tableName: 'dev_pre_aggregations.usage_usages20210430'
                }
            }
        ]
    }
]);
exports.preAggregationPartitionsResultFactory = preAggregationPartitionsResultFactory;
const preAggregationVersionEntriesResultFactory = () => ([
    {
        table_name: 'dev_pre_aggregations.usage_usages20210501',
        content_version: '1k5lbvhc',
        structure_version: 'ztptkip5',
        last_updated_at: 1621782171000,
        naming_version: 2
    },
    {
        table_name: 'dev_pre_aggregations.usage_usages20210430',
        content_version: 'imocehmz',
        structure_version: 'osacmcoe',
        last_updated_at: 1621782171000,
        naming_version: 2
    }
]);
exports.preAggregationVersionEntriesResultFactory = preAggregationVersionEntriesResultFactory;
exports.compilerApi = jest.fn().mockImplementation(() => ({
    async getSql() {
        return {
            sql: ['SELECT * FROM test', []],
            aliasNameToMember: {
                foo__bar: 'Foo.bar',
                foo__time: 'Foo.time',
            },
            order: [{ id: 'id', desc: true, }]
        };
    },
    async metaConfig() {
        return [
            {
                config: {
                    name: 'Foo',
                    measures: [
                        {
                            name: 'Foo.bar',
                        },
                    ],
                    dimensions: [
                        {
                            name: 'Foo.id',
                        },
                        {
                            name: 'Foo.time',
                        },
                    ],
                },
            },
        ];
    },
    async preAggregations() {
        return exports.preAggregationsResultFactory();
    }
}));
class RefreshSchedulerMock {
    async preAggregationPartitions() {
        return exports.preAggregationPartitionsResultFactory();
    }
}
exports.RefreshSchedulerMock = RefreshSchedulerMock;
class DataSourceStorageMock {
    constructor() {
        this.$testConnectionsDone = false;
        this.$testOrchestratorConnectionsDone = false;
    }
    async testConnections() {
        this.$testConnectionsDone = true;
        return [];
    }
    async testOrchestratorConnections() {
        this.$testOrchestratorConnectionsDone = true;
        return [];
    }
}
exports.DataSourceStorageMock = DataSourceStorageMock;
class AdapterApiMock {
    constructor() {
        this.$testConnectionsDone = false;
        this.$testOrchestratorConnectionsDone = false;
    }
    async testConnection() {
        this.$testConnectionsDone = true;
        return [];
    }
    async testOrchestratorConnections() {
        this.$testOrchestratorConnectionsDone = true;
        return [];
    }
    async executeQuery() {
        return {
            data: [{ foo__bar: 42 }]
        };
    }
    addDataSeenSource() {
        return undefined;
    }
    getPreAggregationVersionEntries() {
        return exports.preAggregationVersionEntriesResultFactory();
    }
}
exports.AdapterApiMock = AdapterApiMock;
//# sourceMappingURL=mocks.js.map