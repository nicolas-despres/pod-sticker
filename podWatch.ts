import {
  KubeConfig,
  Watch,
  ListWatch,
  CoreV1Api,
  V1Pod,
} from "@kubernetes/client-node"
import { exit } from "process"

const POD_NAME_SELECTOR = process.env.POD_NAME_SELECTOR || "wydeweb-dpl"
const NAMESPACE = process.env.NAMESPACE || 'default'
import RegisteredPod from "./RegisteredPod"

import { pods} from "./server"

const kc = new KubeConfig()
kc.loadFromDefault()
const k8sApi = kc.makeApiClient(CoreV1Api)

const listFn = () => {
  return k8sApi.listNamespacedPod(NAMESPACE).catch((e) => {
    console.error(e)
    exit(1)
  })
}
const path = "/api/v1/pods"
const watch = new Watch(kc)
const listWatch = new ListWatch(path, watch, listFn)

const printStatus = () => {
  console.log(Array.from(pods.entries()).map((entry) => entry[1].toJSON()))
}
 
const watcher = () => {
  listWatch.on("delete", (pod) => {
    if (pods.has(pod.metadata.name)) {
      console.log("Deleting", pod.metadata.name)
      pods.delete(pod.metadata.name)
      printStatus()
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
      console.log("Updating", pod.metadata.name)
      let registeredPod: RegisteredPod
      if (pods.has(pod.metadata.name)) {
        registeredPod = pods.get(pod.metadata.name)
        registeredPod.update(pod)
      } else {
        pods.set(pod.metadata.name, new RegisteredPod(pod))
      }
      printStatus()
    }
  }
}

export default watcher


