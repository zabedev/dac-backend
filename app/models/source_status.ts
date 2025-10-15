import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class SourceStatus extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare sourceCode: number

  @column()
  declare isConnected: boolean

  @column()
  declare connectionAttempts: number

  @column()
  declare lastSyncAt: DateTime | null

  @column()
  declare lastConnectionAt: DateTime | null

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
  declare meta: any | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}