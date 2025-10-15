import { convert } from 'convert';

const OPERATORS: Record<string, (a: number, b: number) => boolean> = {
    "==": (a, b) => a === b,
    "!=": (a, b) => a !== b,
    ">": (a, b) => a > b,
    ">=": (a, b) => a >= b,
    "<": (a, b) => a < b,
    "<=": (a, b) => a <= b,
};

export function convertByUnit(value: number, inputUnit: string, outputUnit: string) {
    try {
        return convert(value, inputUnit as any).to(outputUnit as any);
    } catch (e: any) {
        return null
    }
}

export function evaluateCondition(leftValue: number | string, operatorStr: string, rightValue: number | string) {
    try {
        const func = OPERATORS[operatorStr];
        if (!func) throw new Error(`Operador não suportado: ${operatorStr}`);
        const left = Math.round(Number(leftValue) * 100) / 100;
        const right = Math.round(Number(rightValue) * 100) / 100;
        return { status: true, result: func(left, right), message: 'Condição avaliada com sucesso' };
    } catch (e: any) {
        return { status: false, result: null, message: `Erro na avaliação da condição: ${e.message || e}` };
    }
}

interface ConvertByLinearizationParams {
    value: number;
    inputMin: number | null;
    inputMax: number | null;
    outputMin: number;
    outputMax: number;
}

export function convertByLinearization(params: ConvertByLinearizationParams) {
    try {
        let result: number;
        if (params.inputMin !== null && params.inputMax !== null) {
            if (params.inputMin === params.inputMax) throw new Error("Intervalo de entrada inválido (min == max)");
            result = ((params.value - params.inputMin) / (params.inputMax - params.inputMin)) * (params.outputMax - params.outputMin) + params.outputMin;
        } else if (params.inputMin !== null) {
            result = params.value < params.inputMin ? params.outputMin * (params.value / params.inputMin) : params.outputMin + (params.value - params.inputMin) * (params.outputMin / params.inputMin);
        } else if (params.inputMax !== null) {
            result = params.value < params.inputMax ? params.outputMax * (params.value / params.inputMax) : params.outputMax + (params.value - params.inputMax) * (params.outputMax / params.inputMax);
        } else {
            throw new Error("Ambos entrada mínima e máxima são null");
        }
        const mathResult = Math.round(result * 1000) / 1000;
        return parseFloat(mathResult.toFixed(2))
    } catch (e: any) {
        return null;
    }
}

export function getAccumulatedDifference(newValue: number | null, previousValue: number | null, useAbs = false) {
    try {
        if (newValue == null || previousValue == null) return { status: true, result: null, message: 'Valores não definidos' };
        let result: number | null = null;
        if (useAbs) result = Math.abs(newValue - previousValue);
        else if (newValue > previousValue) result = newValue - previousValue;
        else if (newValue === previousValue) result = 0;
        return result
    } catch (e: any) {
        return null
    }
}

// =======================
// Ações
// =======================
function applyOverwrite(_: number | null, param: number | null) {
    return param;
}
function applyIncrement(current: number | null, param: number | null) {
    return (current || 0) + (param || 0)
}
function applyDecrement(current: number | null, param: number | null) {
    return (current || 0) - (param || 0)
}
function applyMultiply(current: number | null, param: number | null) {
    return (current || 0) * (param || 0)
}
function applyDivide(current: number | null, param: number | null) {
    return !param ? null : (current || 0) / param
}
function applyReset() {
    return 0
}
function applyKeep(current: number | null) {
    return current
}
function applyFixed(_: number | null, param: number | null) {
    return param
}
function applyDiscard(current: number | null) {
    return current
}
function applyContinue(current: number | null) {
    return current
}

const ACTIONS_MAP: Record<string, Function> = {
    overwrite: applyOverwrite,
    increment: applyIncrement,
    decrement: applyDecrement,
    multiply: applyMultiply,
    divide: applyDivide,
    reset: applyReset,
    keep: applyKeep,
    fixed: applyFixed,
    discard: applyDiscard,
    continue: applyContinue,
};

export function applyEvaluateAction(actionName: string, currentValue: number | null, param?: number | null) {
    const actionFunc = ACTIONS_MAP[actionName];
    if (!actionFunc) return null;
    try { return actionFunc(currentValue, param); }
    catch (e: any) { return null }
}
