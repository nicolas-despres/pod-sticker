
import {
  CoreV1Api,
  V1Pod,
  PatchUtils,
} from "@kubernetes/client-node"

const NAMESPACE = process.env.NAMESPACE || 'default'
import kc from "./kubeconfig"
const k8sApi = kc.makeApiClient(CoreV1Api)
import logger from "./logger"

const DEBUG = false

export async function setNotToEvict(pod: V1Pod) {
  // This annotation will be removed by wyde autoscaler when the users leave the pods
  const patch = [
    {
      "op": "replace",
      "path": "/metadata/annotations",
      "value": {
        ...(pod.metadata.annotations || {}),
        "cluster-autoscaler.kubernetes.io/safe-to-evict": "false",
      }
    },
  ]
  const options = { "headers": { "Content-type": PatchUtils.PATCH_FORMAT_JSON_PATCH } }
  return k8sApi.patchNamespacedPod(pod.metadata.name, NAMESPACE, patch, undefined, undefined, undefined, undefined, options).catch(
    (e) => {
      logger.error(`Pod ${pod.metadata.name} could not be patched via the kubernetes API. Check you have the correct rights. ${e.message}`)
    }
  )
}

export default class RegisteredPod {
  sessions: Set<string> = new Set()
  private source: V1Pod
  constructor(pod: V1Pod) {
    this.source = pod
  }
  update(pod: V1Pod) {
    this.source = pod
  }
  async registerSession(id: string): Promise<void> {
    await setNotToEvict(this.source)
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