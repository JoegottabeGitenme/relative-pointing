# Runbook — EC2 + Docker deploy

One-page guide for deploying `relative-pointing` to a single EC2 instance with TLS.

## Prerequisites

- **EC2 instance**: `t3.small` (2 GB RAM) Ubuntu 22.04+, Elastic IP attached.
- **Security group**: inbound `22` (SSH from your IP only), `80`, `443`. Do **not** open `5001` to the public.
- **DNS**: A-record for `EC2_DOMAIN` → the instance's Elastic IP. Verify with `dig +short EC2_DOMAIN` before continuing — Let's Encrypt will fail if DNS isn't live.
- **Local**: `ssh`, `git`, your `.pem` key with `chmod 400`.

## First-time deploy

```bash
# 1. SSH in and install Docker (one-time)
ssh -i $EC2_KEY_PATH ubuntu@$EC2_HOST
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
exit  # log out so the group change takes effect

# 2. SSH back in, clone the repo
ssh -i $EC2_KEY_PATH ubuntu@$EC2_HOST
sudo mkdir -p /srv && sudo chown ubuntu:ubuntu /srv
cd /srv && git clone <repo-url> relative-pointing && cd relative-pointing

# 3. Configure environment
cp .env.example .env
nano .env  # fill in EC2_DOMAIN at minimum

# 4. Bring it up with TLS
docker compose --profile tls up -d --build

# 5. Verify
curl -fsS https://$EC2_DOMAIN/api/health   # should return {"status":"ok"}
```

First start takes ~30 s while Caddy completes the Let's Encrypt HTTP-01 challenge. Watch with `docker compose logs -f caddy` if it hangs.

## Updates

```bash
cd /srv/relative-pointing
git pull
docker compose --profile tls up -d --build
docker image prune -f
```

Downtime: ~5 s while the app container restarts. Caddy stays up.

## Operations

| What             | Command                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Logs (live)      | `docker compose logs -f app`                                                                                                   |
| Restart app only | `docker compose restart app`                                                                                                   |
| Stop everything  | `docker compose --profile tls down`                                                                                            |
| DB shell         | `docker compose exec app sh -c 'sqlite3 /data/app.db'`                                                                         |
| Backup DB        | `docker run --rm -v relative-pointing_app-data:/data -v $PWD:/backup alpine tar czf /backup/app-db-$(date +%F).tgz -C /data .` |
| Restore DB       | reverse the tar above; bring the stack down first                                                                              |
| Reset DB         | `docker compose down && docker volume rm relative-pointing_app-data && docker compose --profile tls up -d`                     |

Schedule the backup command via cron on the host (e.g. nightly to S3) — the SQLite file at `/data/app.db` is the only persistent state.

## Troubleshooting

- **Cert fails to issue** — DNS isn't pointing at the instance, or port 80 is blocked by the security group. `docker compose logs caddy` will show the ACME error.
- **`502 Bad Gateway` from Caddy** — app container is down or crashing. `docker compose ps`, then `docker compose logs app`.
- **`docker compose up` complains about `EC2_DOMAIN`** — `.env` is missing or unreadable. The file must sit next to `docker-compose.yml`.
- **Port 80 already in use** — something else is bound (often a host nginx). `sudo lsof -i :80` to find it; either stop it or set `HOST_PORT` and skip Caddy.
- **Cert renewal** — Caddy auto-renews ~30 days before expiry; nothing to do. Renewal logs appear in `docker compose logs caddy`.

## Without TLS (testing only)

Drop `--profile tls` to run only the app, exposed on `HOST_PORT`:

```bash
docker compose up -d --build
curl http://$EC2_HOST:5001/api/health
```

Use this for smoke tests against the box before you point DNS or open 443.
