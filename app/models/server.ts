import { DateTime } from 'luxon'
import { BaseModel, beforeCreate, column, hasMany } from '@adonisjs/lucid/orm'
import { generateNewCode } from '#services/index'
import Source from './source.js'
import type { HasMany } from '@adonisjs/lucid/types/relations'

export default class Server extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: number

  @beforeCreate()
  public static async generateCode(server: Server) {
    if (!server.$dirty.code) {
      server.code = generateNewCode()
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

  @column()
  declare timeout: number

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
  declare meta: ServerMeta

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @hasMany(() => Source, {
    foreignKey: 'serverCode',
    localKey: 'code',
  })
  declare sources: HasMany<typeof Source>
}

type ServerMeta = ProtocolModbusTCPMeta | ProtocolModbusSerialMeta | ProtocolHttpMeta | ProtocolMQTTMeta | ProtocolKafkaMeta | ProtocolRFIDMeta

type ProtocolModbusTCPMeta = {
  kind: "modbus-tcp"
  host: string
  port: number
  timeout?: number
  lastConnect: DateTime | null
}

type ProtocolModbusSerialMeta = {
  kind: "modbus-serial"
  device: string
  baudRate: number
  dataBits: number
  stopBits: number
  parity: "none" | "even" | "odd"
  timeout?: number
  lastConnect: DateTime | null
}

type ProtocolHttpMeta = {
  kind: "http"
  url: string
  timeout?: number
  lastConnect: DateTime | null
}

type ProtocolMQTTMeta = {
  kind: "mqtt"
  host: string
  port: number
  username: string
  password: string
  timeout?: number
  lastConnect: DateTime | null
}

type ProtocolKafkaMeta = {
  kind: "kafka"
  host: string
  port: number
  topic: string
  timeout?: number
  lastConnect: DateTime | null
}

type ProtocolRFIDMeta = {
  kind: "rfid"
  host: string
  port: number
  timeout?: number
  lastConnect: DateTime | null
}
