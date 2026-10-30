// The Kulisa plugin's main process entry (../README.md).
export { AGENTS, findAgent, agentVersion, accountEmail, signOut, installAgent, installLine, extendTrust, installSkill } from './agents/index.ts';
export type { Agent, Found } from './agents/index.ts';
export type { PluginHost, TaskAccess, ProfileAccess, TabAccess, TerminalAccess } from './core.ts';
export { startMcpServer } from './mcp-server.ts';
export { installGhost, MARK } from './ghost.ts';
