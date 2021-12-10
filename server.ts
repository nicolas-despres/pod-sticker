import http, { ServerResponse, IncomingMessage } from "http"
import httpProxy from "http-proxy"
import watcher from "./podWatch"

const COOKIE_NAME = process.env.COOKIE_NAME
const PORT = 9000

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

export const pods: RegisteredPods = {}
const sessions: Sessions = {}

//Use below snippet to debug the proxy
/*pods["localhost"] = {
  status: "Running",
  ip: "localhost",
  port: 8080,
}*/
watcher()

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

function parseCookies(request: IncomingMessage): object {
  var list = {},
    rc = request.headers.cookie

  rc &&
    rc.split(";").forEach(function (cookie) {
      var parts = cookie.split("=")
      list[parts.shift().trim()] = decodeURI(parts.join("="))
    })

  return list
}

proxy.on(
  "proxyRes",
  function (
    proxyRes: IncomingMessage,
    req: IncomingMessage,
    res: ServerResponse
  ) {
    const cookies = parseCookies(req)
    const affinityCookie = cookies[COOKIE_NAME]
    const server = req.headers[COOKIE_NAME]
    if (server && affinityCookie !== server) {
      const setCookieInstruction = `${COOKIE_NAME}=${server}; Path=/`
      if (proxyRes.headers["set-cookie"]) {
        proxyRes.headers["set-cookie"].push(setCookieInstruction)
      } else {
        proxyRes.headers["set-cookie"] = [setCookieInstruction]
      }
    }
  }
)

function sendNoPodAvailable(res: ServerResponse) {
  console.error("no pod available")
  res.writeHead(503, { "Content-Type": "text/plain" })
  res.write("no pod available")
  res.end()
}

var server = http.createServer(function (req, res) {
  // Routing based on affinity cookie
  const cookies = req?.headers["cookie"]?.split("; ") || []
  const cookie = cookies.find((name) => name.startsWith(COOKIE_NAME))
  let pod: RegisteredPod
  if (cookie) {
    const podAffinity = cookie.split("=")[1]
    pod = pods[podAffinity]
    if (pod && process.env.NODE_ENV !== "production") {
      console.log(`Routing ${podAffinity} to`, pod)
    }
  } else {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Cookie not found`, cookies)
    }
  }
  if (!pod || pod.status !== "Running") {
    const targetPod = getAvailablePodKey()
    pod = pods[targetPod]
    req.headers[COOKIE_NAME] = targetPod
    console.log("routing new session to", targetPod)
  }
  if (!pod || pod.status !== "Running") {
    sendNoPodAvailable(res)
    return
  }
  const target = `http://${pod.ip}:${pod.port}`
  proxy.web(req, res, {
    target,
  })
})

console.log(`listening on port ${PORT}`)
server.listen(PORT)
