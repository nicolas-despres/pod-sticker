import {
  Watch,
  ListWatch,
  CoreV1Api,
} from "@kubernetes/client-node"
import { exit } from "process"

const POD_NAME_SELECTOR = process.env.POD_NAME_SELECTOR || "wydeweb-dpl"
const NAMESPACE = process.env.NAMESPACE || 'acpt1'
import RegisteredPod from "./RegisteredPod"

import { pods } from "./server"
import kc from "./kubeconfig"
import logger from "./logger"

const k8sApi = kc.makeApiClient(CoreV1Api)

const listFn = () => {
  return k8sApi.listNamespacedPod(NAMESPACE).catch((e) => {
    logger.error(e)
    exit(1)
  })
}
const path = "/api/v1/pods"
const watch = new Watch(kc)
const listWatch = new ListWatch(path, watch, listFn)

const watcher = () => {
  listWatch.on("delete", (pod) => {
    if (pods.has(pod.metadata.name)) {
      logger.info("Deleting " + pod.metadata.name)
      pods.delete(pod.metadata.name)
    }
  })
  listWatch.on("add", (pod) => {
    updatePod(pod)
  })
  listWatch.on("update", (pod) => {
    updatePod(pod)
  })

  function updatePod(pod) {
    if (pod.metadata.name.indexOf(POD_NAME_SELECTOR) > -1) {
      logger.info("Updating " + pod.metadata.name)
      let registeredPod: RegisteredPod
      if (pods.has(pod.metadata.name)) {
        registeredPod = pods.get(pod.metadata.name)
        registeredPod.update(pod)
      } else {
        pods.set(pod.metadata.name, new RegisteredPod(pod))
      }
      Array.from(pods.entries()).map((entry) => logger.info(`pod '${entry[1].name}' (${entry[1].status}) registered ${entry[1].sessions.size} session(s) (do not reflect active sessions)`))
    }
  }
}

export default watcher


