import http, { ServerResponse, IncomingMessage } from "http"
import httpProxy from "http-proxy"
import RegisteredPod from "./RegisteredPod"
export const pods: Map<string, RegisteredPod> = new Map()
import watcher from "./podWatch"
import logger from "./logger"

const COOKIE_NAME = process.env.COOKIE_NAME || 'wydeweb'
const PORT = 9000

//Use below snippet to debug the proxy
/*
pods
pods["localhost"] = {
  status: "Running",
  ip: "localhost",
  port: 9944,
}*/
watcher()

require("process").on("uncaughtException", (e) => {
  logger.error(e)
})

function getAvailablePod(): RegisteredPod | undefined {
  return [...pods.entries()].map(value => value[1])
    .filter((pod) => pod.running)
    .sort((a, b) => a.nbSessions - b.nbSessions)[0]
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

// Listen for the `error` event on `proxy`.
proxy.on('error', function (err, req, res: ServerResponse) {
  res.writeHead(500, {
    'Content-Type': 'text/plain'
  })

  logger.error(err.message, { client: req.headers["x-auth-request-user"] })
  res.end('Uoh! Something went wrong. ' + err?.message + " " + err.name)
})

proxy.on(
  "proxyRes",
  (
    proxyRes: IncomingMessage,
    req: IncomingMessage,
    res: ServerResponse
  ) => {
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
  logger.error("No pod available", { code: 503 })
  res.writeHead(503, { "Content-Type": "text/plain" })
  res.write("no pod available")
  res.end()
}

function newSessionId(): string {
  return (Math.random() + 1).toString(36).substring(7)
}

var server = http.createServer(async function (req, res) {

  // Routing based on affinity cookie
  const cookies = req?.headers["cookie"]?.split("; ") || []
  const affinityCookie = cookies.find((name) => name.startsWith(COOKIE_NAME))
  let pod: RegisteredPod

  if (affinityCookie) {
    const podAffinity = affinityCookie.split("=")[1]
    pod = pods.get(podAffinity)
  }

  const sessionId = req.headers["x-auth-request-user"] || newSessionId()
  if (!pod || !pod.running) {
    pod = getAvailablePod()
    if (pod) {
      req.headers[COOKIE_NAME] = pod.name
      logger.info(`routing new session for ${sessionId} to ${pod.name}`, { client: sessionId })
      await pod.registerSession(sessionId.toString())
    }
  }
  if (!pod || !pod.running) {
    sendNoPodAvailable(res)
    return
  }
  const target = `http://${pod.ip}:${pod.port}`

  proxy.web(req, res, {
    target,
  }, function (err: any) {
    logger.error(`Could not get a response from ${pod?.name} "${err.message}"`, { client: sessionId, stack: "proxy.web" })
    res.writeHead(500, { "Content-Type": "text/plain" })
    res.write("No response from server", err?.code, err?.message)
    res.end()
  })

})

logger.info(`listening on port ${PORT}`)
server.listen(PORT)
