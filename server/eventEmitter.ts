import { EventEmitter } from "node:events";

const eventEmitter = new EventEmitter();

export function emitDatabaseChange(event: string, table: string, data: any) {
  eventEmitter.emit("db_change", { event, table, ...data });
}

export { eventEmitter };
