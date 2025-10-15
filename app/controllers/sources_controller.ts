import Source from '#models/source'
import SourceStatus from '#models/source_status'
import type { HttpContext } from '@adonisjs/core/http'
// import app from '@adonisjs/core/services/app'
// import ModbusProvider from '../providers/modbus_provider.js'

export default class SourcesController {

    /**
     * Show a list of all available sources
     */
    async index({ response }: HttpContext) {
        try {
            const sources = await Source.all()

            const results = await Promise.all(
                sources.map(async (source) => {
                    const status = await SourceStatus.findBy('source_code', source.code)
                    return { ...source.serialize(), status: status?.serialize() ?? null }
                })
            )

            return response.ok(results)
        } catch (error) {
            console.log(error.message)
            return response.internalServerError({ error: error.message })
        }
    }

    /**
     * Get a source by its ID
     */
    async show({ params, response }: HttpContext) {
        try {
            const source = await Source.findOrFail(params.id)
            return response.ok(source.serialize())

            // const modbus = await app.container.make(ModbusProvider)

            // const client = await modbus.getClient(2)
            // if (!client) {
            //     return response.status(500).send({ error: 'Sem conexão com servidor' })
            // }

            // try {
            //     client.setID(1)
            //     const data = await client.readHoldingRegisters(0, 1)
            //     return { registers: data.data }
            // } catch (error) {
            //     return response.status(500).send({ error: error.message })
            // }

        } catch (error) {
            console.log(error.message);
            return response.internalServerError({ error: error.message })
        }
    }

    /**
     * Create a new source
     */
    async store({ request, response }: HttpContext) {
        try {
            const body = request.only(['name', 'description', 'isActive', 'schedulerInterval', 'attemptsRetry', 'meta', 'serverCode'])
            const source = await Source.create(body)
            return response.created(source.serialize())
        } catch (error) {
            console.log(error.message);
            return response.internalServerError({ error: error.message })
        }
    }

    /**
     * Update a source by its ID
     */
    async update({ params, request, response }: HttpContext) {
        try {
            const source = await Source.findOrFail(params.id)
            const body = request.only(['name', 'description', 'isActive', 'schedulerInterval', 'attemptsRetry', 'meta', 'serverCode'])
            source.merge(body)
            await source.save()
            return source
        } catch (error) {
            console.log(error.message);
            return response.internalServerError({ error: error.message })
        }
    }

    /**
     * Delete a source by its ID
     */
    async destroy({ params, response }: HttpContext) {
        try {
            const source = await Source.findOrFail(params.id)
            await source.delete()
            return response.noContent()
        } catch (error) {
            console.log(error.message);
            return response.internalServerError({ error: error.message })
        }
    }


}