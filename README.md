STFC-Tool
STFC-Tool is an independent Star Trek Fleet Command battle-analysis platform that captures, parses, stores, and analyzes battle data from the PC game client.
The project combines a PC-side capture workflow, local parsing and storage, a web interface, and a Model Context Protocol (MCP) service that allows ChatGPT to answer questions using observed STFC battle evidence.
> This is an independent community project. It is not affiliated with, sponsored by, or endorsed by Scopely, Paramount, CBS, Discord, Twitch, Cloudflare, or OpenAI.
---
What the Project Does
STFC-Tool helps players understand what actually happened in their battles instead of relying only on displayed power, copied crew lists, or assumptions.
Users can:
Review recent battles
Compare crew setups
Inspect captain, bridge, and below-deck officers
See which officer abilities activated
Analyze damage dealt and received
Review shield damage, hull damage, mitigation, critical hits, and repairs
Compare similar battles against the same hostile or target
Evaluate observed crew and officer performance
Review hostile profiles, weapons, abilities, and mechanics
Analyze solo and group armada participation
Compare player ship performance across encounters
Ask battle-analysis questions through ChatGPT
Query older archived battle information when available
The tool is evidence-based. Recommendations depend on the data available and may vary based on ship tier, ship level, research, buildings, officers, forbidden tech, artifacts, refits, target type, and sample size.
---
Main Website
Battle history and analysis
https://toolbox.punkndrublic.us/my-battles
---
High-Level Architecture
```text
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
```
The public-facing website and MCP endpoints are routed through Cloudflare. The SQLite databases remain local to the host PC and are not directly exposed to users.
---
Project Components
PC Capture
The PC-side integration captures STFC network activity and provides battle data to the local processing pipeline.
Responsibilities include:
Detecting supported game traffic
Capturing battle payloads
Forwarding data for parsing
Avoiding duplicate submissions
Preserving enough source information for later analysis
Local Sync Service
The local TypeScript service handles data ingestion, API access, authentication, and coordination between the website and local databases.
Typical responsibilities include:
Receiving captured game data
Validating submissions
Associating battles with players
Managing API clients and tokens
Enforcing read and write capabilities
Serving website and MCP requests
Tracking recent activity and errors
Parser and Enrichment Layer
The parser converts raw STFC payloads into queryable battle data.
It identifies and calculates information such as:
Battle participants
Ships and targets
Captains and officers
Combat rounds
Standard, isolytic, and apex damage
Shield and hull damage
Critical hits
Mitigation
Hull repair
Officer triggers
Encounter type
Hostile identity
Battle quality and comparison confidence
Web Application
The website provides the primary user interface for reviewing battle history and analysis.
Current entry point:
https://toolbox.punkndrublic.us/my-battles
MCP Service
The MCP service exposes controlled STFC analysis functions to ChatGPT.
Examples include:
Recent battles
Player battles
Battle facts
Battle quality
Crew performance
Officer ability lookup
Officer trigger analysis
Damage and mitigation
Hull repair
Hostile profiles
Group armadas
Encounter scoring
Player ship baselines
Comparison cohorts
Build differences
STFC game-data lookup
Normal public access is intended to be read-only.
---
What ChatGPT Can Analyze
The MCP currently provides access to analysis surfaces covering:
Battle summaries and battle context
Evidence quality and confidence
Per-ship performance
Attack-level mitigation
Crew layouts and officer positions
Officer abilities and observed triggers
Repairs and sustain
Comparable battle groups
Encounter-aware rankings
Hostile identities, components, weapons, and abilities
Reputation gains and losses
Solo and group armada participation
Player ship baselines
Ship, officer, research, building, and modifier snapshots when available
Public STFC game entities and aliases
ChatGPT conversations remain separate. One user's conversation does not merge into another user's conversation.
Multiple users may query the same shared STFC-Tool database, but any benefit from additional users comes from the battle records they contribute—not from sharing ChatGPT conversation history.
---
Example Questions
Users can ask questions such as:
Tell me about my last 20 battles.
Compare my last two crew setups.
Why am I taking so much hull damage?
Which officers activated during this battle?
Did Marlene trigger, and how often?
Which observed crew worked best against this hostile?
Compare my Borg Sphere runs against level 68 Borg hostiles.
How much hull repair did I receive?
Which ship contributed the most damage in this armada?
Why did this ship perform differently from comparable ships?
What changed between these two runs?
How strong is the evidence behind this recommendation?
Which hostiles provide the reputation I need?
---
Data Sources
The project combines several types of information:
Captured Battle Evidence
Observed battle logs provide the actual results used for analysis.
Static Game Data
Public STFC game information is used to identify:
Ships
Officers
Hostiles
Systems
Research
Buildings
Forbidden tech
Abilities
Components
Rewards
Other game entities
Some public reference information may originate from or align with community resources such as STFC.Space.
Player Snapshots
When available, time-stamped snapshots may include:
Operations level
Player power
Ship tier and level
Officer ownership and rank
Research
Buildings
Refits
Projectiles
Forbidden tech
Chaos tech
Artifacts
Other modifiers
These snapshots improve recommendation confidence but may not always be complete or current.
---
Database Design
The project uses local SQLite databases.
Live Database
The live database contains recent and actively queried information.
It is intended to support:
Recent battle views
Website activity
MCP requests
Current comparisons
New battle ingestion
Player and ship snapshots
Archive Database
Older data is moved into a separate archive so the live database remains responsive and stays within the desired storage target.
The archive is intended for:
Older battle history
Historical comparisons
Long-term evidence
Data that does not need to remain in the primary operational database
Database Size Policy
The current target for the live database is approximately 20 GiB.
Maintenance should begin before the database reaches the hard limit. A practical policy is:
Begin archival around 17-18 GiB
Archive and prune until the live database returns to a safer operating range
Avoid waiting until the database is completely full
Backup vs. Archive
A backup and an archive are not the same thing.
A backup exists for disaster recovery.
An archive remains available for historical queries.
Both the live and archive databases should have independent backups.
---
Database Maintenance
Database maintenance should be performed during a quiet period because large SQLite operations can temporarily lock the database.
Recommended sequence:
Pause or reduce ingestion.
Create a verified backup.
Confirm that the backup opens successfully.
Select the oldest eligible records.
Copy complete battle families to the archive.
Verify copied record counts and identifiers.
Remove verified records from the live database.
Run database maintenance as needed.
Confirm live and archive query access.
Resume normal ingestion.
Maintenance operations should be repeatable and safe to restart.
Important safeguards:
Use stable battle or event identifiers
Preserve parent and child relationships
Do not delete before copy verification
Process large moves in batches
Keep a maintenance audit record
Confirm sufficient free disk space before VACUUM
Test restore procedures periodically
---
Authentication and Permissions
The project uses API-client tokens for controlled access.
Recommended client fields include:
```text
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
```
Public User Tokens
Public or beta-user tokens should normally have:
```text
can_read_mcp = 1
can_write_mcp = 0
```
Owner and Administrative Access
Administrative credentials should be separate from normal public tokens.
Administrative capabilities may include:
Token management
Data reimports
Backup and archive maintenance
Database writes
Schema changes
Service configuration
Administrative tools should not be exposed through the ordinary public MCP connection.
Token Rules
Give each user an individual token
Do not publish shared tokens in Discord
Do not place tokens in URL query strings
Avoid logging authorization headers
Store token hashes instead of raw tokens where practical
Allow tokens to be disabled or rotated
Never include production tokens in documentation or screenshots
---
Public Hosting and Cloudflare
The website and MCP are exposed through Cloudflare while the database remains local.
Recommended traffic flow:
```text
Internet
   |
   v
Cloudflare
   |
   v
Authenticated Website / MCP Endpoint
   |
   v
Local Application Services
   |
   v
Local SQLite Databases
```
Recommended protections:
Use Cloudflare Tunnel instead of router port forwarding
Keep origin services bound to localhost or a restricted private interface
Use application-level token validation
Add Cloudflare and application-level rate limits
Apply request-size and result-size limits
Use query timeouts
Restrict concurrent expensive requests
Provide an emergency kill switch
Keep the database outside any public static directory
Do not expose internal service ports publicly
Cloudflare protects the public route, but the application remains responsible for authorization, validation, and safe query behavior.
---
MCP Security
The public MCP should expose purpose-built read tools rather than unrestricted database access.
Public users should not have access to:
Arbitrary INSERT, UPDATE, or DELETE statements
Shell commands
Database maintenance
Token creation
Backup creation
VACUUM
Reimports
Schema changes
User-supplied file paths
Unrestricted filesystem browsing
Read-only operations can still be expensive. MCP tools should enforce:
Required filters
Row limits
Date ranges
Query timeouts
Concurrency limits
Safe path validation
Read-only archive access
Clear error handling
Arbitrary SQL should remain private or administrative whenever possible.
---
Local PC Security
Because the project is hosted from a personal computer, the public services should run with limited system access.
Recommended controls:
Run services under a dedicated Windows account or container
Restrict access to only required application folders
Restrict access to database and archive directories
Do not grant access to personal documents or browser profiles
Keep `.env` files private
Keep Cloudflare credentials private
Use Windows Firewall rules
Remove unused router port forwards
Keep dependencies updated
Monitor CPU, memory, disk, and network activity
---
Rate Limiting and Availability
The primary public risk is service availability rather than secrecy of normal STFC game information.
Recommended protections:
Per-token request limits
Per-IP limits where appropriate
Concurrent-request limits
Smaller limits for archive searches
Maximum upload sizes
Maximum result sizes
Authentication-failure throttling
Database query timeouts
Error and latency monitoring
A connected ChatGPT conversation may make several MCP calls for one answer, so limits should allow normal analysis while preventing runaway or abusive traffic.
---
Environment Configuration
Production secrets belong in a private `.env` file.
A public or committed `.env.example` should contain only blank placeholders.
Example categories:
```dotenv
# Application
NODE_ENV=
PORT=

# Database
STFC_DB_PATH=
STFC_PARSED_DB_PATH=
STFC_DB_BACKUP_DIR=
STFC_DB_TARGET_GIB=

# MCP
STFC_MCP_REQUIRE_API_CLIENT_AUTH=
STFC_MCP_BRIDGE_PORT=
STFC_MCP_PUBLIC_URL=

# Cloudflare
CLOUDFLARE_TUNNEL_TOKEN=

# Integrations
SWATBOT_TOKEN=
```
Never commit real values.
---
Recommended `.gitignore`
```gitignore
# Secrets
.env
.env.*
!.env.example

# Databases
*.db
*.db-shm
*.db-wal
*.sqlite
*.sqlite3

# Data and backups
backups/
archives/
data/
logs/
*.log

# Dependencies and builds
node_modules/
dist/
build/
coverage/

# Python
__pycache__/
*.pyc
.venv/
venv/

# Editors and operating systems
.vscode/
.idea/
.DS_Store
Thumbs.db
```
---
Development Setup
The exact commands may vary by service, but the normal development flow is:
Requirements
Windows
Node.js
npm
Python
SQLite
Cloudflare Tunnel for public routing
STFC PC client and supported capture integration
Install Dependencies
From each Node project directory:
```bash
npm install
```
For Python services:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
Configure Environment
Copy the example file:
```bash
copy .env.example .env
```
Then fill in only the required local values.
Start Services
Use the scripts defined in each package's `package.json` or the project's normal service launcher.
Typical services may include:
Local sync/API service
Web frontend
MCP bridge
Python parser or backend
Cloudflare tunnel
Validate Before Launch
Recommended checks:
```bash
npm run typecheck
npm test
python -m compileall .
```
Also verify:
Website health endpoint
MCP health endpoint
Token authentication
Read-only public access
Rejection of invalid tokens
Rejection of write operations
Battle ingestion
Database backup path
Archive query behavior
---
Testing Public Access
Before giving a token to outside users, test with a normal non-owner token.
Confirm that:
`tools/list` shows only approved public tools
Missing tokens are rejected
Invalid tokens are rejected
Disabled tokens are rejected
Public tokens cannot perform writes
Public tokens cannot access maintenance tools
User input cannot escape archive directories
Queries respect limits
Large or malformed requests fail safely
Cloudflare is the only public route
The origin cannot be bypassed
---
User Access Flow
A practical beta access flow is:
User joins the STFC-Tool Discord.
User reads the rules and setup guide.
User requests access.
An individual token is created.
User installs or configures the supported capture workflow.
User completes several battles.
User opens the web page.
User optionally connects the STFC-Tool to ChatGPT.
User submits bugs and feedback through Discord.
Do not send access tokens in public channels.
---
Connecting to ChatGPT
Approved users can connect the STFC-Tool MCP endpoint to ChatGPT when their plan and workspace support custom apps.
They will need:
The approved MCP server address
Their individual authorization information
Developer Mode when required
A ChatGPT plan or workspace that permits custom MCP apps
Normal user access should remain read-only.
Users should never post:
Access tokens
Authorization headers
Passwords
API keys
Complete database files
Private credentials
---
Discord Community
Discord is intended to support:
New-user onboarding
Installation help
Bug reports
Feature requests
Tool announcements
Service status
Battle submissions
Viewer battle clinics
Crew testing
Twitch community activity
Recommended public structure:
```text
START HERE
#welcome
#about-the-stfc-tool
#rules-and-safety
#start-here
#announcements
#connect-chatgpt

STFC-TOOL
#installation-help
#bug-reports
#feature-requests
#known-issues
#tool-status

BATTLE LAB
#submit-a-battle
#battle-results
#crew-testing
#viewer-battle-clinic

COMMUNITY
#general-stfc
#stream-chat
#clips-and-videos

STAFF
#mod-alerts
#staff-discussion
#support-escalation
#security-incidents
```
Forum channels are recommended for installation help, bug reports, feature requests, and battle submissions.
---
Twitch Integration
The Twitch stream can demonstrate the tool by turning normal gameplay into controlled battle experiments.
Suggested stream structure:
State the test question.
Predict the outcome.
Run several battles.
Analyze the battle logs.
Change one variable.
Retest.
Compare the evidence.
Invite viewer submissions.
Recommended Twitch links:
Use the STFC-Tool
Join the Discord
Watch guides or highlights
View short battle clips
Follow tool and stream updates
The clearest audience path is:
```text
Twitch
   |
   v
STFC-Tool Website
   |
   v
Discord
   |
   v
ChatGPT Connection Guide
```
---
Public Documentation
The source code does not need to be public.
A separate documentation-only repository may contain:
```text
README.md
docs/
  getting-started.md
  using-the-website.md
  connecting-chatgpt.md
  example-questions.md
  troubleshooting.md
  known-limitations.md
  privacy-and-security.md
  faq.md
```
Do not include:
Source code
Database schemas
Production SQL
`.env` files
Tokens
Cloudflare configuration
Internal ports
Local paths
Database files
Backup scripts
Private MCP administration details
---
Known Limitations
Results depend on captured battle quality.
Short or incomplete battles may not provide enough evidence.
Game updates can change identifiers, abilities, or payload formats.
Player research and technology snapshots may be missing or stale.
A strong result for one player may not transfer directly to another player.
Community comparisons depend on sufficient comparable samples.
SQLite performance depends on traffic, query design, disk speed, and maintenance.
Archived searches may be slower than live searches.
ChatGPT may require multiple MCP calls to answer a complex question.
ChatGPT does not automatically retain or merge other users' conversations.
---
Data Quality Principles
The project should distinguish between:
Directly observed battle facts
Static game-data expectations
Player snapshot context
Derived calculations
Inferences
Recommendations
Recommendations should include:
Sample size
Comparison scope
Battle quality
Known missing information
Confidence level
The evidence supporting the conclusion
One battle should not be treated as universal proof.
---
Support and Reporting
Use Discord for:
Installation help
ChatGPT connection help
Account access
Battle-analysis questions
General troubleshooting
Use structured bug reports for confirmed software issues.
A good bug report includes:
```text
Tool page or feature:
What I expected:
What happened:
Approximate time:
Browser:
Operating system:
STFC PC or other:
Battle ID, if available:
Can the issue be repeated?
Screenshots with credentials hidden:
```
Never include passwords, tokens, authorization headers, or private credentials.
Security issues should be reported privately, not through a public issue or Discord channel.
---
Operational Monitoring
Monitor at least:
Live database size
Archive size
Free disk space
Database write failures
SQLite lock errors
Ingestion backlog
API latency
MCP latency
Request volume by token
Authentication failures
CPU usage
Memory usage
Network upload
Cloudflare tunnel health
Backup success
Archive job success
Parser failures
Unknown game identifiers
---
Beta Launch Guidance
A controlled beta is recommended before unrestricted public access.
Suggested starting group:
Existing alliance users
Players from several other alliances
Different operations levels
Different servers
Technically comfortable testers
A small number of content creators
Measure:
Access requests
Successful installations
Returning users
Battles contributed
Repeated support questions
Database growth
Query performance
Parser failures
Usefulness of new comparison data
Support workload
The purpose of adding users is not to merge ChatGPT conversations. It is to increase the range of ships, crews, targets, player builds, and observed battle outcomes available to the shared analysis database.
---
Project Status
The project is actively evolving.
Current priorities include:
Reliable battle capture
Accurate parsing
Safe read-only MCP access
Database archiving and backups
Performance under multiple users
Clear Discord onboarding
ChatGPT connection documentation
Better evidence and confidence reporting
Broader testing outside the original alliance
---
Disclaimer
STFC-Tool provides community-created analysis and recommendations based on available data.
It does not guarantee battle outcomes, crew performance, account safety, or uninterrupted service.
Use of game modifications, capture tools, third-party services, or community resources is the responsibility of the user. Users should review the current terms and policies that apply to their game account and software environment.
All game names, artwork, characters, and trademarks belong to their respective owners.
