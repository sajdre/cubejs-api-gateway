export namespace QUERY_TYPE {
    const REGULAR_QUERY: string;
    const COMPARE_DATE_RANGE_QUERY: string;
    const BLENDING_QUERY: string;
}
export function getQueryGranularity(queries: any): any[];
export function getPivotQuery(queryType: any, queries: any): any;
export function normalizeQuery(query: any): any;
export function normalizeQueryPreAggregations(query: any, defaultValues: any): {
    timezones: any;
    preAggregations: any;
};
//# sourceMappingURL=query.d.ts.map