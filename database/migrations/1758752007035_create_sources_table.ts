import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'sources'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('code').unsigned().unique().index()
      table
        .integer('server_code')
        .nullable()
        .unsigned()
        .references('code')
        .inTable('servers')
        .onDelete('SET NULL')
        .onUpdate('CASCADE')

      table.string('name', 80).unique()
      table.string('description', 191).nullable()
      table.boolean('is_active').defaultTo(false)
      table.smallint('scheduler_interval').defaultTo(1)
      table.smallint('attempts_retry').defaultTo(3)
      table.jsonb('meta').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}