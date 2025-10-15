// app/Providers/ModbusProvider.ts

import { ApplicationService } from '@adonisjs/core/types';
import Server from '#models/server';
import ModbusRTU from 'modbus-serial';
import { DateTime } from 'luxon';

interface Connection {
    client: ModbusRTU.default | null;
    connected: boolean;
    retries: number;
    lastError?: string;
    reconnecting: boolean;
}

export default class ModbusProvider {
    private connections = new Map<number, Connection>();
    private MAX_RETRIES = 5;
    private INITIAL_DELAY = 1000;
    private MAX_DELAY = 15000;
    private CHECK_INTERVAL_MS = 5000; // 5 segundos para o monitor
    private intervalId: NodeJS.Timeout | null = null;

    constructor(protected app: ApplicationService) { }

    async register() {
        this.app.container.singleton(ModbusProvider, () => this);
    }

    async boot() {
        try {
            // Inicializa as conexões existentes no boot
            const servers = (await Server.query().where('is_active', true)).filter(
                (s) => s.meta && ['modbus-tcp', 'modbus-serial'].includes(s.meta.kind)
            );
            console.log(`🚀 Found ${servers.length} active servers on boot`);

            for (const s of servers) {

                if (s.meta.kind === 'modbus-tcp') {
                    this.connections.set(s.code, { client: null, connected: false, retries: 0, reconnecting: false });
                    this.connectServer(s.code);
                }
                if (s.meta.kind === 'modbus-serial') {
                    console.log('Servidor Modbus Serial encontrado');
                }
            }
            // Inicia o monitoramento periódico
            this.startMonitor();
        } catch (error) {
            console.error('❌ Boot error in ModbusProvider:', error);
        }
    }

    // Novo: Método de shutdown para limpar o intervalo
    async shutdown() {
        this.stopMonitor();
        // Opcional: Desconectar todos os clientes aqui, se necessário.
    }

    // ----------------------------------------------------------------------------------
    // --- MONITORAMENTO PROATIVO ---
    // ----------------------------------------------------------------------------------

    private startMonitor() {
        if (this.intervalId) {
            this.stopMonitor();
        }
        console.log(`👀 Starting Modbus configuration monitor (interval: ${this.CHECK_INTERVAL_MS}ms)...`);
        this.intervalId = setInterval(() => this.syncServerList(), this.CHECK_INTERVAL_MS);
    }

    private stopMonitor() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('🛑 Modbus configuration monitor stopped.');
        }
    }

    private async syncServerList() {
        try {
            const activeServers = (await Server.query().where('is_active', true)).filter(
                (s) => s.meta && ['modbus-tcp', 'modbus-serial'].includes(s.meta.kind)
            );
            
            const activeServerIds = new Set(activeServers.map((server) => {
                if (server.meta.kind === 'modbus-tcp' || server.meta.kind === 'modbus-serial') { return server.code; }
            }));

            const currentConnectionIds = Array.from(this.connections.keys());

            // 1. Desconectar servidores desativados ou removidos
            for (const serverId of currentConnectionIds) {
                if (!activeServerIds.has(serverId)) {
                    await this.disconnectServer(serverId);
                    this.connections.delete(serverId);
                    console.log(`🔌 Server ID ${serverId} removed (inactive/deleted).`);
                }
            }

            // 2. Conectar ou manter a conexão de servidores ativos
            for (const server of activeServers) {
                const conn = this.connections.get(server.code);

                if (!conn) {
                    // Novo servidor detectado: Inicia a conexão
                    this.connections.set(server.code, { client: null, connected: false, retries: 0, reconnecting: false });
                    this.connectServer(server.code);
                } else if (!conn.connected && !conn.reconnecting && conn.retries < this.MAX_RETRIES) {
                    // Servidor ativo que perdeu a conexão: Tenta reconectar imediatamente (além da lógica de setTimeout)
                    this.connectServer(server.code);
                }
                // Se estiver conectado (conn.connected = true), não faz nada.
            }
        } catch (error) {
            console.error('❌ Error during server configuration synchronization:', error.message);
        }
    }

    // ----------------------------------------------------------------------------------
    // --- CONEXÃO E GET CLIENT (Lógica original, com pequenos ajustes) ---
    // ----------------------------------------------------------------------------------

    private async connectServer(serverId: number) {
        // ... (Lógica original de connectServer)
        const conn = this.connections.get(serverId);
        if (!conn) {
            console.error(`❌ Connection state not found for server ID: ${serverId}`);
            return;
        }

        if (conn.reconnecting) {
            return;
        }

        conn.reconnecting = true;
        const server = await Server.findBy('code', serverId);

        if (!server || !server.isActive) {
            conn.reconnecting = false;
            console.log(server);
            return;
        }

        try {
            const client = new ModbusRTU.default();
            client.setTimeout((server.timeout || 3) * 1000);

            if (server.meta.kind === 'modbus-tcp') {
                await client.connectTCP(server.meta.host, { port: server.meta.port });
                this.connections.set(serverId, { client, connected: true, retries: 0, reconnecting: false });
                server.meta.lastConnect = DateTime.now()
                await server.save()
                console.log(`✅ Connected: ${server.name} (${server.meta.host}:${server.meta.port})`);
            }

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            conn.connected = false;
            conn.retries++;
            conn.lastError = msg;
            conn.reconnecting = false;
            console.warn(`⚠️ Failed connect [${server.name}] (try ${conn.retries}): ${msg}`);

            if (conn.retries <= this.MAX_RETRIES) {
                const delay = Math.min(this.INITIAL_DELAY * Math.pow(2, conn.retries - 1), this.MAX_DELAY);
                setTimeout(() => this.connectServer(serverId), delay);
            } else {
                console.error(`❌ Max retries reached for server ${server.name}`);
            }
        }
    }

    async getClient(serverId: number): Promise<ModbusRTU.default | null> {
        const conn = this.connections.get(serverId);
        if (!conn) {
            // O servidor não está no mapa. O monitor cuidará disso em breve.
            return null;
        }

        // Se a porta não estiver aberta, o monitor deve ser avisado e a conexão deve ser limpa.
        if (conn.client && !conn.client.isOpen) {
            console.warn(`⚠️ Client ${serverId} reported 'Port Not Open'. Forcing cleanup.`);
            // Limpa o estado. O monitor fará a reconexão na próxima checagem (5s).
            await this.disconnectServer(serverId);
            return null;
        }

        // Se a conexão não estiver ativa (mas client.isOpen é true ou client é null)
        if (!conn.connected || !conn.client || conn.reconnecting) {
            // Não inicie a reconexão aqui. O syncServerList fará isso a cada 5s.
            return null;
        }

        return conn.client;
    }

    async disconnectServer(serverId: number) {
        const conn = this.connections.get(serverId);

        if (conn?.client) {
            if (conn.client.isOpen) {
                conn.client.close(() => { });
            }
            // Manter o estado para que o monitor saiba que o servidor existe.
            this.connections.set(serverId, { client: null, connected: false, retries: 0, reconnecting: false });
            const server = await Server.findBy('code', serverId);
            if (server) {
                server.meta.lastConnect = null
                await server.save()
            }
            console.log(`🔌 Disconnected server ${serverId}`);
        }
    }

    getStatus() {
        const status: Record<number, { connected: boolean; retries: number; lastError?: string; reconnecting: boolean }> = {};
        this.connections.forEach((c, id) => {
            status[id] = {
                connected: c.connected,
                retries: c.retries,
                lastError: c.lastError,
                reconnecting: c.reconnecting,
            };
        });
        return status;
    }
}