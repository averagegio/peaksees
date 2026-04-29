## peaksees stream relay (browser → RTMP)

Mux Live ingest does **not** accept direct WebRTC from browsers. To let users click “Go live from browser”, you need a small always-on relay that:

- receives `MediaRecorder` WebM chunks over WebSocket
- pipes them into `ffmpeg`
- publishes RTMP to Mux using the provided `rtmpUrl` + `streamKey`

This folder contains a minimal Node relay example intended to run on a VM / Fly.io / Railway / Render (not Vercel serverless).

### Requirements

- Node 18+
- `ffmpeg` installed and available on PATH

### Run

```bash
cd stream-relay
npm i
npm run dev
```

### Configure the app

Set in Vercel (or your hosting env):

- `NEXT_PUBLIC_STREAM_RELAY_URL` = `wss://YOUR-RELAY-HOST/ws`

