import { EventEmitter } from "node:events";
import type { ActivityEvent, ActivityEventName } from "@ai-research-agent/shared";

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function emitActivity(event: ActivityEvent) {
  bus.emit(event.researchId, event);
}

export function onActivity(researchId: string, listener: (event: ActivityEvent) => void) {
  bus.on(researchId, listener);
  return () => bus.off(researchId, listener);
}

export function makeEvent(researchId: string, type: ActivityEventName, message: string, payload?: Record<string, unknown>): ActivityEvent {
  return { researchId, type, message, createdAt: new Date().toISOString(), payload };
}
