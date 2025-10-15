import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'source_values'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('code').notNullable().unsigned().unique().index()
      table.bigInteger('source_code').unsigned().notNullable().references('code').inTable('sources').onDelete('CASCADE').onUpdate('CASCADE')
      table.string('creation_type',20).nullable()
      table.string('grouping', 50).nullable()
      table.boolean('is_opened').defaultTo(false)
      table.datetime('opened_at').nullable()
      table.datetime('closed_at').nullable()
      table.datetime('datetime').defaultTo(this.db.rawQuery('CURRENT_TIMESTAMP').knexQuery).notNullable()
      table.jsonb('value').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}