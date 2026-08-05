⭐ STFC‑Tool — Battle Analysis Platform for Star Trek Fleet Command
Independent, evidence‑based battle analytics for STFC PC players.

STFC‑Tool captures, parses, stores, and analyzes battle data from the Star Trek Fleet Command PC client, providing players with accurate, evidence‑driven insights into ship performance, crew efficiency, hostile mechanics, and battle outcomes.

This project includes:

A PC capture workflow

A local sync and parsing service

A web interface for battle history and analysis

A Model Context Protocol (MCP) service that allows ChatGPT to answer questions using observed battle evidence

This is an independent community project. It is not affiliated with Scopely, Paramount, CBS, Discord, Twitch, Cloudflare, or OpenAI.

🚀 What STFC‑Tool Does
STFC‑Tool helps players understand what actually happened in their battles — not just what the game UI shows.

Players can:

Review recent battles

Compare crew setups

Inspect captain, bridge, and below‑deck officers

See which officer abilities activated

Analyze damage, mitigation, crits, repairs, and hull loss

Compare battles against the same hostile or target

Evaluate crew performance using real evidence

Review hostile profiles, weapons, and mechanics

Analyze solo and group armadas

Compare ship performance across encounters

Ask battle‑analysis questions through ChatGPT

Query archived battle history

All recommendations are evidence‑based and depend on:

ship tier & level

research

buildings

officers

forbidden tech

artifacts

refits

target type

sample size

🌐 Main Website
Battle history & analysis:
https://toolbox.punkndrublic.us/my-battles

🧱 High‑Level Architecture
Code
STFC PC Client
      |
      v
PC Mod / Network Capture
      |
      v
TypeScript Web and Sync Services
      |
      v
Parser and Data Enrichment
      |
      v
SQLite Databases
      |
      +----------------------+
      |                      |
      v                      v
Web Application          MCP Service
      |                      |
      +----------+-----------+
                 |
                 v
          Cloudflare Tunnel
                 |
        +--------+---------+
        |                  |
        v                  v
     Web Users        ChatGPT Users
The database stays local on the host PC

Cloudflare Tunnel provides secure public routing

MCP endpoints are read‑only for public users

🧩 Project Components
PC Capture
Captures STFC network traffic and extracts battle payloads.

Local Sync Service
Handles ingestion, validation, token auth, and coordination between the website, MCP, and databases.

Parser & Enrichment Layer
Converts raw payloads into structured battle data:

rounds

damage types

mitigation

crits

repairs

officer triggers

hostile identity

encounter type

confidence scoring

Web Application
Primary UI for reviewing battle history and analysis.

MCP Service
Provides controlled, read‑only STFC analysis to ChatGPT:

battle summaries

crew performance

hostile profiles

armada participation

encounter scoring

baselines

comparison cohorts

🤖 What ChatGPT Can Analyze
ChatGPT (via MCP) can answer questions about:

recent battles

crew layouts

officer triggers

hull repair

mitigation

hostile mechanics

armada participation

player ship baselines

comparison cohorts

reputation gains

static game data

Each user’s ChatGPT conversation is isolated — conversations do not merge.

❓ Example Questions
“Tell me about my last 20 battles.”

“Compare my last two crew setups.”

“Why am I taking so much hull damage?”

“Which officers activated during this battle?”

“Which crew worked best against this hostile?”

“Compare my Borg Sphere runs against level 68 Borg hostiles.”

“How much hull repair did I receive?”

“Why did this ship perform differently from comparable ships?”

“What changed between these two runs?”

“How strong is the evidence behind this recommendation?”

📚 Data Sources
STFC‑Tool combines:

Captured Battle Evidence
Actual observed battle logs.

Static Game Data
Ships, officers, hostiles, systems, research, buildings, refits, forbidden tech, abilities, components, rewards.

Player Snapshots (when available)
ops level

ship tier

officer ownership

research

buildings

refits

artifacts

modifiers

Snapshots improve confidence but may be incomplete.

🗄️ Database Design
Live Database
recent battles

active queries

MCP requests

player snapshots

new ingestion

Archive Database
older battle history

long‑term comparisons

historical evidence

Size Policy
target: ~20 GiB

begin archival at 17–18 GiB

Backup vs Archive
backup = disaster recovery

archive = historical queries

