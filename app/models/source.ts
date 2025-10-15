import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, belongsTo, column } from '@adonisjs/lucid/orm'
import { generateNewCode } from '#services/index'
import Server from './server.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Source extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: number

  @column()
  declare serverCode: number

  @beforeCreate()
  public static async generateCode(source: Source) {
    if (!source.$dirty.code) {
      source.code = generateNewCode()
    }
  }

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare isActive: boolean

  @column()
  declare schedulerInterval: number

  @column()
  declare attemptsRetry: number

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: string) => {
      try {
        return typeof value === "object" ? value : JSON.parse(value)
      } catch {
        return {}
      }
    },
  })
  declare meta: SourceMeta

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Server, {
    foreignKey: 'serverCode',
    localKey: 'code',
  })
  declare server: BelongsTo<typeof Server>

}

type SourceMeta = ModbusTCPMeta | ModbusSerialMeta | HttpMeta

type ModbusTCPMeta = {
  kind: "modbus-tcp"
  unitId: number
  modbusFunction: string
  dataAddress: number
  lengthAddress: number
  format: string
  swapWords?: boolean
  swapBytes?: boolean
  reading?: number | null
  convert?: any | null
  isReading: boolean
}

type ModbusSerialMeta = {
  kind: "modbus-serial"
  device: string
  baudRate: number
  dataBits: number
  stopBits: number
  parity: "none" | "even" | "odd"
  unitId?: number
  modbusFunction: string
  dataAddress: number
  lengthAddress: number
  format: string
  swapWords?: boolean
  swapBytes?: boolean
  reading?: number | null
  convert?: any | null
  isReading: boolean
}

type HttpMeta = {
  kind: "http"
  url: string
  reading?: any | null
  isReading: boolean
}
