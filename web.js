const express = require("express");
const http = require("http");
const socketio = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const MAX_LOGS = 500;
const MAX_SITES = 300;

const logs = [];
const sites = [];

function shortenUrl(url, maxLength = 60) {
  if (url.length <= maxLength) return url;
  return url.slice(0, 30) + "..." + url.slice(-20);
}

app.get("/", (_, res) => {
  res.send(`
    <html>
      <head>
        <title>Yaznbook Herskone Crawler Monitor</title>
        <style>
          body { font-family: monospace; background: #111; color: #0f0; padding: 1rem; }
          .log { margin-bottom: 0.3rem; white-space: pre-wrap; word-break: break-word; max-width: 100%; }
          .log.error { color: #f33; }
          .log.warning { color: #ff9933; }
          .site { margin-bottom: 1rem; border-bottom: 1px solid #0f0; padding-bottom: 0.7rem; }
          a { color: #0ff; text-decoration: none; word-break: break-all; }
          a:hover { text-decoration: underline; }
          #controls { margin-bottom: 1rem; }
          input, select { background: #222; color: #0f0; border: 1px solid #0f0; padding: 0.3rem 0.5rem; margin-right: 0.5rem; }
          button { background: #0f0; color: #111; border: none; padding: 0.4rem 0.8rem; cursor: pointer; }
          button:hover { background: #0c0; }
          #log, #sites { max-height: 300px; overflow-y: auto; border: 1px solid #0f0; padding: 0.5rem; }
          .timestamp { color: #666; font-size: 0.8rem; margin-left: 0.5rem; }
          #toast {
            position: fixed; bottom: 20px; right: 20px; background: #0f0; color: #111; padding: 1rem; border-radius: 5px;
            opacity: 0; pointer-events: none; transition: opacity 0.3s ease;
          }
          #toast.show { opacity: 1; pointer-events: auto; }
        </style>
      </head>
      <body>
        <h2>🕷️Yaznbook Herskone Crawler Live Log</h2>
        <div id="controls">
          <input type="text" id="search" placeholder="Search logs or sites..." />
          <select id="filter">
            <option value="all">All logs</option>
            <option value="error">Errors only</option>
            <option value="warning">Warnings only</option>
            <option value="normal">Normal only</option>
          </select>
          <button onclick="clearLogs()">Clear Logs</button>
        </div>
        <div id="log"></div>

        <h2>🌐 Visited Sites</h2>
        <div id="sites"></div>

        <div id="toast"></div>

        <script src="/socket.io/socket.io.js"></script>
        <script>
          const socket = io();

          const logDiv = document.getElementById("log");
          const sitesDiv = document.getElementById("sites");
          const searchInput = document.getElementById("search");
          const filterSelect = document.getElementById("filter");
          const toast = document.getElementById("toast");

          let logs = [];
          let sites = [];

          function showToast(msg) {
            toast.textContent = msg;
            toast.classList.add("show");
            setTimeout(() => toast.classList.remove("show"), 3000);
          }

          socket.on("connect", () => {
            socket.emit("request-initial-data");
          });

          socket.on("initial-logs", data => {
            logs = data;
            renderLogs();
          });

          socket.on("initial-sites", data => {
            sites = data;
            renderSites();
          });

          socket.on("log", msg => {
            logs.unshift(msg);
            if (logs.length > ${MAX_LOGS}) logs.pop();
            renderLogs();
            showToast("New log received");
          });

          socket.on("site", site => {
            sites.unshift(site);
            if (sites.length > ${MAX_SITES}) sites.pop();
            renderSites();
            showToast("New site visited: " + site.title);
          });

          socket.on("error", err => {
            logs.unshift({ msg: err, type: "error", timestamp: new Date().toLocaleTimeString() });
            if (logs.length > ${MAX_LOGS}) logs.pop();
            renderLogs();
            showToast("Error: " + err);
          });

          searchInput.addEventListener("input", renderFiltered);
          filterSelect.addEventListener("change", renderFiltered);

          function clearLogs() {
            logs = [];
            renderLogs();
            showToast("Logs cleared");
          }

          function renderLogs() {
            renderFiltered();
          }

          function renderFiltered() {
            const query = searchInput.value.toLowerCase();
            const filter = filterSelect.value;

            logDiv.innerHTML = "";
            logs.filter(log => {
              const text = typeof log === "string" ? log.toLowerCase() : log.msg.toLowerCase();
              const type = log.type || "normal";
              if (filter !== "all" && type !== filter) return false;
              if (!text.includes(query)) return false;
              return true;
            }).forEach(log => {
              const div = document.createElement("div");
              div.className = "log";
              if (log.type) div.classList.add(log.type);
              const text = typeof log === "string" ? log : log.msg;
              div.textContent = text;
              if(log.timestamp) {
                const span = document.createElement("span");
                span.className = "timestamp";
                span.textContent = log.timestamp;
                div.appendChild(span);
              }
              logDiv.appendChild(div);
            });
          }

          function renderSites() {
            const query = searchInput.value.toLowerCase();

            sitesDiv.innerHTML = "";
            sites.filter(site => {
              return site.title.toLowerCase().includes(query) || site.url.toLowerCase().includes(query);
            }).forEach(site => {
              const div = document.createElement("div");
              div.className = "site";
              div.innerHTML = \`
                <strong>\${site.title}</strong> 
                <span class="timestamp">\${new Date(site.timestamp || Date.now()).toLocaleTimeString()}</span><br>
                <a href="\${site.url}" target="_blank" title="\${site.url}">\${shortenUrl(site.url)}</a>
              \`;
              sitesDiv.appendChild(div);
            });
          }

          function shortenUrl(url, maxLength = 60) {
            if (url.length <= maxLength) return url;
            return url.slice(0, 30) + "..." + url.slice(-20);
          }
        </script>
      </body>
    </html>
  `);
});

io.on("connection", (socket) => {
  console.log("📡 Frontend connected");

  socket.on("request-initial-data", () => {
    socket.emit("initial-logs", logs);
    socket.emit("initial-sites", sites);
  });

  socket.on("log", (msg) => {
    if (typeof msg === "string") {
      logs.unshift({ msg, type: "normal", timestamp: new Date().toLocaleTimeString() });
    } else {
      logs.unshift(msg);
    }
    if (logs.length > MAX_LOGS) logs.pop();
    io.emit("log", msg);
  });

  socket.on("site", (site) => {
    if (!site.timestamp) site.timestamp = Date.now();
    sites.unshift(site);
    if (sites.length > MAX_SITES) sites.pop();
    io.emit("site", site);
  });

  socket.on("error", (err) => {
    logs.unshift({ msg: err, type: "error", timestamp: new Date().toLocaleTimeString() });
    if (logs.length > MAX_LOGS) logs.pop();
    io.emit("error", err);
  });
});

server.listen(3000, () => {
  console.log("🖥️ Web monitor running at http://localhost:3000");
});
