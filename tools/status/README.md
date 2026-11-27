# Render operations dashboard

Run `npm run status` and open http://localhost:5180/status/ .
The same page is available at /status/ under npm run dev.
The standalone server binds to loopback; do not expose it publicly.
Optional STATUS_PORT and JILP_WORKSPACE environment variables override the
port and shared workspace path. The server requires authenticated rclone
with the gdrive remote available without an interactive prompt.

The collector reads the assembly render map and counts complete file sets
(movie, marker, depth files or archive). It does not independently verify
checksums or claim that a manifest alone proves a complete download.
Movie totals exclude the separate statistics PNG sequence.
Cloud observations are cached for 30 seconds. Failed observations are
marked stale. Local rclone copy/check processes indicate activity, not success.

On an authenticated Colab worker, launch the telemetry publisher separately:
```sh
python3 -u colab/status-heartbeat.py --output /path/to/render.prores \
  --job-folder 1qYdX-8ia0THTt0KFI5qzKBjt7xNJjA13
```
Run one publisher per job. This publishes only counts, hostname, time and
render activity. The publisher needs the existing Google authentication;
it does not expose credentials, run commands remotely or change render data.
A heartbeat older than 90 seconds is stale, not proof of termination.
The dashboard is local-only, not part of the public Vercel deployment.

Test: npm run test:status.
