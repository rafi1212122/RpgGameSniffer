import Logger from "../utils/Logger";
import ProxyServer from "./ProxyServer";
import CmdID from "./proto/CmdID";
import * as StarRail from './proto/StarRail'
import protobufjs from 'protobufjs'
import { writeFileSync } from 'fs'
import MT19937_64 from "../utils/MT19937_64";
import Config, { VerboseLevel } from "../utils/Config";

const c = new Logger("Packet")

export default class Packet {
    public readonly cmdId: number;
    public readonly data: Buffer;
    public readonly body = {}

    public constructor(raw: Buffer) {
        const metadataLength = raw.readUInt16BE(6);
        this.data = raw.subarray(12 + metadataLength, 12 + metadataLength + raw.readUInt32BE(8));
        this.cmdId = raw.readUInt16BE(4);
        const protoName = CmdID[this.cmdId]

        if(protoName){
            try {
                const Message = StarRail[(protoName as keyof typeof StarRail)] as {
                    "encode": (arg0: any) => protobufjs.Writer;
                    "fromPartial": (arg0: object) => any;
                    "decode": (input: protobufjs.Reader | Uint8Array, length?: number)=> any;
                }
                this.body = Message.decode(this.data);
                
                if(protoName==='PlayerGetTokenScRsp'){
                    let initgen = new MT19937_64();
                    const seed = (this.body as StarRail.PlayerGetTokenScRsp).secretKeySeed

                    if(seed){
                        c.warn("MT64 seed:", BigInt(seed))
                        initgen.seed(BigInt(seed));
                        let key = Buffer.alloc(4096);
                        for (let i = 0; i < 4096; i += 8) {
                            let val = initgen.int64();
                            key.writeBigUInt64BE(val, i)
                        }
                        if(Config.LOG_LEVEL>VerboseLevel.NORMAL) c.warn("New key:", key.toString('hex'))
                        ProxyServer.getInstance().key = key;
                    }
                }
            } catch (e) {
                c.err(`Failed to decode ${protoName}`, `Error: ${e}`);
                c.warn(`Data: ${this.data.toString("hex")}`);
            }
        }else {
            c.err(`Unknown packet id ${this.cmdId}`);
        }
    }

    public static isValid(data: Buffer): boolean {
        const str = data.toString('hex');
        return str.startsWith("9d74c714") && str.endsWith("d7a152c8");
    }

    public write(ext?: any) {
        const proxyServerInstance = ProxyServer.getInstance()
        proxyServerInstance.dump.push({
            cmdId: this.cmdId,
            packetName: CmdID[this.cmdId],
            raw: this.data.toString('hex'),
            body: this.body,
            ext
        })
        writeFileSync(Config.DUMP_FILE, JSON.stringify(proxyServerInstance.dump, null, '\t'), 'utf-8')
    }
}

export type PacketName = keyof typeof CmdID;