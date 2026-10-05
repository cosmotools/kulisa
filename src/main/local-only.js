// The MCP server and the CDP proxy control signed-in profiles. They listen on 127.0.0.1, yet a web page could still
// reach them: by DNS rebinding (its own host name resolving to 127.0.0.1) or by a WebSocket, which CORS does not
// cover. Local tools (Claude Code, Playwright, curl) send Host 127.0.0.1 or localhost and no Origin; a browser always
// sends its Origin with these requests. Chrome's own remote debugging refuses them the same way.
function fromLocalTool(req) {
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  return ['127.0.0.1', 'localhost', '[::1]'].includes(host) && !req.headers.origin;
}

module.exports = { fromLocalTool };
