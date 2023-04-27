import chalk from "chalk";
import { Color } from "chalk";

export default class Logger{
    private readonly name: string

    public constructor(name: string, private readonly color: typeof Color = 'whiteBright'){
        this.name = name
    }

    public log(...args: any[]) {
        console.log(`[${chalk.whiteBright(new Date().toLocaleTimeString())}] <${chalk.cyanBright(this.name)}>`, chalk[this.color](...args));
    }

    public warn(...args: any[]) {
        console.log(`[${chalk.whiteBright(new Date().toLocaleTimeString())}] <${chalk.yellowBright(this.name)}>`, chalk[this.color](...args));
    }

    public err(...args: any[]) {
        console.log(`[${chalk.whiteBright(new Date().toLocaleTimeString())}] <${chalk.redBright(this.name)}>`, chalk[this.color](...args));
    }
}