
import {
  V1Pod,
} from "@kubernetes/client-node"

const DEBUG = false

export default class RegisteredPod {
  sessions: Set<string> = new Set()
  private source: V1Pod
  constructor(pod: V1Pod) {
    this.source = pod
  }
  update(pod: V1Pod) {
    this.source = pod
  }
  registerSession(id: string) {
    this.sessions.add(id)
  }
  get name(): string {
    return this.source.metadata.name
  }
  get ip(): string {
    if (DEBUG) {
      return "localhost"
    }
    return this.source.status.podIP
  }
  get status() {
    if (DEBUG) {
      return "Running"
    }
    return this.source.status.phase
  }
  get running() {
    return this.status == "Running"
  }
  get port(): number {
    if (DEBUG) {
      return 9944
    }
    return this.source.spec?.containers[0].ports[0].containerPort
  }
  get nbSessions(): number {
    return this.sessions.size
  }
  toString() {
    return `${this.ip}:${this.port}`
  }
  toJSON() {
    var result: Object = {};
    for (var x in this) {
      if (x !== "source") {
        result[x.toString()] = this[x];
      }
    }
    for (var prop of Object.getOwnPropertyNames(RegisteredPod.prototype)
    .map(key => [key, Object.getOwnPropertyDescriptor(RegisteredPod.prototype, key)])
      .filter(([key, descriptor]) => typeof (descriptor as PropertyDescriptor)?.get === 'function')
      .map(([key]) => key)) {
      result[prop.toString()] = this[prop.toString()]
    }
    return result;
  }
}