/**
 * app.js
 * Frontend JavaScript for live monitoring UI
 */

// State
let ws = null;
let viewMode = 'both';
let portFilter = 'all';
let typeFilter = 'all';
let callsignFilter = '';
let entityFilter = 'all';
let autoScroll = true;
let paused = false;
let messageCount = 0;
let messageBuffer = [];

// DOM elements
const elements = {
  statusIndicator: document.getElementById('status-indicator'),
  statusText: document.getElementById('status-text'),
  btnStart: document.getElementById('btn-start'),
  btnStop: document.getElementById('btn-stop'),
  btnClear: document.getElementById('btn-clear'),
  messages: document.getElementById('messages'),
  portFilter: document.getElementById('port-filter'),
  typeFilter: document.getElementById('type-filter'),
  callsignFilter: document.getElementById('callsign-filter'),
  entityFilter: document.getElementById('entity-filter'),
  autoScrollCheckbox: document.getElementById('auto-scroll'),
  pauseCheckbox: document.getElementById('pause-stream'),
  statMessages: document.getElementById('stat-messages'),
  statRate: document.getElementById('stat-rate'),
  statPorts: document.getElementById('stat-ports'),
  statUptime: document.getElementById('stat-uptime')
};

/**
 * Initialize WebSocket connection
 */
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateConnectionStatus(true);

    // Subscribe to messages
    ws.send(JSON.stringify({
      type: 'subscribe'
    }));

    // Request initial status
    ws.send(JSON.stringify({
      type: 'get-status'
    }));
  };

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    updateConnectionStatus(false);

    // Attempt reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(message) {
  switch (message.type) {
    case 'message':
      if (!paused) {
        addMessage(message.data);
      }
      break;

    case 'status':
    case 'status-update':
      updateStatus(message.data);
      break;

    case 'command-result':
      handleCommandResult(message);
      break;

    case 'error':
      console.error('Server error:', message.message);
      break;
  }
}

/**
 * Add message to display
 */
function addMessage(message) {
  // Apply filters
  if (portFilter !== 'all' && message.port !== parseInt(portFilter)) {
    return;
  }

  if (typeFilter !== 'all' && message.type !== typeFilter) {
    return;
  }

  // Callsign filter (partial match, case-insensitive)
  if (callsignFilter && callsignFilter.trim() !== '') {
    const filterUpper = callsignFilter.trim().toUpperCase();
    let matchFound = false;

    // Check if message has parsed data with callsign
    if (message.parsed) {
      const parsed = message.parsed;

      // Check common callsign fields
      if (parsed.callsign && parsed.callsign.toUpperCase().includes(filterUpper)) {
        matchFound = true;
      } else if (parsed.from && parsed.from.toUpperCase().includes(filterUpper)) {
        matchFound = true;
      } else if (parsed.to && parsed.to.toUpperCase().includes(filterUpper)) {
        matchFound = true;
      }
    }

    // Also check raw message for callsign
    if (!matchFound && message.raw && message.raw.toUpperCase().includes(filterUpper)) {
      matchFound = true;
    }

    if (!matchFound) {
      return;
    }
  }

  // Entity filter (aircraft vs controllers)
  if (entityFilter !== 'all') {
    let callsignToCheck = null;

    // Extract callsign from parsed data
    if (message.parsed) {
      const parsed = message.parsed;
      if (parsed.callsign) {
        callsignToCheck = parsed.callsign;
      } else if (parsed.from) {
        callsignToCheck = parsed.from;
      }
    }

    if (callsignToCheck) {
      const isController = callsignToCheck.includes('_');

      if (entityFilter === 'aircraft' && isController) {
        return;
      }
      if (entityFilter === 'controllers' && !isController) {
        return;
      }
    }
  }

  messageCount++;
  elements.statMessages.textContent = messageCount;

  // Create message element
  const messageEl = document.createElement('div');
  messageEl.className = 'message';

  // Header
  const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });

  const headerHTML = `
    <div class="message-header">
      <span class="message-timestamp">[${timestamp}]</span>
      <span class="message-port">Port ${message.port}</span>
      <span class="message-type">${message.type}</span>
    </div>
  `;

  let contentHTML = '';

  // Raw message
  if (viewMode === 'both' || viewMode === 'raw') {
    contentHTML += `<div class="message-raw">${escapeHtml(message.raw)}</div>`;
  }

  // Parsed message
  if ((viewMode === 'both' || viewMode === 'parsed') && message.parsed) {
    const parsedStr = JSON.stringify(message.parsed, null, 2);
    contentHTML += `<div class="message-parsed">${escapeHtml(parsedStr)}</div>`;
  }

  messageEl.innerHTML = headerHTML + contentHTML;

  // Add to display
  elements.messages.appendChild(messageEl);

  // Limit messages in DOM
  const maxMessages = 1000;
  while (elements.messages.children.length > maxMessages) {
    elements.messages.removeChild(elements.messages.firstChild);
  }

  // Auto-scroll
  if (autoScroll) {
    elements.messages.parentElement.scrollTop = elements.messages.parentElement.scrollHeight;
  }

  // Update message type filter
  updateTypeFilter(message.type);
}

