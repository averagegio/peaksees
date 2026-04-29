import { spawn } from "node:child_process";
import http from "node:http";
import { WebSocketServer } from "ws";

const server = http.createServer();
const wss = new WebSocketServer({ server, path: "/ws" });

function startFfmpeg(rtmpUrl, streamKey) {
  const target = `${rtmpUrl}/${streamKey}`;
  const args = [
    "-loglevel",
    "warning",
    "-re",
    "-i",
    "pipe:0",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-tune",
    "zerolatency",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "128k",
    "-f",
    "flv",
    target,
  ];
  const proc = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "inherit"] });
  return proc;
}

wss.on("connection", (ws) => {
  let ffmpeg = null;
  let started = false;

  ws.on("message", (data, isBinary) => {
    if (!started && !isBinary) {
      try {
        const msg = JSON.parse(data.toString("utf8"));
        if (msg?.type === "start" && msg.rtmpUrl && msg.streamKey) {
          ffmpeg = startFfmpeg(msg.rtmpUrl, msg.streamKey);
          started = true;
          ws.send(JSON.stringify({ ok: true }));
        }
      } catch {
        // ignore
      }
      return;
    }

    if (!started || !ffmpeg) return;
    if (isBinary) {
      ffmpeg.stdin.write(data);
    }
  });

  ws.on("close", () => {
    try {
      ffmpeg?.stdin.end();
      ffmpeg?.kill("SIGKILL");
    } catch {
      // ignore
    }
  });
});

const port = Number(process.env.PORT ?? "8787");
server.listen(port, () => {
  console.log(`stream relay listening on http://localhost:${port}/ws`);
});

