import {
  KubeConfig,
  Watch,
  ListWatch,
  CoreV1Api,
} from "@kubernetes/client-node"
import http, { ServerResponse } from "http"
import httpProxy from "http-proxy"

const PORT = 9000
const HEADER_NAME = process.env.HEADER_NAME || "x-auth-request-user"
const POD_NAME_SELECTOR = process.env.POD_NAME_SELECTOR || "stateful-dpl"

const kc = new KubeConfig()
kc.loadFromDefault()
const k8sApi = kc.makeApiClient(CoreV1Api)
k8sApi.listPodForAllNamespaces()

export interface RegisteredPods {
  [key: string]: RegisteredPod
}

export interface RegisteredPod {
  status: string
  ip: string
  port: number
}

export interface Sessions {
  [key: string]: string
}

const pods: RegisteredPods = {}
const sessions: Sessions = {}

function nbSessions(podName) {
  return Object.keys(sessions).filter((key) => sessions[key] == podName).length
}

require("process").on("uncaughtException", (e) => {
  console.error(e)
})

function getAvailablePodKey(): string {
  return Object.keys(pods)
    .filter((key) => pods[key].status == "Running")
    .sort((a, b) => nbSessions(a) - nbSessions(b))[0]
}
var proxy = httpProxy.createProxyServer({})

function sendPodAvailable(res: ServerResponse) {
  console.error("no pod available")
  res.writeHead(503, { "Content-Type": "text/plain" })
  res.write("no pod available")
  res.end()
}

var server = http.createServer(function (req, res) {
  const header = req?.headers[HEADER_NAME]
  if (header) {
    const sessionKey: string = header.toString()
    if (!sessions[sessionKey]) {
      const targetPod = getAvailablePodKey()
      if (!targetPod) {
        sendPodAvailable(res)
        return
      }
      if (process.env.NODE_ENV == "development") {
        console.log(`Creating a session for ${sessionKey} on ${targetPod}`)
      }
      sessions[sessionKey] = targetPod
    }
    if (!pods[sessions[sessionKey]]) {
      const targetPod = getAvailablePodKey()
      if (!targetPod) {
        sendPodAvailable(res)
        return
      }
      console.error("Pod not available anymore", sessions[sessionKey])
      console.log(`Assign a new pod for ${sessionKey} on ${targetPod}`)
      sessions[sessionKey] = targetPod
    }
    try {
      const pod = pods[sessions[sessionKey]]
      const target = `http://${pod.ip}:${pod.port}`
      console.log("routing", sessionKey, "to", target)
      proxy.web(req, res, {
        target,
      })
    } catch (e) {
      console.error(e)
    }
  } else {
    const msg = "Missing header: " + HEADER_NAME
    console.error(msg)
    const targetPod = getAvailablePodKey()
    const pod = pods[targetPod]
    const target = `http://${pod.ip}:${pod.port}`
    console.log("routing unknown user to", target)
      proxy.web(req, res, {
        target,
      })
  }
})

console.log(`listening on port ${PORT}`)
server.listen(PORT)

const listFn = () => k8sApi.listPodForAllNamespaces()

const path = "/api/v1/pods"
const watch = new Watch(kc)
const listWatch = new ListWatch(path, watch, listFn)

listWatch.on("delete", (pod) => {
  if (pods[pod.metadata.name]) {
    console.log('Deleting', pod.metadata.name)
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
    console.log('Updating', pod.metadata.name)
    pods[pod.metadata.name] = {
      ip: pod.status.podIP,
      status: pod.status.phase,
      port: pod?.spec?.containers[0].ports[0].containerPort,
    }
    console.log(pods)
  }
}
