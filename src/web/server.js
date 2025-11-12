/**
 * server.js
 * Web server using Bun's built-in HTTP and WebSocket support
 */

const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

/**
 * Create web server with WebSocket support
 */
function createWebServer(pipeline, config) {
  const webConfig = config.outputs.web;
  const clients = new Set();

  /**
   * Broadcast message to all connected WebSocket clients
   */
  function broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of clients) {
      try {
        client.send(data);
      } catch (err) {
        console.error('Error sending to client:', err.message);
        clients.delete(client);
      }
    }
  }

  /**
   * Register pipeline output to broadcast messages
   */
  pipeline.registerOutput('websocket', (message) => {
    broadcast({
      type: 'message',
      data: message
    });
  });

  /**
   * Handle WebSocket messages from clients
   */
  function handleWebSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'subscribe':
          // Client wants to receive messages
          clients.add(ws);
          ws.send(JSON.stringify({
            type: 'subscribed',
            timestamp: Date.now()
          }));
          break;

        case 'unsubscribe':
          clients.delete(ws);
          break;

        case 'command':
          handleCommand(ws, data.action, data.params);
          break;

        case 'get-status':
          const status = pipeline.getStatus();
          ws.send(JSON.stringify({
            type: 'status',
            data: status
          }));
          break;
      }
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message
      }));
    }
  }

  /**
   * Handle control commands from web UI
   */
  function handleCommand(ws, action, params = {}) {
    try {
      let result;

      switch (action) {
        case 'start':
          pipeline.start();
          result = { success: true, message: 'Capture started' };
          break;

        case 'stop':
          pipeline.stop();
          result = { success: true, message: 'Capture stopped' };
          break;

        case 'add-port':
          pipeline.addPort(params);
          result = { success: true, message: `Port ${params.port} added` };
          break;

        case 'remove-port':
          pipeline.removePort(params.port);
          result = { success: true, message: `Port ${params.port} removed` };
          break;

        default:
          result = { success: false, message: `Unknown command: ${action}` };
      }

      ws.send(JSON.stringify({
        type: 'command-result',
        action,
        result
      }));

      // Broadcast status update to all clients
      broadcast({
        type: 'status-update',
        data: pipeline.getStatus()
      });
    } catch (err) {
      ws.send(JSON.stringify({
        type: 'error',
        message: err.message
      }));
    }
  }

  /**
   * Serve static files
   */
  function serveStatic(path) {
    const publicDir = join(__dirname, 'public');
    let filePath = join(publicDir, path === '/' ? 'index.html' : path);

    if (!existsSync(filePath)) {
      return new Response('Not Found', { status: 404 });
    }

    const content = readFileSync(filePath);
    const ext = filePath.split('.').pop();

    const contentTypes = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json'
    };

    return new Response(content, {
      headers: {
        'Content-Type': contentTypes[ext] || 'text/plain'
      }
    });
  }

  /**
   * Handle API requests
   */
  function handleApi(request, pathname) {
    const method = request.method;

    // GET /api/status
    if (method === 'GET' && pathname === '/api/status') {
      return Response.json(pipeline.getStatus());
    }

    // GET /api/parsers
    if (method === 'GET' && pathname === '/api/parsers') {
      return Response.json({
        parsers: pipeline.parserRegistry.list()
      });
    }

    // POST /api/capture/start
    if (method === 'POST' && pathname === '/api/capture/start') {
      try {
        pipeline.start();
        return Response.json({ success: true, message: 'Capture started' });
      } catch (err) {
        return Response.json({ success: false, message: err.message }, { status: 400 });
      }
    }

    // POST /api/capture/stop
    if (method === 'POST' && pathname === '/api/capture/stop') {
      try {
        pipeline.stop();
        return Response.json({ success: true, message: 'Capture stopped' });
      } catch (err) {
        return Response.json({ success: false, message: err.message }, { status: 400 });
      }
    }

    // POST /api/ports/add
    if (method === 'POST' && pathname === '/api/ports/add') {
      return request.json().then(body => {
        try {
          pipeline.addPort(body);
          return Response.json({ success: true, message: `Port ${body.port} added` });
        } catch (err) {
          return Response.json({ success: false, message: err.message }, { status: 400 });
        }
      });
    }

    // POST /api/ports/remove
    if (method === 'POST' && pathname === '/api/ports/remove') {
      return request.json().then(body => {
        try {
          pipeline.removePort(body.port);
          return Response.json({ success: true, message: `Port ${body.port} removed` });
        } catch (err) {
          return Response.json({ success: false, message: err.message }, { status: 400 });
        }
      });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  }

  /**
   * Start the server
   */
  function start() {
    const server = Bun.serve({
      port: webConfig.port,
      hostname: webConfig.host,

      fetch(request, server) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Upgrade to WebSocket
        if (pathname === '/ws') {
          const upgraded = server.upgrade(request);
          if (!upgraded) {
            return new Response('WebSocket upgrade failed', { status: 400 });
          }
          return undefined;
        }

        // API routes
        if (pathname.startsWith('/api/')) {
          return handleApi(request, pathname);
        }

        // Static files
        return serveStatic(pathname);
      },

      websocket: {
        open(ws) {
          console.log('WebSocket client connected');
          clients.add(ws);
        },

        message(ws, message) {
          handleWebSocketMessage(ws, message);
        },

        close(ws) {
          console.log('WebSocket client disconnected');
          clients.delete(ws);
        },

        error(ws, error) {
          console.error('WebSocket error:', error);
          clients.delete(ws);
        }
      }
    });

    console.log(`Web server started on http://${webConfig.host}:${webConfig.port}`);
    return server;
  }

  return {
    start,
    broadcast,
    clients
  };
}

module.exports = { createWebServer };
