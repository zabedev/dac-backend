import ModbusRTU from "modbus-serial";

export interface ModbusConfig {
  host: string;
  port: number;
  timeout?: number;
  unitId?: number;
}

export interface ModbusRequest {
  functionCode: string;
  address: number;
  length: number;
  format?: string;
  swapWords?: boolean;
  swapBytes?: boolean;
}

const FUNCTIONS = {
  readCoils: "readCoils",
  readHoldingRegisters: "readHoldingRegisters", 
  readDiscreteInputs: "readDiscreteInputs",
  readInputRegisters: "readInputRegisters",
  readRegistersEnron: "readRegistersEnron"
} as const;

function applySwap(data: number[], swapWords = false, swapBytes = false): number[] {
  const result: number[] = [];
  
  for (let i = 0; i < data.length; i += 2) {
    let hi = data[i];
    let lo = data[i + 1] ?? 0;

    if (swapWords) [hi, lo] = [lo, hi];
    
    if (swapBytes) {
      hi = ((hi & 0xff) << 8) | ((hi >> 8) & 0xff);
      lo = ((lo & 0xff) << 8) | ((lo >> 8) & 0xff);
    }

    result.push(hi, lo);
  }
  
  return result;
}

function formatData(raw: any[], format?: string, swapWords?: boolean, swapBytes?: boolean): any {
  if (!format) return raw;
  
  const data = typeof raw[0] === 'boolean' ? raw.map(b => b ? 1 : 0) : raw;
  
  switch (format) {
    case "int16": {
      const result = data.map((v: number) => v > 0x7fff ? v - 0x10000 : v);
      return result.length === 1 ? result[0] : result;
    }
    
    case "uint16": {
      return data.length === 1 ? data[0] : data;
    }
    
    case "int32":
    case "uint32":
    case "float32": {
      const swapped = applySwap(data, swapWords, swapBytes);
      const buffer = Buffer.alloc(swapped.length * 2);
      swapped.forEach((v, i) => buffer.writeUInt16BE(v, i * 2));
      
      const result: number[] = [];
      for (let i = 0; i < buffer.length; i += 4) {
        if (i + 3 < buffer.length) {
          let value: number;
          
          if (format === "int32") {
            value = buffer.readInt32BE(i);
          } else if (format === "uint32") {
            value = buffer.readUInt32BE(i);
          } else {
            // 🟢 AJUSTE FLOAT32: Arredonda para 2 casas decimais
            value = parseFloat(buffer.readFloatBE(i).toFixed(2));
          }
          result.push(value);
        }
      }
      return result.length === 1 ? result[0] : result;
    }
    
    case "float64": {
      const swapped = applySwap(data, swapWords, swapBytes);
      const buffer = Buffer.alloc(swapped.length * 2);
      swapped.forEach((v, i) => buffer.writeUInt16BE(v, i * 2));
      
      const result: number[] = [];
      for (let i = 0; i < buffer.length; i += 8) {
        if (i + 7 < buffer.length) {
          // 🟢 AJUSTE FLOAT64: Arredonda para 2 casas decimais
          const value = parseFloat(buffer.readDoubleBE(i).toFixed(2));
          result.push(value);
        }
      }
      return result.length === 1 ? result[0] : result;
    }
    
    case "string": {
      const swapped = applySwap(data, swapWords, swapBytes);
      const buffer = Buffer.alloc(swapped.length * 2);
      swapped.forEach((v, i) => buffer.writeUInt16BE(v, i * 2));
      return buffer.toString("utf8").replace(/\0/g, "");
    }
    
    case "bits": {
      const bits: number[] = [];
      data.forEach((word: number) => {
        for (let i = 0; i < 16; i++) {
          bits.push((word >> i) & 1);
        }
      });
      return bits;
    }
    
    default:
      return data.length === 1 ? data[0] : data;
  }
}

export class ModbusTCPClient {
  private config: Required<ModbusConfig>;

  constructor(config: ModbusConfig) {
    this.config = {
      timeout: 3,
      unitId: 1,
      ...config
    };
  }

  async read(request: ModbusRequest): Promise<any> {
    const client = new ModbusRTU.default();
    
    try {
      await client.connectTCP(this.config.host, { port: this.config.port });
      client.setTimeout(this.config.timeout * 1000);
      client.setID(this.config.unitId);

      const fn = (client as any)[request.functionCode];
      if (!fn) throw new Error(`Function not supported: ${request.functionCode}`);

      const result = await fn.call(client, request.address, request.length);
      
      if (!result?.data) throw new Error("No data received");

      return formatData(
        result.data, 
        request.format, 
        request.swapWords, 
        request.swapBytes
      );
      
    } finally {
      client.close?.();
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = new ModbusRTU.default();
      await client.connectTCP(this.config.host, { port: this.config.port });
      client.close?.();
      return true;
    } catch {
      return false;
    }
  }
}

// Função simples para compatibilidade
export async function modbusRead(config: ModbusConfig & {
  modbusFunction?: string;
  dataAddress: number;
  lengthAddress: number;
  format?: string;
  swapWords?: boolean;
  swapBytes?: boolean;
}) {
  const client = new ModbusTCPClient(config);
  
  return client.read({
    functionCode: config.modbusFunction || FUNCTIONS.readHoldingRegisters,
    address: config.dataAddress,
    length: config.lengthAddress,
    format: config.format,
    swapWords: config.swapWords,
    swapBytes: config.swapBytes
  });
}

export { FUNCTIONS as ModbusFunctions };
export { formatData as ModbusFormatter };
