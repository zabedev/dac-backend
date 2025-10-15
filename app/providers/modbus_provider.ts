// app/Providers/ModbusProvider.ts

import { ApplicationService } from '@adonisjs/core/types'
import Server from '#models/server'
import ModbusRTU from 'modbus-serial'
import { DateTime } from 'luxon'
import { Mutex } from 'async-mutex'
import { EventEmitter } from 'node:events'

interface Connection {
    client: ModbusRTU.default | null
    connected: boolean
    retries: number
    lastError?: string
    reconnecting: boolean
    mutex: Mutex
    cachedServer?: Server
}

export default class ModbusProvider extends EventEmitter {
    private connections = new Map<number, Connection>()
    private INITIAL_DELAY = 1000
    private MAX_DELAY = 30000
    private CHECK_INTERVAL_MS = 10000
    private intervalId: NodeJS.Timeout | null = null

    constructor(protected app: ApplicationService) {
        super() // 👈 inicializa o EventEmitter
    }

    // Registra como singleton
    async register() {
        this.app.container.singleton(ModbusProvider, () => this)
    }

    // Inicializa conexões no boot
    async boot() {
        try {
            const servers = (await Server.query().where('is_active', true)).filter(
                (s) => s.meta && ['modbus-tcp', 'modbus-serial'].includes(s.meta.kind)
            )

            console.log(`🚀 Found ${servers.length} active Modbus servers`)

            for (const s of servers) {
                this.connections.set(s.code, {
                    client: null,
                    connected: false,
                    retries: 0,
                    reconnecting: false,
                    mutex: new Mutex(),
                    cachedServer: s, // cache local
                })
                this.connectServer(s.code)
            }

            this.startMonitor()
        } catch (error) {
            console.error('❌ Boot error in ModbusProvider:', error)
        }
    }

    // Finaliza o monitor
    async shutdown() {
        this.stopMonitor()
        this.connections.forEach((c, id) => {
            if (c.client?.isOpen) c.client.close(() => { })
            this.connections.delete(id)
        })
        console.log('🛑 Modbus provider shutdown complete')
    }

    // Monitor global que sincroniza lista de servidores
    private startMonitor() {
        if (this.intervalId) this.stopMonitor()
        this.intervalId = setInterval(() => this.syncServerList(), this.CHECK_INTERVAL_MS)
    }

    private stopMonitor() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
    }

    // Sincroniza lista de servidores ativos com o banco
    private async syncServerList() {
        try {
            const activeServers = (await Server.query().where('is_active', true)).filter(
                (s) => s.meta && ['modbus-tcp', 'modbus-serial'].includes(s.meta.kind)
            )

            const activeIds = new Set(activeServers.map((s) => s.code))
            const currentIds = Array.from(this.connections.keys())

            // Remove servidores desativados
            for (const id of currentIds) {
                if (!activeIds.has(id)) {
                    await this.disconnectServer(id)
                    this.connections.delete(id)
                    console.log(`🔌 Removed server ${id} (inactive)`)
                }
            }

            // Adiciona ou atualiza conexões
            for (const server of activeServers) {
                const conn = this.connections.get(server.code)
                if (!conn) {
                    this.connections.set(server.code, {
                        client: null,
                        connected: false,
                        retries: 0,
                        reconnecting: false,
                        mutex: new Mutex(),
                        cachedServer: server,
                    })
                    this.connectServer(server.code)
                } else {
                    conn.cachedServer = server // atualiza cache
                    if (!conn.connected && !conn.reconnecting) {
                        this.connectServer(server.code)
                    }
                }
            }
        } catch (error) {
            console.error('⚠️ Error in syncServerList:', error)
        }
    }

    // Conecta um servidor específico com retry infinito (exponencial com teto)
    private async connectServer(serverId: number) {
        const conn = this.connections.get(serverId)
        if (!conn) return

        await conn.mutex.runExclusive(async () => {
            if (conn.reconnecting) return
            conn.reconnecting = true

            const server = conn.cachedServer || (await Server.findBy('code', serverId))
            if (!server || !server.isActive) {
                conn.reconnecting = false
                return
            }

            try {
                const client = new ModbusRTU.default()
                client.setTimeout((server.timeout || 3) * 1000)

                if (server.meta.kind === 'modbus-tcp') {
                    await client.connectTCP(server.meta.host, { port: server.meta.port })
                    this.emit('connected', serverId)
                    conn.client = client
                    conn.connected = true
                    conn.retries = 0
                    conn.lastError = undefined
                    conn.reconnecting = false

                    server.meta.lastConnect = DateTime.now()
                    await server.save()

                    console.log(`✅ Connected to ${server.name} (${server.meta.host}:${server.meta.port})`)
                }
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error)
                conn.connected = false
                conn.lastError = msg
                conn.retries++
                conn.reconnecting = false
                this.emit('disconnected', serverId, error)
                const delay = Math.min(this.INITIAL_DELAY * 2 ** (conn.retries - 1), this.MAX_DELAY)
                console.warn(`⚠️ Connect failed [${server?.name}] (retry ${conn.retries}) -> ${msg}`)

                setTimeout(() => this.connectServer(serverId), delay)
            }
        })
    }

    // Retorna cliente conectado, ou null se não disponível
    async getClient(serverId: number): Promise<ModbusRTU.default | null> {
        const conn = this.connections.get(serverId)
        if (!conn) return null

        // Se não tem cliente válido, tenta reconectar
        if (!conn.client || !conn.connected || !conn.client.isOpen) {
            // limpa conexão antiga
            if (conn.client?.isOpen) {
                conn.client.close(() => { })
            }
            conn.client = null
            conn.connected = false

            // dispara tentativa (mutex impede corrida)
            this.connectServer(serverId)

            // neste ciclo, retorna null para evitar travar leitura
            return null
        }

        return conn.client
    }

    // Desconecta servidor (mantém no mapa para monitor tentar novamente)
    async disconnectServer(serverId: number) {
        const conn = this.connections.get(serverId)
        if (!conn) return
        try {
            if (conn.client?.isOpen) {
                await new Promise(resolve => conn.client!.close(resolve))
            }
        } catch (e) {
            console.warn(`⚠️ Error closing server ${serverId}:`, e)
        }
        conn.client = null
        conn.connected = false
        conn.retries = 0
        conn.reconnecting = false
        console.log(`🔌 Disconnected server ${serverId}`)
    }

    // Status resumido de conexões
    getStatus() {
        const status: Record<number, { connected: boolean; retries: number; lastError?: string; reconnecting: boolean }> = {}
        this.connections.forEach((c, id) => {
            status[id] = {
                connected: c.connected,
                retries: c.retries,
                lastError: c.lastError,
                reconnecting: c.reconnecting,
            }
        })
        return status
    }
}
