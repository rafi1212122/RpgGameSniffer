import acfg from "acfg";

export enum VerboseLevel {
    NORMAL = 0,
    DEBUG = 1,
}

export default acfg({
    LOG_LEVEL: VerboseLevel.NORMAL,
    REAL_SERVER: {
        SERVER_IP: "127.0.0.1",
        SERVER_PORT: 22102,
    },
    PROXY_SERVER: {
        SERVER_IP: "127.0.0.1",
        SERVER_PORT: 23301,
    },
    DUMP_FILE: "dump.json"
}, { logMissing: true })