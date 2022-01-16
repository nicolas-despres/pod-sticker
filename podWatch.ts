import {
  KubeConfig,
  Watch,
  ListWatch,
  CoreV1Api,
} from "@kubernetes/client-node"
import { exit } from "process"
import { pods } from "./server"

const POD_NAME_SELECTOR = process.env.POD_NAME_SELECTOR || "stateful-dpl"
const NAMESPACE = process.env.NAMESPACE || 'default'

const kc = new KubeConfig()
kc.loadFromDefault()
const k8sApi = kc.makeApiClient(CoreV1Api)

const listFn = () => {
  return k8sApi.listNamespacedPod(NAMESPACE).catch((e)=>{
    console.error(e)
    exit(1)
  })
}

const path = "/api/v1/pods"
const watch = new Watch(kc)
const listWatch = new ListWatch(path, watch, listFn)

const watcher = () => {
  listWatch.on("delete", (pod) => {
    if (pods[pod.metadata.name]) {
      console.log("Deleting", pod.metadata.name)
      delete pods[pod.metadata.name]
      console.log(pods)
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
      pods[pod.metadata.name] = {
        ip: pod.status.podIP,
        status: pod.status.phase,
        port: pod?.spec?.containers[0].ports[0].containerPort,
      }
      console.log(pods)
    }
  }
}

export default watcher


