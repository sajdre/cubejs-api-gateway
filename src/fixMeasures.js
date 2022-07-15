import * as R from "ramda"

const getPrefix = R.compose(
    R.head,
    R.split("."), 
    R.head 
) 
export const fixMeasures = (query, metaConfigResult) => {
    const members = R.map(({member}) => member, query.filters)
    const {dimensions, measures} = query

    const isDimension = member => R.any(({config}) => R.find(({name}) => member === name, config.dimensions), metaConfigResult)
    const isMeasure = member => R.any(({config}) => R.find(({name}) => member === name, config.measures), metaConfigResult)

    const missedDimensions = R.filter(member => isDimension(member) && !R.includes(member, dimensions), members)
    const missedMeasures = R.filter(member => isMeasure(member) && !R.includes(member, measures), members)
    const adjustedMeasures = [...query.measures, ...missedMeasures]
    const totalCount = (R.isEmpty(adjustedMeasures) && R.isEmpty(dimensions) && R.isEmpty(missedDimensions)) 
        ? [] : [`${getPrefix([...adjustedMeasures, ...dimensions, ...missedDimensions])}.totalCount`]

    query.measures = R.uniq([...query.measures, ...missedMeasures, ...totalCount])
}
