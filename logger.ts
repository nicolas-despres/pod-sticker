import { createLogger, format, transports } from 'winston'
const { combine, timestamp, printf } = format

//ErrorLogFormat "[%t] [%logLevel] [pid %P] %F: %E: [client %a] %M"
const consoleFormat = printf(({ level, message, label, timestamp, stack, code, client }) => {
  return `[${timestamp}] [${level}] [pid ${process.pid}] ${stack || ''}: ${code || ''}: [client ${client || ''}] ${message}`
})

const logger = createLogger({
  level: process.env.LOGGER_LEVEL || 'debug',
  format: combine(
    timestamp(),
    consoleFormat,
  ),
  transports: [new transports.Console()]
})

export default logger