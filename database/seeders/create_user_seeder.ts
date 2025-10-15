import User from '#models/user'
import { generateNewCode } from '#services/index'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    await User.createMany([
      { code:generateNewCode(), name: 'Ideilson Souza', email:'ideilson@localhost.com', password:'12345678', isActive:true, isSuper:true,},
    ])

  }
}