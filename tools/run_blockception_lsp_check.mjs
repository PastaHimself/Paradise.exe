#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DIAGNOSTIC_SEVERITY = new Map([
  [1, 'error'],
  [2, 'warning'],
  [3, 'information'],
  [4, 'hint'],
]);

function parseArgs(argv) {
  const result = {
    server: '',
    workspace: 'addon',
    report: 'artifacts/blockception-lsp-diagnostics.json',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === '--server') {
      result.server = value ?? '';
      index += 1;
    } else if (arg === '--workspace') {
      result.workspace = value ?? '';
      index += 1;
    } else if (arg === '--report') {
      result.report = value ?? '';
      index += 1;
    } else if (arg === '--timeout-ms') {
      const parsed = Number.parseInt(value ?? '', 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --timeout-ms value: ${value}`);
      }
      result.timeoutMs = parsed;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!result.server) {
    throw new Error('Missing required --server argument.');
  }
  if (!result.workspace) {
    throw new Error('Missing required --workspace argument.');
  }
  if (!result.report) {
    throw new Error('Missing required --report argument.');
  }

  return result;
}

function githubEscape(value) {
  return String(value)
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

function githubPropertyEscape(value) {
  return githubEscape(value).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

function severityName(severity) {
  return DIAGNOSTIC_SEVERITY.get(severity) ?? 'information';
}

function toRelativeFile(uri, repositoryRoot) {
  try {
    if (uri.startsWith('file:')) {
      const filePath = fileURLToPath(uri);
      return path.relative(repositoryRoot, filePath).split(path.sep).join('/');
    }
  } catch {
    // Fall through and keep the original URI.
  }
  return uri;
}

function formatCode(code) {
  if (code === undefined || code === null || code === '') {
    return '';
  }
  if (typeof code === 'object') {
    return JSON.stringify(code);
  }
  return String(code);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repositoryRoot = process.cwd();
  const serverPath = path.resolve(repositoryRoot, args.server);
  const workspacePath = path.resolve(repositoryRoot, args.workspace);
  const reportPath = path.resolve(repositoryRoot, args.report);

  if (!existsSync(serverPath)) {
    throw new Error(`Blockception language server bundle not found: ${serverPath}`);
  }
  if (!existsSync(workspacePath)) {
    throw new Error(`Add-on workspace not found: ${workspacePath}`);
  }

  const workspaceUri = pathToFileURL(workspacePath).href;
  const workspaceFolders = [{ uri: workspaceUri, name: path.basename(workspacePath) || 'addon' }];
  const settings = {
    Education: { Enable: false },
    Diagnostics: {
      Enable: true,
      Lang: true,
      Json: true,
      Mcfunctions: true,
      Objectives: true,
      Tags: true,
    },
    Plugin: { CodeLens: false },
    Completion: {
      JSON: false,
      Lang: {
        Dynamic: false,
        Comments: false,
      },
    },
    InlayHints: { Enable: false },
    InlineValues: { Enable: false },
  };

  const server = spawn(process.execPath, [serverPath, '--stdio'], {
    cwd: workspacePath,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let nextRequestId = 1;
  let stdoutBuffer = Buffer.alloc(0);
  let finished = false;
  let traversalToken = null;
  let traversalStarted = false;
  let traversalResolve;
  let traversalReject;
  const pendingRequests = new Map();
  const diagnosticsByUri = new Map();
  const serverStderr = [];

  const traversalDone = new Promise((resolve, reject) => {
    traversalResolve = resolve;
    traversalReject = reject;
  });

  const timeout = setTimeout(() => {
    traversalReject(
      new Error(`Timed out after ${args.timeoutMs} ms waiting for Blockception's workspace diagnostic pass.`),
    );
  }, args.timeoutMs);

  function send(message) {
    const json = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n`;
    server.stdin.write(header, 'ascii');
    server.stdin.write(json, 'utf8');
  }

  function respond(id, result = null) {
    send({ jsonrpc: '2.0', id, result });
  }

  function request(method, params) {
    const id = nextRequestId;
    nextRequestId += 1;
    send({ jsonrpc: '2.0', id, method, params });

    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject, method });
    });
  }

  function notify(method, params) {
    send({ jsonrpc: '2.0', method, params });
  }

  function handleServerRequest(message) {
    const { id, method, params } = message;

    if (method === 'workspace/workspaceFolders') {
      respond(id, workspaceFolders);
      return;
    }

    if (method === 'workspace/configuration') {
      const items = Array.isArray(params?.items) ? params.items : [];
      respond(
        id,
        items.map((item) => (item?.section === 'BC-MC' || !item?.section ? settings : null)),
      );
      return;
    }

    if (
      method === 'window/workDoneProgress/create' ||
      method === 'client/registerCapability' ||
      method === 'client/unregisterCapability' ||
      method === 'workspace/semanticTokens/refresh' ||
      method === 'workspace/inlayHint/refresh' ||
      method === 'workspace/codeLens/refresh' ||
      method === 'workspace/diagnostic/refresh'
    ) {
      respond(id, null);
      return;
    }

    if (method === 'workspace/applyEdit') {
      respond(id, { applied: false, failureReason: 'CI diagnostic client is read-only.' });
      return;
    }

    if (method === 'window/showMessageRequest') {
      respond(id, null);
      return;
    }

    console.warn(`Blockception server requested unsupported method ${method}; replying with null.`);
    respond(id, null);
  }

  function handleNotification(message) {
    if (message.method === 'textDocument/publishDiagnostics') {
      const uri = message.params?.uri;
      if (typeof uri === 'string') {
        diagnosticsByUri.set(uri, Array.isArray(message.params?.diagnostics) ? message.params.diagnostics : []);
      }
      return;
    }

    if (message.method === '$/progress') {
      const token = message.params?.token;
      const value = message.params?.value;

      if (value?.kind === 'begin' && value?.title === 'Traversing all') {
        traversalToken = token;
        traversalStarted = true;
        console.log('Blockception: workspace traversal started.');
        return;
      }

      if (traversalStarted && token === traversalToken && value?.kind === 'end') {
        console.log('Blockception: workspace traversal and diagnostics finished.');
        traversalResolve();
      }
      return;
    }

    if (message.method === 'window/logMessage' || message.method === 'window/showMessage') {
      const text = message.params?.message;
      if (text) {
        console.log(`Blockception: ${text}`);
      }
    }
  }

  function handleMessage(message) {
    if (message && Object.hasOwn(message, 'method')) {
      if (Object.hasOwn(message, 'id')) {
        handleServerRequest(message);
      } else {
        handleNotification(message);
      }
      return;
    }

    if (message && Object.hasOwn(message, 'id')) {
      const pending = pendingRequests.get(message.id);
      if (!pending) {
        return;
      }
      pendingRequests.delete(message.id);
      if (Object.hasOwn(message, 'error')) {
        pending.reject(new Error(`${pending.method} failed: ${JSON.stringify(message.error)}`));
      } else {
        pending.resolve(message.result);
      }
    }
  }

  function parseMessages() {
    while (true) {
      const headerEnd = stdoutBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        return;
      }

      const header = stdoutBuffer.subarray(0, headerEnd).toString('ascii');
      const match = /(?:^|\r\n)Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        throw new Error(`Invalid LSP header from Blockception server: ${header}`);
      }

      const contentLength = Number.parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;
      if (stdoutBuffer.length < bodyEnd) {
        return;
      }

      const body = stdoutBuffer.subarray(bodyStart, bodyEnd).toString('utf8');
      stdoutBuffer = stdoutBuffer.subarray(bodyEnd);
      handleMessage(JSON.parse(body));
    }
  }

  server.stdout.on('data', (chunk) => {
    stdoutBuffer = Buffer.concat([stdoutBuffer, chunk]);
    try {
      parseMessages();
    } catch (error) {
      traversalReject(error);
    }
  });

  server.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    serverStderr.push(text);
    process.stderr.write(text);
  });

  server.on('error', (error) => {
    traversalReject(error);
  });

  server.on('exit', (code, signal) => {
    if (!finished && code !== 0) {
      traversalReject(
        new Error(
          `Blockception language server exited before validation completed (code=${code}, signal=${signal ?? 'none'}).`,
        ),
      );
    }
  });

  try {
    await request('initialize', {
      processId: process.pid,
      clientInfo: {
        name: 'Paradise.exe GitHub Actions Bedrock checker',
        version: '1.0.0',
      },
      rootUri: workspaceUri,
      workspaceFolders,
      capabilities: {
        workspace: {
          configuration: true,
          workspaceFolders: true,
          didChangeConfiguration: { dynamicRegistration: true },
          didChangeWatchedFiles: { dynamicRegistration: true },
        },
        window: {
          workDoneProgress: true,
        },
        textDocument: {
          publishDiagnostics: {
            relatedInformation: true,
            versionSupport: true,
            codeDescriptionSupport: true,
            dataSupport: true,
          },
        },
      },
      initializationOptions: {},
      trace: 'off',
    });

    notify('initialized', {});
    await traversalDone;

    // Let final publishDiagnostics notifications flush after the progress reporter closes.
    await new Promise((resolve) => setTimeout(resolve, 750));

    const diagnostics = [];
    for (const [uri, items] of diagnosticsByUri.entries()) {
      const file = toRelativeFile(uri, repositoryRoot);
      for (const item of items) {
        diagnostics.push({
          file,
          uri,
          severity: item.severity ?? 3,
          severityName: severityName(item.severity ?? 3),
          code: item.code ?? null,
          source: item.source ?? null,
          message: item.message ?? '',
          range: item.range ?? null,
          relatedInformation: item.relatedInformation ?? null,
        });
      }
    }

    diagnostics.sort((left, right) => {
      const fileComparison = left.file.localeCompare(right.file);
      if (fileComparison !== 0) return fileComparison;
      const leftLine = left.range?.start?.line ?? 0;
      const rightLine = right.range?.start?.line ?? 0;
      if (leftLine !== rightLine) return leftLine - rightLine;
      return (left.range?.start?.character ?? 0) - (right.range?.start?.character ?? 0);
    });

    const summary = {
      errors: diagnostics.filter((item) => item.severity === 1).length,
      warnings: diagnostics.filter((item) => item.severity === 2).length,
      information: diagnostics.filter((item) => item.severity === 3).length,
      hints: diagnostics.filter((item) => item.severity === 4).length,
      total: diagnostics.length,
      filesWithDiagnostics: new Set(diagnostics.map((item) => item.file)).size,
    };

    mkdirSync(path.dirname(reportPath), { recursive: true });
    writeFileSync(
      reportPath,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          blockceptionRevision: process.env.BLOCKCEPTION_REVISION ?? null,
          workspace: path.relative(repositoryRoot, workspacePath).split(path.sep).join('/'),
          summary,
          diagnostics,
          serverStderr: serverStderr.join(''),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );

    for (const diagnostic of diagnostics) {
      const line = (diagnostic.range?.start?.line ?? 0) + 1;
      const column = (diagnostic.range?.start?.character ?? 0) + 1;
      const code = formatCode(diagnostic.code);
      const label = code ? `[${code}] ` : '';
      const message = `${label}${diagnostic.message}`;

      console.log(`${diagnostic.file}:${line}:${column} ${diagnostic.severityName}: ${message}`);

      if (diagnostic.severity === 1 || diagnostic.severity === 2) {
        const command = diagnostic.severity === 1 ? 'error' : 'warning';
        console.log(
          `::${command} file=${githubPropertyEscape(diagnostic.file)},line=${line},col=${column}::${githubEscape(message)}`,
        );
      }
    }

    console.log(
      `Blockception diagnostics: ${summary.errors} error(s), ${summary.warnings} warning(s), ` +
        `${summary.information} info, ${summary.hints} hint(s) across ${summary.filesWithDiagnostics} file(s).`,
    );
    console.log(`Diagnostic report: ${path.relative(repositoryRoot, reportPath).split(path.sep).join('/')}`);

    try {
      await request('shutdown', null);
      notify('exit', null);
    } catch (error) {
      console.warn(`Blockception server shutdown warning: ${error.message}`);
    }

    finished = true;
    clearTimeout(timeout);

    if (summary.errors > 0) {
      process.exitCode = 1;
    }
  } finally {
    finished = true;
    clearTimeout(timeout);
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(`Blockception CI check failed: ${error.stack ?? error.message}`);
  process.exitCode = 2;
});
