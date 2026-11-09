import { EventEmitter } from "node:events";

const eventEmitter = new EventEmitter();

export function emitDatabaseChange(event: string, table: string, data: any) {
  console.log("[eventEmitter] Emitting db_change:", { event, table, data });
  eventEmitter.emit("db_change", { event, table, ...data });
}

export { eventEmitter };