/**
 * Update status display
 */
function updateStatus(status) {
  // Update stats
  if (status.pipeline) {
    elements.statMessages.textContent = status.pipeline.totalMessages || 0;
    elements.statRate.textContent = status.pipeline.messagesPerSecond || '0.0' + '/sec';

    if (status.pipeline.uptime) {
      const seconds = Math.floor(status.pipeline.uptime / 1000);
      elements.statUptime.textContent = formatUptime(seconds);
    }
  }

  if (status.capture) {
    elements.statPorts.textContent = status.capture.activePorts || 0;

    // Update port filter
    updatePortFilter(status.capture.ports);
  }

  // Update button states
  if (status.isRunning) {
    elements.btnStart.disabled = true;
    elements.btnStop.disabled = false;
  } else {
    elements.btnStart.disabled = false;
    elements.btnStop.disabled = true;
  }
}

/**
 * Update port filter dropdown
 */
function updatePortFilter(ports) {
  if (!ports) return;

  const currentPorts = new Set();
  ports.forEach(p => currentPorts.add(p.port));

  // Check if we need to update
  const existingPorts = new Set();
  for (let i = 1; i < elements.portFilter.options.length; i++) {
    existingPorts.add(parseInt(elements.portFilter.options[i].value));
  }

  if (setsEqual(currentPorts, existingPorts)) return;

  // Rebuild options
  const selectedValue = elements.portFilter.value;
  elements.portFilter.innerHTML = '<option value="all">All</option>';

  ports.forEach(portInfo => {
    const option = document.createElement('option');
    option.value = portInfo.port;
    option.textContent = `${portInfo.port} - ${portInfo.label || 'Unknown'}`;
    elements.portFilter.appendChild(option);
  });

  elements.portFilter.value = selectedValue;
}

/**
 * Update message type filter
 */
function updateTypeFilter(type) {
  // Check if type already exists in filter
  for (let i = 0; i < elements.typeFilter.options.length; i++) {
    if (elements.typeFilter.options[i].value === type) {
      return;
    }
  }

  // Add new type
  const option = document.createElement('option');
  option.value = type;
  option.textContent = type;
  elements.typeFilter.appendChild(option);
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected) {
  if (connected) {
    elements.statusIndicator.className = 'status-dot connected';
    elements.statusText.textContent = 'Connected';
  } else {
    elements.statusIndicator.className = 'status-dot disconnected';
    elements.statusText.textContent = 'Disconnected';
  }
}

/**
 * Handle command result
 */
function handleCommandResult(message) {
  const { result } = message;
  if (!result.success) {
    console.error('Command failed:', result.message);
    alert(`Error: ${result.message}`);
  }
}

/**
 * Send command to server
 */
function sendCommand(action, params = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert('Not connected to server');
    return;
  }

  ws.send(JSON.stringify({
    type: 'command',
    action,
    params
  }));
}

/**
 * Event listeners
 */
elements.btnStart.addEventListener('click', () => {
  sendCommand('start');
});

elements.btnStop.addEventListener('click', () => {
  sendCommand('stop');
});

elements.btnClear.addEventListener('click', () => {
  elements.messages.innerHTML = '';
  messageCount = 0;
  elements.statMessages.textContent = '0';
});

document.querySelectorAll('input[name="view"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    viewMode = e.target.value;
  });
});

elements.portFilter.addEventListener('change', (e) => {
  portFilter = e.target.value;
});

elements.typeFilter.addEventListener('change', (e) => {
  typeFilter = e.target.value;
});

elements.callsignFilter.addEventListener('input', (e) => {
  callsignFilter = e.target.value;
});

elements.entityFilter.addEventListener('change', (e) => {
  entityFilter = e.target.value;
});

elements.autoScrollCheckbox.addEventListener('change', (e) => {
  autoScroll = e.target.checked;
});

elements.pauseCheckbox.addEventListener('change', (e) => {
  paused = e.target.checked;
});

/**
 * Utility functions
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

// Initialize
connectWebSocket();

// Show empty state initially
if (elements.messages.children.length === 0) {
  elements.messages.innerHTML = '<div class="empty-state">Waiting for messages...</div>';
}
