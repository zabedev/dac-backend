import { convertByLinearization, convertByUnit } from '#services/helps_service'

interface ConvertModbus {
    meta: any,
    value: number,
}
export
    function convertModbusValue(convert: ConvertModbus) {
    if (!convert.meta.isActive) return convert.value

    if (convert.meta.type === 'automatic') {
        return convertByUnit(convert.value, convert.meta.unitInput, convert.meta.unitOutput)
    }

    if (convert.meta.type === 'manually') {
        return convertByLinearization({
            value: convert.value,
            inputMin: convert.meta.inputMin,
            inputMax: convert.meta.inputMax,
            outputMin: convert.meta.outputMin,
            outputMax: convert.meta.outputMax,
        })
    }
}