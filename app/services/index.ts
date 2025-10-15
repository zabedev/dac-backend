export function generateNewCode(): number {
  const timestampMs = Date.now()
  const randomSuffix = Math.floor(Math.random() * 10000000)
  const codeString: string = `${timestampMs}${randomSuffix}`
  const last12Digits = codeString.slice(-9)
  return Number.parseInt(last12Digits, 10)
}
