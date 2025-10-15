// app/Providers/SourceReadProvider.ts
import { ApplicationService } from '@adonisjs/core/types'
import Source from '#models/source'
import { Mutex } from 'async-mutex'
import ModbusRTU from 'modbus-serial'
import { ModbusFormatter } from '#services/modbus_service'
import SourceStatus from '#models/source_status'
import { DateTime } from 'luxon'
import transmit from '@adonisjs/transmit/services/main'

import { convertModbusValue } from '#services/modbus_processor'

interface Loop {
  interval: NodeJS.Timeout
  active: boolean
  schedulerInterval: number
}

export default class SourceReadProvider {
  private loops = new Map<number, Loop>()
  private monitor?: NodeJS.Timeout
  private mutexes = new Map<number, Mutex>()
  private sources: Source[] = []

  constructor(protected app: ApplicationService) { }

  async register() {
    this.app.container.singleton(SourceReadProvider, () => this)
  }

  async boot() {
    try {
      this.sources = await Source.query().where('is_active', true).preload('server')
      console.log(`🚀 Found ${this.sources.length} active sources on boot`)
      this.sources.forEach((s) => this.startOrUpdateLoop(s))
      this.startMonitor()
    } catch (error) {
      console.error('❌ Boot error in SourceReadProvider:', error)
    }
  }

  private startOrUpdateLoop(source: Source) {
    const ms = Math.max(source.schedulerInterval * 1000, 1000)
    const loop = this.loops.get(source.id)

    if (loop) {
      if (loop.schedulerInterval !== source.schedulerInterval) {
        clearInterval(loop.interval)
        const newInterval = setInterval(() => this.readSource(source), ms)
        this.loops.set(source.id, { interval: newInterval, active: true, schedulerInterval: source.schedulerInterval })
        console.log(`🔄 Updated loop for source ${source.id} -> ${ms / 1000}s`)
      }
      return
    }

    const interval = setInterval(() => this.readSource(source), ms)
    this.loops.set(source.id, { interval, active: true, schedulerInterval: source.schedulerInterval })
    console.log(`▶️ Started loop for source ${source.id} (every ${ms / 1000}s)`)
  }

  private async readSource(source: Source) {
    const loop = this.loops.get(source.id)
    if (!loop?.active) return

    try {
      const freshSource = await Source.query().where('id', source.id).preload('server').first()
      if (!freshSource) return
      const kind = freshSource.meta.kind
      switch (kind) {
        case 'modbus-tcp':
        case 'modbus-serial':
          await this.readModbus(freshSource)
          break
        case 'http':
          await this.readHttp(freshSource)
          break
        default:
          console.warn(`⚠️ Unknown source kind: ${kind}`)
      }
    } catch (error) {
      console.error(`⚠️ Error reading source ${source.id}:`, error.message)
    }
  }

  private async getOrCreateStatus(sourceCode: number): Promise<SourceStatus> {
    try {
      const status = await SourceStatus.firstOrCreate(
        { sourceCode }, // condição
        { sourceCode, isConnected: false, connectionAttempts: 0, meta: {} } // valores default se não existir
      )
      return status
    } catch (error) {
      console.error(`⚠️ Error getting or creating status for source ${sourceCode}:`, error.message)
      throw error
    }
  }

  // Leitura direta Modbus: abre, lê e fecha
  private async readModbus(source: any) {
    if (!this.mutexes.has(source.serverCode)) {
      this.mutexes.set(source.serverCode, new Mutex())
    }
    const status = await this.getOrCreateStatus(source.code)
    const mutex = this.mutexes.get(source.serverCode)!
    await mutex.runExclusive(async () => {
      const client = new ModbusRTU.default()
      try {
        client.setTimeout((source.timeout || 3) * 1000)

        if (source.meta.kind === 'modbus-tcp') {
          await client.connectTCP(source.server.meta.host, { port: source.server.meta.port })
        } else if (source.meta.kind === 'modbus-serial') {
          await client.connectRTUBuffered(source.server.meta.port, { baudRate: source.server.meta.baudRate || 9600 })
        }

        client.setID(source.meta.unitId || 1)
        const fn = (client as any)[source.meta.modbusFunction]
        if (!fn) throw new Error(`Function not supported: ${source.meta.modbusFunction}`)

        const result = await fn.call(client, source.meta.dataAddress, source.meta.lengthAddress)
        if (!result?.data) throw new Error('No data received')

        const lastValue = source.meta.lastValue

        const reading = ModbusFormatter(
          result.data,
          source.meta.format,
          source.meta.swapWords,
          source.meta.swapBytes
        )

        let convert = reading

        if (source.meta.isReading) {

          if (source.meta.convert) {
            convert = convertModbusValue({ meta: source.meta.convert, value: reading })
          }

          console.log('Processando leitura', source.name, convert);
        }

        source.meta.lastValue = reading
        status.meta.reading = reading
        status.isConnected = true
        status.lastConnectionAt = DateTime.now()
        status.connectionAttempts = 0
        await status.save()
      } catch (error) {
        console.error(`⚠️ Modbus read failed for source ${source.name}:`, error.message)
        status.isConnected = false
        status.connectionAttempts++
        await status.save()
      } finally {
        if (client.isOpen) client.close(() => { })
      }
    })
  }

  // Leitura HTTP direta
  private async readHttp(source: any) {
    try {
      const response = await fetch(source.meta.url)
      const data = await response.json()
      source.meta.reading = data
      console.log(`🌐 Source ${source.id} ->`, source.meta.reading)
      await source.save()
    } catch (error) {
      console.error(`⚠️ HTTP read failed for source ${source.id}:`, error.message)
    }
  }

  private async stopLoop(sourceId: number) {
    const loop = this.loops.get(sourceId)
    if (loop) {
      clearInterval(loop.interval)
      this.loops.delete(sourceId)

      const source = await Source.findBy('id', sourceId)
      if (!source) return
      console.log(`⏹️ Stopped loop for source ${source.id}`)
      const status = await SourceStatus.findBy('source_code', source.code)
      if (status) {
        status.isConnected = false
        status.lastConnectionAt = null
        status.connectionAttempts = 0
        status.meta = {
          reading: 'Leiruta parada'
        }
      }
      await status?.save()
    }
  }

  private startMonitor() {
    if (this.monitor) return
    this.monitor = setInterval(async () => {
      try {
        this.sources = await Source.query().where('is_active', true).preload('server')
        const allSource = await Source.all()
        const results = await Promise.all(
          allSource.map(async (source) => {
            const status = await SourceStatus.findBy('source_code', source.code)
            return { ...source.serialize(), status: status?.serialize() ?? null }
          })
        )
        transmit.broadcast('sources', results)

        const activeIds = this.sources.map((s) => s.id)
        for (const id of this.loops.keys()) {
          if (!activeIds.includes(id)) this.stopLoop(id)
        }
        this.sources.forEach((s) => this.startOrUpdateLoop(s))
      } catch (error) {
        console.error('⚠️ Monitor error:', error)
      }
    }, 2000)
    console.log(`🛠️ Started source monitor (every 5s)`)
  }

  async shutdown() {
    this.loops.forEach((loop) => clearInterval(loop.interval))
    this.loops.clear()
    if (this.monitor) clearInterval(this.monitor)
    console.log(`🔌 SourceReadProvider shutdown complete`)
  }
}
