import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class SourceValue extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare code: number

  @column()
  declare sourceCode: number

  @column()
  declare creationType: string | null

  @column()
  declare grouping: string | null

  @column()
  declare isOpened: boolean

  @column()
  declare openedAt: DateTime | null

  @column()
  declare closedAt: DateTime | null

  @column()
  declare datetime: DateTime

  @column()
  declare value: any | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}