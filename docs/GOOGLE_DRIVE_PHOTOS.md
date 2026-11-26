# Google Drive photo builds (keyless)

Local builds use photos.config.jsonc and local files. Vercel production builds can
resolve ../jilp-old-pics from the explicitly shared categorized Drive folder.

## Google Cloud
- Project number: 84898377840.
- Pool: jilp-milestones-vercel-connector; provider: vercel.
- Issuer: https://oidc.vercel.com/davelugtu1-7046 (team issuer mode).
- Audience: https://vercel.com/davelugtu1-7046.
- Map google.subject to assertion.sub.
- Restrict provider and impersonation grant to the production subject:
  owner:davelugtu1-7046:project:milestone2:environment:production.
- Grant the exact federated subject roles/iam.workloadIdentityUser on the
  service account in config/gdrive-federation.json.
- Enable Google Drive API, IAM Service Account Credentials API and STS API.
- Share only the categorized photo folder with the service account as Viewer.

## Vercel
Enable OIDC and verify team issuer mode. Production is intentionally public with owner approval. Set these Production-only environment variables:
- GDRIVE_PHOTO_FOLDER_ID=15LtY__I8LLtA-Xb78aa9k1KGxQLZ_D3I
- GDRIVE_PHOTOS_ENABLED=1

The build exchanges VERCEL_OIDC_TOKEN directly in memory via STS, then
impersonates the service account with the Drive read-only scope. No key, token
file, or manual GOOGLE_APPLICATION_CREDENTIALS variable is needed. The
external-account configuration is non-secret. Never log or commit actual tokens.

The opt-in explicitly enables publication of selected images. Static assets inherit website access controls, not Google Drive permissions; production assets are publicly accessible. Only production builds are supported by the federation resolver. Deploy from main after confirming public photo publication is authorized.
Remote authentication, exact Drive photo name matching, and deployment have
not yet been verified.
