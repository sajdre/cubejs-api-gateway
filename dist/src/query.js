"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeQueryPreAggregations = exports.normalizeQuery = exports.getPivotQuery = exports.getQueryGranularity = exports.QUERY_TYPE = void 0;
const ramda_1 = __importDefault(require("ramda"));
const moment_1 = __importDefault(require("moment"));
const joi_1 = __importDefault(require("@hapi/joi"));
const UserError_1 = require("./UserError");
const dateParser_1 = require("./dateParser");
exports.QUERY_TYPE = {
    REGULAR_QUERY: 'regularQuery',
    COMPARE_DATE_RANGE_QUERY: 'compareDateRangeQuery',
    BLENDING_QUERY: 'blendingQuery',
};
const getQueryGranularity = (queries) => ramda_1.default.pipe(ramda_1.default.map(({ timeDimensions }) => timeDimensions[0] && timeDimensions[0].granularity || null), ramda_1.default.filter(Boolean), ramda_1.default.uniq)(queries);
exports.getQueryGranularity = getQueryGranularity;
const getPivotQuery = (queryType, queries) => {
    let [pivotQuery] = queries;
    if (queryType === exports.QUERY_TYPE.BLENDING_QUERY) {
        pivotQuery = ramda_1.default.fromPairs(['measures', 'dimensions'].map((key) => [key, ramda_1.default.uniq(queries.reduce((memo, q) => memo.concat(q[key]), []))]));
        const [granularity] = exports.getQueryGranularity(queries);
        pivotQuery.timeDimensions = [{
                dimension: 'time',
                granularity
            }];
    }
    else if (queryType === exports.QUERY_TYPE.COMPARE_DATE_RANGE_QUERY) {
        pivotQuery.dimensions = ['compareDateRange'].concat(pivotQuery.dimensions || []);
    }
    pivotQuery.queryType = queryType;
    return pivotQuery;
};
exports.getPivotQuery = getPivotQuery;
const id = joi_1.default.string().regex(/^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+$/);
const dimensionWithTime = joi_1.default.string().regex(/^[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+(\.(second|minute|hour|day|week|month|year))?$/);
const operators = [
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'in',
    'notIn',
    'gt',
    'gte',
    'lt',
    'lte',
    'set',
    'notSet',
    'inDateRange',
    'notInDateRange',
    'onTheDate',
    'beforeDate',
    'afterDate',
    'measureFilter',
];
const oneFilter = joi_1.default.object().keys({
    dimension: id,
    member: id,
    operator: joi_1.default.valid(operators).required(),
    values: joi_1.default.array().items(joi_1.default.string().allow('', null), joi_1.default.lazy(() => oneFilter))
}).xor('dimension', 'member');
const oneCondition = joi_1.default.object().keys({
    or: joi_1.default.array().items(oneFilter, joi_1.default.lazy(() => oneCondition).description('oneCondition schema')),
    and: joi_1.default.array().items(oneFilter, joi_1.default.lazy(() => oneCondition).description('oneCondition schema')),
}).xor('or', 'and');
const querySchema = joi_1.default.object().keys({
    measures: joi_1.default.array().items(id),
    dimensions: joi_1.default.array().items(dimensionWithTime),
    filters: joi_1.default.array().items(oneFilter, oneCondition),
    timeDimensions: joi_1.default.array().items(joi_1.default.object().keys({
        dimension: id.required(),
        granularity: joi_1.default.valid('day', 'month', 'year', 'week', 'hour', 'minute', 'second', null),
        dateRange: [
            joi_1.default.array().items(joi_1.default.string()).min(1).max(2),
            joi_1.default.string()
        ],
        compareDateRange: joi_1.default.array()
    }).oxor('dateRange', 'compareDateRange')),
    order: joi_1.default.alternatives(joi_1.default.object().pattern(id, joi_1.default.valid('asc', 'desc')), joi_1.default.array().items(joi_1.default.array().min(2).ordered(id, joi_1.default.valid('asc', 'desc')))),
    segments: joi_1.default.array().items(id),
    timezone: joi_1.default.string(),
    limit: joi_1.default.number().integer().min(1).max(50000),
    offset: joi_1.default.number().integer().min(0),
    renewQuery: joi_1.default.boolean(),
    ungrouped: joi_1.default.boolean()
});
const normalizeQueryOrder = order => {
    let result = [];
    const normalizeOrderItem = (k, direction) => ({
        id: k,
        desc: direction === 'desc'
    });
    if (order) {
        result = Array.isArray(order) ?
            order.map(([k, direction]) => normalizeOrderItem(k, direction)) :
            Object.keys(order).map(k => normalizeOrderItem(k, order[k]));
    }
    return result;
};
const DateRegex = /^\d\d\d\d-\d\d-\d\d$/;
const checkQueryFilters = (filter) => {
    filter.find(f => {
        if (f.or) {
            checkQueryFilters(f.or);
            return false;
        }
        if (f.and) {
            checkQueryFilters(f.and);
            return false;
        }
        if (!f.operator) {
            throw new UserError_1.UserError(`Operator required for filter: ${JSON.stringify(f)}`);
        }
        if (operators.indexOf(f.operator) === -1) {
            throw new UserError_1.UserError(`Operator ${f.operator} not supported for filter: ${JSON.stringify(f)}`);
        }
        if (!f.values && ['set', 'notSet', 'measureFilter'].indexOf(f.operator) === -1) {
            throw new UserError_1.UserError(`Values required for filter: ${JSON.stringify(f)}`);
        }
        return false;
    });
    return true;
};
const normalizeQuery = (query) => {
    const { error } = joi_1.default.validate(query, querySchema);
    if (error) {
        throw new UserError_1.UserError(`Invalid query format: ${error.message || error.toString()}`);
    }
    const validQuery = query.measures && query.measures.length ||
        query.dimensions && query.dimensions.length ||
        query.timeDimensions && query.timeDimensions.filter(td => !!td.granularity).length;
    if (!validQuery) {
        throw new UserError_1.UserError('Query should contain either measures, dimensions or timeDimensions with granularities in order to be valid');
    }
    checkQueryFilters(query.filters || []);
    const regularToTimeDimension = (query.dimensions || []).filter(d => d.split('.').length === 3).map(d => ({
        dimension: d.split('.').slice(0, 2).join('.'),
        granularity: d.split('.')[2]
    }));
    const timezone = query.timezone || 'UTC';
    return {
        ...query,
        rowLimit: query.rowLimit || query.limit,
        timezone,
        order: normalizeQueryOrder(query.order),
        filters: (query.filters || []).map(f => {
            const { dimension, member, ...filter } = f;
            const normalizedFlter = {
                ...filter,
                member: member || dimension
            };
            Object.defineProperty(normalizedFlter, 'dimension', {
                get() {
                    console.warn('Warning: Attribute `filter.dimension` is deprecated. Please use \'member\' instead of \'dimension\'.');
                    return this.member;
                }
            });
            return normalizedFlter;
        }),
        dimensions: (query.dimensions || []).filter(d => d.split('.').length !== 3),
        timeDimensions: (query.timeDimensions || []).map(td => {
            let dateRange;
            const compareDateRange = td.compareDateRange ? td.compareDateRange.map((currentDateRange) => (typeof currentDateRange === 'string' ? dateParser_1.dateParser(currentDateRange, timezone) : currentDateRange)) : null;
            if (typeof td.dateRange === 'string') {
                dateRange = dateParser_1.dateParser(td.dateRange, timezone);
            }
            else {
                dateRange = td.dateRange && td.dateRange.length === 1 ? [td.dateRange[0], td.dateRange[0]] : td.dateRange;
            }
            return {
                ...td,
                dateRange: dateRange && dateRange.map((d, i) => (i === 0 ?
                    moment_1.default.utc(d).format(d.match(DateRegex) ? 'YYYY-MM-DDT00:00:00.000' : moment_1.default.HTML5_FMT.DATETIME_LOCAL_MS) :
                    moment_1.default.utc(d).format(d.match(DateRegex) ? 'YYYY-MM-DDT23:59:59.999' : moment_1.default.HTML5_FMT.DATETIME_LOCAL_MS))),
                ...(compareDateRange ? { compareDateRange } : {})
            };
        }).concat(regularToTimeDimension)
    };
};
exports.normalizeQuery = normalizeQuery;
const queryPreAggregationsSchema = joi_1.default.object().keys({
    timezone: joi_1.default.string(),
    timezones: joi_1.default.array().items(joi_1.default.string()),
    preAggregations: joi_1.default.array().items(joi_1.default.object().keys({
        id: joi_1.default.string().required(),
        refreshRange: joi_1.default.array().items(joi_1.default.string()).length(2)
    }))
});
const normalizeQueryPreAggregations = (query, defaultValues) => {
    const { error } = joi_1.default.validate(query, queryPreAggregationsSchema);
    if (error) {
        throw new UserError_1.UserError(`Invalid query format: ${error.message || error.toString()}`);
    }
    return {
        timezones: query.timezones || (query.timezone && [query.timezone]) || defaultValues.timezones,
        preAggregations: query.preAggregations
    };
};
exports.normalizeQueryPreAggregations = normalizeQueryPreAggregations;
//# sourceMappingURL=query.js.map