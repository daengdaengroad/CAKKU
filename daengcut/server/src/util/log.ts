type Level = 'debug' | 'info' | 'warn' | 'error';

const COLOR: Record<Level, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
};

function emit(level: Level, scope: string, msg: string, extra?: unknown) {
  const time = new Date().toISOString().slice(11, 19);
  const line = `${COLOR[level]}${time} ${level.toUpperCase().padEnd(5)}\x1b[0m [${scope}] ${msg}`;
  if (extra === undefined) console.log(line);
  else console.log(line, extra);
}

export function logger(scope: string) {
  return {
    debug: (m: string, e?: unknown) => emit('debug', scope, m, e),
    info: (m: string, e?: unknown) => emit('info', scope, m, e),
    warn: (m: string, e?: unknown) => emit('warn', scope, m, e),
    error: (m: string, e?: unknown) => emit('error', scope, m, e),
  };
}
