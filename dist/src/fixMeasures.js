"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fixMeasures = void 0;
const R = __importStar(require("ramda"));
const getPrefix = R.compose(R.head, R.split("."), R.head);
const fixMeasures = (query, metaConfigResult) => {
    const members = R.map(({ member }) => member, query.filters);
    const { dimensions, measures } = query;
    const isDimension = member => R.any(({ config }) => R.find(({ name }) => member === name, config.dimensions), metaConfigResult);
    const isMeasure = member => R.any(({ config }) => R.find(({ name }) => member === name, config.measures), metaConfigResult);
    const missedDimensions = R.filter(member => isDimension(member) && !R.includes(member, dimensions), members);
    const missedMeasures = R.filter(member => isMeasure(member) && !R.includes(member, measures), members);
    const adjustedMeasures = [...query.measures, ...missedMeasures];
    const totalCount = (R.isEmpty(adjustedMeasures) && R.isEmpty(dimensions) && R.isEmpty(missedDimensions))
        ? [] : [`${getPrefix([...adjustedMeasures, ...dimensions, ...missedDimensions])}.totalCount`];
    query.measures = R.uniq([...query.measures, ...missedMeasures, ...totalCount]);
};
exports.fixMeasures = fixMeasures;
//# sourceMappingURL=fixMeasures.js.map