import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'source_statuses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.bigInteger('source_code').unsigned().notNullable().references('code').inTable('sources').onDelete('CASCADE').onUpdate('CASCADE')
      table.boolean('is_connected').defaultTo(false)
      table.smallint('connection_attempts').defaultTo(0)
      table.timestamp('last_sync_at').nullable()
      table.timestamp('last_connection_at').nullable()
      table.jsonb('meta').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}