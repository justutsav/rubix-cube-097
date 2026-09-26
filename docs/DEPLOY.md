# Where each piece runs, and why

Written 2026-09-26.

## The short version

| Piece | Runs on | Why there |
|---|---|---|
| Postgres, auth, storage | **Supabase**, `ap-south-1` (Mumbai) | managed, already live, Indian region |
| `asr` · `turn` · `identity` | **Supabase edge functions** | request/response, stateless, https for free |
| **Telephony service** (Exotel WebSocket + WhatsApp webhook) | **Oracle Cloud A1**, Mumbai or Hyderabad | needs a process that stays alive — see below |
| Android app | the handset | — |

## Why a VM is required, not preferred

**Supabase edge functions cannot hold a WebSocket open for the length of a phone call.**

Exotel AgentStream is a bidirectional stream: for the whole four-minute interview it pushes 20 ms
PCM frames at us and we push 20 ms frames back, with `clear` events for barge-in. That is a
long-lived, stateful, two-way connection. Edge functions are short-lived request/response workers;
they are the wrong shape for it, and no amount of configuration changes that.

The WhatsApp webhook *could* live in an edge function, but it shares the same session map and the
same core as the IVR adapter, so splitting them buys a second deployment and a cache-coherence
problem in exchange for nothing.

So: one small always-on VM. Oracle's Always Free tier is a genuinely good fit, and the reason is
not just that it is free — it is that **4 OCPU / 24 GB of Ampere A1 is a lot of headroom for a
service whose hot path is 20 ms audio frames**, and that Oracle has two Indian regions, which keeps
caste-linked voice inside Indian jurisdiction (`01-the-customer.md` §9.1).

## Oracle Cloud setup

### Shape and region

- **Region: `ap-mumbai-1` or `ap-hyderabad-1`.** Latency matters — the turn budget is 1800 ms and
  the round trip to Sarvam is already 340-630 ms of it. Data residency matters more.
- **Shape: `VM.Standard.A1.Flex`**, 2 OCPU / 12 GB. Always Free allows up to 4/24 across all A1
  instances; 2/12 leaves room for a second box later without touching the free allowance.
- **Image: Ubuntu 22.04 (aarch64).** Node 20 arm64 packages exist; Oracle Linux works too but the
  Node packaging is more effort.
- **Boot volume: 50 GB** (Always Free gives 200 GB total across volumes).

> ⚠ **Ampere capacity is the hard part, not the config.** "Out of host capacity" on A1 in popular
> regions is routine and can persist for days. Two workarounds: try a different availability domain,
> or upgrade the account to Pay As You Go — which *keeps* the Always Free allowances and
> dramatically improves the chance of getting a shape. Budget a day for this, not an hour.

### The trap that costs everyone an afternoon

Oracle's Ubuntu images ship with **iptables rules that drop everything except SSH**, *in addition to*
the VCN security list. Opening the port in the cloud console is necessary and not sufficient — the
service will still be unreachable and the console will show everything as correct.

Both layers have to be opened:

```bash
# 1. In the OCI console: VCN -> Security Lists -> Add Ingress Rule
#    Source 0.0.0.0/0, TCP, destination port 443   (and 80 for the ACME challenge)

# 2. On the box itself:
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo netfilter-persistent save
```

### Install

```bash
sudo apt update && sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

git clone <repo> /opt/rc097 && cd /opt/rc097
npm ci --omit=dev
```

### Secrets

Same discipline as the laptop: outside the repo, mode 600, never on a command line.

```bash
sudo mkdir -p /etc/rc097 && sudo chmod 700 /etc/rc097
sudo tee /etc/rc097/env >/dev/null <<'EOF'
ASR_PROVIDER=sarvam
SARVAM_API_KEY=...
SUPABASE_FUNCTIONS_URL=https://sktrbrtaprzzdnjvqxlu.supabase.co/functions/v1
SUPABASE_SERVICE_ROLE_KEY=...
META_ACCESS_TOKEN=...
META_PHONE_NUMBER_ID=...
META_VERIFY_TOKEN=...
META_APP_SECRET=...
PROMPT_DIR=/opt/rc097/prompts
PORT=5001
EOF
sudo chmod 600 /etc/rc097/env
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses every RLS policy in the database. It belongs on this box and
nowhere else — never in the app, never in the repo, never in a browser.

### systemd

```ini
# /etc/systemd/system/rc097-telephony.service
[Unit]
Description=rc097 telephony (Exotel AgentStream + WhatsApp)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=rc097
WorkingDirectory=/opt/rc097
EnvironmentFile=/etc/rc097/env
ExecStart=/usr/bin/npx tsx services/telephony/src/index.ts
Restart=always
RestartSec=3
# A dropped call mid-interview is survivable — the session becomes RESUMABLE and the answer rows
# persist — but the process should come back immediately rather than wait for a human.

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/rc097
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r -s /usr/sbin/nologin rc097
sudo chown -R rc097:rc097 /opt/rc097
sudo systemctl enable --now rc097-telephony
journalctl -u rc097-telephony -f
```

### TLS

Exotel needs `wss://` and Meta will not deliver a webhook over plain http. Caddy is two lines and
handles ACME renewal itself:

```
# /etc/caddy/Caddyfile
ivr.example.in {
    reverse_proxy localhost:5001
}
```

A WebSocket upgrade passes through `reverse_proxy` without extra configuration.

## What goes where, once it is up

| Endpoint | Points at |
|---|---|
| Exotel Voicebot applet | `wss://ivr.example.in/media` |
| Meta webhook | `https://ivr.example.in/whatsapp` |
| App `VITE_ASR_URL` | `https://<ref>.supabase.co/functions/v1/asr` |

Note the last row: the **app** talks to the Supabase edge function, not to this box. The VM exists
for the two channels that need a persistent connection; the handset does not, so it gets the
managed https endpoint and the mixed-content workaround in `capacitor.config.ts` can be reverted.

## Cost

| | Monthly |
|---|---|
| Oracle A1, 2 OCPU / 12 GB | **₹0** (Always Free) |
| Supabase free tier | **₹0** until 500 MB DB / 2 GB egress |
| Sarvam STT | ⚠ metered — roughly ₹30 per hour of audio |
| Exotel number + minutes | ⚠ unpublished, see `docs/CHANNELS-SETUP.md` |

The corrected model in the spec (§9) puts the all-in figure at **₹30.18 per beneficiary at 1,000**
and **₹4.04 at 100,000**. Nothing here changes that: the compute is free and the variable cost is
speech and telephony, exactly as modelled.

## What this deliberately does not do

- **No self-hosted ASR on this box.** Ampere A1 has no GPU. IndicConformer on CPU will not hold a
  sub-two-second turn, and an always-on GPU is ₹4.29 lakh/year for a break-even at ~47,700
  interviews a month — two orders of magnitude above pilot scale. Metered stays the default; the
  sovereign stack is the switch demonstrated on stage, not the running cost.
- **No Kubernetes, no Docker Swarm, no autoscaling.** One process, one systemd unit, `Restart=always`.
  At pilot scale the failure mode that matters is "the box rebooted", and systemd already handles it.
