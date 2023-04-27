// @ts-ignore
import UDPProxy from 'udp-proxy';
import Config, { VerboseLevel } from '../utils/Config';
import Logger from '../utils/Logger';
import { KCP } from 'node-kcp-token';
import Packet from './Packet';
import { readFileSync, existsSync } from 'fs'
import CmdID from './proto/CmdID';

const c = new Logger('Proxy')

export default class ProxyServer {
    private static instance: ProxyServer;
    private readonly server
    private kcpobj = new Map<string, KCP>()
    public readonly dump: DumpScheme[] = []
    public key = existsSync(__dirname + '/proto/key.bin') ? readFileSync(__dirname + '/proto/key.bin') : 0

    public static getInstance(): ProxyServer {
        if (!ProxyServer.instance) {
            ProxyServer.instance = new ProxyServer();
        }
        return ProxyServer.instance;
    }

    private constructor() {
        this.kcpUpdateLoop()
        this.server = UDPProxy.createServer({
            address: Config.REAL_SERVER.SERVER_IP,
            port: Config.REAL_SERVER.SERVER_PORT,
            localaddress: Config.PROXY_SERVER.SERVER_IP,
            localport: Config.PROXY_SERVER.SERVER_PORT
        })
        
        this.server.on('listening', (details: any) => {
            c.log(`Proxy is ready on ${details.server.address}:${details.server.port}`);
            c.log(`Traffic is forwarded to ${details.target.address}:${details.target.port}`);
        })

        if(existsSync(Config.DUMP_FILE)){
            c.warn("Dump file already exists and will be overwritten once packets are sniffed!".toUpperCase())
        }

        this.server.on('message', (m: Buffer, s: RemoteInfo) => this.onMessage(m, s));
        this.server.on('proxyMsg', (m: Buffer, s: RemoteInfo) => this.onMessage(m, s));
    }

    private onMessage(message: Buffer, sender: RemoteInfo) {
        if(message.length<=20) return
        const senderId = `${sender.address}:${sender.port}`
        let kcpobj = this.kcpobj.get(senderId)
        if(!kcpobj) {
            this.kcpobj.set(senderId, new KCP(message.readUInt32LE(0), message.readUInt32LE(4), sender))
            kcpobj = this.kcpobj.get(senderId) as KCP
            const hrTime = process.hrtime();
            kcpobj.update(hrTime[0] * 1000000 + hrTime[1] / 1000);
            // kcpobj.nodelay(1, 5, 2, 0);
            kcpobj.wndsize(256, 256);
            c.warn(`Regeistered KCP with ${message.readUInt32LE(0)}, ${message.readUInt32LE(4)} for ${sender.address}:${sender.port}`)
        }
        kcpobj.input(message)
    }

    private kcpUpdateLoop() {
        const hrTime = process.hrtime();
        for (const kcpobj of this.kcpobj.values()) {
            kcpobj.update(hrTime[0] * 1000000 + hrTime[1] / 1000);
            let recv;
            do {
                recv = kcpobj.recv();
                if (!recv) break;
                
                if(Buffer.isBuffer(this.key)){
                    if(Config.LOG_LEVEL>VerboseLevel.NORMAL) c.warn("Encrypted:", recv.toString("hex"));
                    for (let i = 0; i < recv.length; i++) {
                        recv.writeUInt8(recv.readUInt8(i) ^ this.key.readUInt8(i % this.key.length), i);
                    }
                }

                if (Packet.isValid(recv)) {
                    const packet = new Packet(recv)
                    c.log(`${CmdID[packet.cmdId]}: ${JSON.stringify(packet.body, undefined, '\t')}`)
                    packet.write()
                } else {
                    c.warn(recv.toString("hex"));
                    c.warn("Invalid packet received");
                }
            } while (recv)
        }

        setTimeout(() => this.kcpUpdateLoop(), 1);
    }
}

export interface RemoteInfo {
    address: string;
    family: 'IPv4' | 'IPv6';
    port: number;
    size: number;
}

export interface DumpScheme {
    cmdId: number
    packetName: string
    raw: string
    body: any
    ext: any
}