🔐 Authentication & Permissions
Uses API‑client tokens with fields like:

Code
id
display_name
token_hash
is_active
can_read_mcp
can_write_mcp
requests_per_minute
created_at
last_used_at
expires_at
notes
Public Tokens
Code
can_read_mcp = 1
can_write_mcp = 0
Token Rules
one token per user

never publish tokens

never log authorization headers

store token hashes

allow rotation

never include tokens in screenshots

☁️ Public Hosting & Cloudflare
Traffic flow:

Code
Internet → Cloudflare → Authenticated Website/MCP → Local Services → Local SQLite
Recommended protections:

Cloudflare Tunnel

local‑only origin services

rate limits

request size limits

query timeouts

kill switch

no exposed internal ports

🔒 MCP Security
Public MCP must remain read‑only.

Public users cannot access:

INSERT/UPDATE/DELETE

shell commands

backups

VACUUM

schema changes

filesystem browsing

MCP enforces:

row limits

date ranges

timeouts

concurrency limits

safe path validation

🖥️ Local PC Security
run under a dedicated Windows account

restrict folder access

keep .env private

keep Cloudflare credentials private

firewall rules

remove unused port forwards

monitor system resources

📉 Rate Limiting & Availability
Protect against:

abusive traffic

runaway MCP calls

large queries

malformed requests

⚙️ Environment Configuration
Use a private .env file.
Provide .env.example with blank placeholders.

Never commit real secrets.

🧪 Development Setup
Requirements:

Windows

Node.js

npm

Python

SQLite

Cloudflare Tunnel

STFC PC client

Install dependencies:

Code
npm install
Python:

Code
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
Start services:

local sync

web frontend

MCP bridge

parser

Cloudflare tunnel

Validate:

health endpoints

token auth

read‑only access

ingestion

backups

archive queries

🧪 Testing Public Access
Verify:

public tools only

invalid tokens rejected

disabled tokens rejected

no write access

safe archive access

rate limits

Cloudflare routing only

👥 User Access Flow
Join Discord

Read rules

Request token

Install capture workflow

Play several battles

Open website

(Optional) connect ChatGPT

Submit feedback

Never send tokens in public channels.

🤖 Connecting to ChatGPT
Users need:

MCP server address

their token

ChatGPT plan that supports MCP

Never share:

tokens

passwords

API keys

database files

💬 Discord Community Structure
Includes:

onboarding

installation help

bug reports

feature requests

battle clinics

crew testing

stream chat

staff channels

🎥 Twitch Integration
Suggested stream format:

State the test question

Predict outcome

Run battles

Analyze logs

Change one variable

Retest

Compare evidence

📄 Public Documentation
A separate docs repo may include:

getting started

connecting ChatGPT

troubleshooting

privacy & security

FAQ

Never include:

source code

schemas

.env

tokens

Cloudflare config

database files

⚠️ Known Limitations
depends on battle quality

incomplete snapshots

game updates may change payloads

SQLite performance varies

archived searches slower

ChatGPT may require multiple MCP calls

📏 Data Quality Principles
Distinguish:

observed facts

static game data

snapshots

derived calculations

inferences

recommendations

Recommendations include:

sample size

comparison scope

battle quality

missing info

confidence

evidence

One battle is not universal proof.

🛠️ Support & Reporting
Use Discord for:

installation

ChatGPT connection

battle questions

troubleshooting

Bug reports should include:

expected vs actual

time

browser

OS

battle ID

reproducibility

safe screenshots

Never include credentials.

📊 Operational Monitoring
Monitor:

DB size

archive size

free disk

write failures

lock errors

ingestion backlog

API/MCP latency

request volume

CPU/memory

Cloudflare tunnel

backups

parser failures

🧪 Beta Launch Guidance
Start with:

alliance users

several alliances

mixed ops levels

technical testers

content creators

Measure:

access requests

returning users

battles contributed

parser failures

usefulness of comparisons

📌 Project Status
Actively evolving.

Current priorities:

reliable capture

accurate parsing

safe MCP access

archiving

performance

onboarding

ChatGPT documentation

confidence reporting

broader testing

⚠️ Disclaimer
STFC‑Tool provides community‑created analysis based on available data.
It does not guarantee battle outcomes or account safety.
Use of mods or third‑party tools is at the user’s discretion.
