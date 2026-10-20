// GitHub's own MCP server, as a client (../README.md, The agent's tools): its tools listed once and kept in memory, each
// call made with the token of the account it goes as. Kulisa's MCP server gives them to the agent.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import pkg from '../../../package.json' with { type: 'json' };
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

// Its toolsets Kulisa passes on (issue #48): about a hundred tools in all would fill the agent's context every turn.
const TOOLSETS = 'repos,issues,pull_requests';

class Tools {
  url: string; token: (account: string) => Promise<string | null>;
  list: Tool[] = []; // as GitHub's server listed them last
  clients = new Map<string, { token: string; client: Promise<Client> }>(); // an account's connection, while its token is the same
  constructor(url: string, token: (account: string) => Promise<string | null>) { this.url = url; this.token = token; }

  async connect(account: string) {
    const token = await this.token(account);
    if (!token) throw new Error('its GitHub account is signed out: the human signs in to it again in Settings → GitHub');
    const had = this.clients.get(account);
    if (had?.token === token) return had.client;
    if (had) void had.client.then((c) => c.close(), () => {});
    const client = (async () => {
      const c = new Client({ name: 'kulisa', version: pkg.version });
      await c.connect(new StreamableHTTPClientTransport(new URL(this.url), { requestInit: { headers: { authorization: `Bearer ${token}`, 'x-mcp-toolsets': TOOLSETS } } }));
      return c;
    })();
    this.clients.set(account, { token, client });
    client.catch(() => { if (this.clients.get(account)?.client === client) this.clients.delete(account); });
    return client;
  }
  // The tools, as GitHub's server lists them to this account (the same for every account: listed once).
  async load(account: string) {
    const c = await this.connect(account), all: Tool[] = [];
    let cursor: string | undefined;
    do { const r = await c.listTools(cursor ? { cursor } : undefined); all.push(...r.tools); cursor = r.nextCursor; } while (cursor);
    this.list = all;
    return all;
  }
  // A call as the account; a connection GitHub forgot meanwhile (404: its session ended, the call not made) is made
  // again, once. Not on another error: a call that may have been made (an issue opened) is never made twice.
  async call(account: string, name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    try { return await (await this.connect(account)).callTool({ name, arguments: args }) as CallToolResult; } catch (e) {
      if ((e as { code?: number }).code !== 404) throw e;
      this.clients.delete(account);
      return await (await this.connect(account)).callTool({ name, arguments: args }) as CallToolResult;
    }
  }
}

export { Tools };
