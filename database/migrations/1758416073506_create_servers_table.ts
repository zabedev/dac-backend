import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'servers'
  
  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('code').unsigned().unique().index()
      table.string('name', 80).unique()
      table.string('description', 191).nullable()
      table.jsonb('meta').nullable()
      table.boolean('is_active').defaultTo(false)
      table.smallint('scheduler_interval').defaultTo(1)
      table.smallint('attempts_retry').defaultTo(3)
      table.smallint('timeout').defaultTo(3)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}