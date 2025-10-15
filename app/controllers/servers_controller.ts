import Server from '#models/server'
import type { HttpContext } from '@adonisjs/core/http'

export default class ServersController {
  /**
   * Display a list of resource
   */
  async index({ response }: HttpContext) {
    try {
      const servers = await Server.all()
      return response.ok(servers.map(server => server.serialize()))
    } catch (error) {
      console.log(error.message);
      return response.internalServerError({ error: error.message })
    }
  }

  /**
   * Handle form submission for the create action
   */
  async store({ request, response }: HttpContext) {
    try {
      const body = request.only(['name', 'description', 'isActive', 'schedulerInterval', 'attemptsRetry', 'meta'])
      const server = await Server.create(body)
      return response.created(server.serialize())
    } catch (error) {
      console.log(error.message);
      return response.internalServerError({ error: error.message })
    }
  }

  /**
   * Show individual record
   */
  async show({ params, response }: HttpContext) {
    try {
      const server = await Server.query().where('code', params.id).first()
      if (!server) {
        return response.notFound()
      }
      return response.ok(server.serialize())
    } catch (error) {
      console.log(error.message);
      return response.internalServerError({ error: error.message })
    }
  }

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const body = request.only(['name', 'description', 'isActive', 'schedulerInterval', 'attemptsRetry', 'meta'])
      const server = await Server.query().where('id', params.id).first()
      if (!server) {
        return response.notFound()
      }
      server.merge(body)
      await server.save()
      return response.ok(server.serialize())
    } catch (error) {
      console.log(error.message);
      return response.internalServerError({ error: error.message })
    }
  }

  /**
   * Delete record
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const server = await Server.findOrFail(params.id)
      await server.delete()
      return response.noContent()
    } catch (error) {
      console.log(error.message);
      return response.internalServerError({ error: error.message })
    }
  }
}