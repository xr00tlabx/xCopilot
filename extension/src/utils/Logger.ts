/**
 * Sistema de logging centralizado
 */

export class Logger {
    private static outputChannel: any = null;

    static init(outputChannel: any) {
        this.outputChannel = outputChannel;
    }

    static info(message: string, ...args: any[]) {
        const log = `[INFO] ${message}`;
        console.log(log, ...args);
        this.outputChannel?.appendLine(log);
    }

    static error(message: string, error?: any) {
        const log = `[ERROR] ${message}`;
        console.error(log, error);
        this.outputChannel?.appendLine(log);
        if (error) {
            this.outputChannel?.appendLine(JSON.stringify(error, null, 2));
        }
    }

    static warn(message: string, ...args: any[]) {
        const log = `[WARN] ${message}`;
        console.warn(log, ...args);
        this.outputChannel?.appendLine(log);
    }

    static debug(message: string, ...args: any[]) {
        const log = `[DEBUG] ${message}`;
        console.log(log, ...args);
        this.outputChannel?.appendLine(log);
    }
}
