STFC-Tool User Guide
STFC-Tool is an independent community battle-analysis and alliance-support tool for Star Trek Fleet Command.
Players can now register directly through the STFC-Tool website. Discord approval is no longer required to create an account or begin uploading battles.
STFC-Tool works with the existing STFC Community Mod. You do not need to install a separate mod. After registering, the website generates a sync block that you add to your existing community_patch_settings.toml file. New battle logs are then uploaded automatically while you play.
STFC-Tool helps players:
Automatically preserve their battle history
Search battles by hostile, level, ship, player, crew, or date
Compare crew setups using actual battle results
Review officer activity and combat mechanics
Analyze damage, mitigation, critical hits, hull loss, shields, and repairs
Review solo and group armada participation
Ask questions about stored battles through ChatGPT or Claude
Manage alliance Territory Capture reminders through Discord
STFC-Tool uses actual captured battle evidence. Results can vary based on ship tier, level, officers, research, buildings, technology, target, combat conditions, and the number of comparable battles available.
Register and Connect
Start here:
https://toolbox.punkndrublic.us/alliance-start
Registration asks for:
STFC player name
Alliance name
Optional alliance invite code
Battle-sharing preference
STFC-Tool does not ask for:
Your Scopely login
Your Scopely password
Your email password
Payment information
Discord credentials
Your real-world name or address
Your STFC player name is used to connect your access token and uploaded battle logs to the correct in-game identity.
After registration, save the access token provided by the website. Treat the token like a password and do not post it publicly.
Connect the STFC Community Mod
STFC-Tool uses the sync-target feature already available in the STFC Community Mod.
You do not need to download or install a separate STFC-Tool mod.
After registering:
Copy the generated [sync.targets.alliance] configuration block.
Open your existing community_patch_settings.toml file.
Paste the block into the file.
Save the file.
Restart STFC and the Community Mod.
Complete several battles.
Open STFC-Tool and confirm that the battles appear.
The configuration sends a copy of new battle logs to:
https://battleapi.punkndrublic.us/submit
The access token identifies which registered player owns the uploaded logs.
The exact location of community_patch_settings.toml can vary by operating system and Community Mod installation.
Open Your Battles
Use the battle-history page here:
https://toolbox.punkndrublic.us/my-battles
Once your mod connection is active, new battle logs should appear automatically.
The battle database can be searched by information such as:
Player
Ship
Hostile or target
Hostile level
Captain
Bridge crew
Below-deck crew
Date or battle range
Battle or event ID
Examples include:
Find my level 71 Academy Drone battles.
Show every battle using my Vengeance.
Find battles against this hostile.
Show the crew I used the last time this fight went well.
Compare matching battles using two different crew setups.
Some records may contain incomplete information if the capture was interrupted or the underlying game data could not be fully parsed.
What STFC-Tool Can Analyze
Depending on the battle and available game data, STFC-Tool may display or calculate:
Battle date and time
Player and target
Ship and hostile information
Captain and bridge officers
Below-deck officers
Combat rounds
Attacks performed
Damage dealt
Damage received
Shield damage
Hull damage
Net hull loss
Critical-hit rate
Mitigation
Repairs
Officer activations
Armada participation
Comparable battle results
Estimated hostiles defeated per full hull
The most useful grinding comparison is usually not which crew dealt the most damage. It is which crew produced the lowest hull loss per successful kill under comparable conditions.
Battle Sharing
Registration includes a battle-sharing setting.
Sharing enabled
Your eligible battles may appear in searches and comparisons performed by other registered STFC-Tool users.
This can improve community comparisons by adding more observed ships, crews, targets, and outcomes.
Sharing disabled
Your battles will not be returned in another user’s website or AI comparison queries.
You can still access and analyze your own battles using your own registered token.
Sharing does not provide other users with access to:
Your ChatGPT or Claude conversations
Your assistant history
Your personal instructions
Your ChatGPT memory
Your access token
Your game login information
The sharing setting applies to stored STFC battle evidence, not private AI conversations.
Connecting STFC-Tool to ChatGPT or Claude
Registered users can connect STFC-Tool through its MCP connection.
This allows ChatGPT or Claude to search approved STFC-Tool data and answer questions using actual stored battle evidence instead of relying only on general crew advice.
You will need:
A registered STFC-Tool account
Your individual STFC-Tool authorization information
A supported ChatGPT or Claude account
Support for custom MCP connections or apps
Connection instructions are available through the website setup process.
Never publish your:
Access token
Authorization header
MCP credentials
Private configuration
Screenshots containing complete credentials
The exact setup screens may vary by platform, plan, workspace, and product version.
Example AI Questions
After connecting STFC-Tool, try questions such as:
Tell me about my last 20 battles.
Review my most recent battle.
What crew did I use the last time I fought this hostile?
Compare my last two crew setups.
Why am I taking so much hull damage?
Which officers activated during this battle?
How often did this officer trigger?
Which observed crew had the lowest hull loss against this hostile?
Compare my recent Borg Sphere runs.
How much hull repair did I receive?
Which ship contributed the most damage in this armada?
What changed between these two runs?
How strong is the evidence behind this result?
Find comparable battles using this ship and target.
Show my level 71 Academy Drone battles.
Find all of my Vengeance battles against this hostile.
Estimate how many of these hostiles I can defeat on one full hull.
For better results, include the ship, target, hostile level, date range, or event when known.
Complex questions may require the assistant to perform several STFC-Tool queries.
Your AI Conversation Is Private
Each person’s ChatGPT or Claude conversation remains separate.
Another STFC-Tool user cannot see:
Your conversation
Your conversation history
Your personal instructions
Your assistant memory
The conclusions discussed in your chat
Registered users may contribute battle evidence to the same STFC-Tool database when sharing is enabled, but their AI conversations are not merged or exposed.
STFC-Tool does not train ChatGPT or Claude on private user conversations.
How to Test a Crew Properly
For a useful crew comparison:
Use the same player.
Use the same ship.
Keep the ship tier, level, and build consistent.
Fight the same target type and level.
Avoid changing research, buildings, artifacts, technology, or other major modifiers during the test.
Change only one officer, position, or controlled variable at a time.
Run several battles with each setup.
Compare successful kills, hull loss, repairs, rounds, mitigation, critical hits, and officer triggers.
One battle may show what happened, but it usually does not prove that one crew is consistently better.
Small samples should be treated as observed results rather than guaranteed recommendations.
Understanding Results and Recommendations
STFC-Tool may use several types of evidence.
Observed Battle Facts
Information captured directly from uploaded battle logs.
Game Reference Information
Available information about ships, officers, hostiles, abilities, and STFC combat mechanics.
Player and Ship Context
Available information about the player’s ship, crew, research, buildings, technology, and other modifiers.
Comparable Battles
Results from battles that are similar enough to provide a meaningful comparison.
Strong comparisons normally use:
The same player
The same ship
A comparable ship level, tier, and build
The same hostile or target
The same target level
The same encounter type
Similar bridge and below-deck conditions
Inferences
A conclusion drawn from the available evidence when the exact answer is not directly recorded.
Recommendations are more reliable when:
Several comparable battles are available
The same ship and target are used
Only one variable changes
The battle capture is complete
Current player and ship information is available
The comparison measures the player’s actual goal
For hostile grinding, lower hull loss per successful kill is usually more useful than total damage dealt.
Alliance Territory Capture Reminders
STFC-Tool also supports alliance Territory Capture scheduling.
An alliance can configure reminders for its Territory Capture zones. The system can then send scheduled reminders to the alliance’s Discord server.
The reminder message can be copied into in-game alliance chat by a player.
Depending on the alliance’s private setup and installed tools, additional communication-relay features may also be available.
Territory Capture reminders do not move ships, join capture events, or perform gameplay actions for the player.
Discord
Discord is available for support, testing, bug reports, feature requests, and community discussion.
Discord invite:
https://discord.gg/YsXgcrFe7
Recommended areas may include:
#start-here
#installation-help
#connect-chatgpt
#bug-reports
#feature-requests
#submit-a-battle
#tool-status
#announcements
Discord membership is not required merely to register for STFC-Tool.
Do not post access tokens or private connection credentials in a public Discord channel.
Who Can Use STFC-Tool?
STFC-Tool is most useful for players who:
Use the STFC Community Mod
Want their battle history saved automatically
Frequently test ships, crews, and hostiles
Want to find an older successful crew
Want evidence-based crew comparisons
Participate in solo or group armadas
Use ChatGPT or Claude
Help manage alliance Territory Capture reminders
You do not need to be a technical expert.
The initial setup consists primarily of registering, copying the generated TOML block, pasting it into the existing Community Mod configuration, and restarting the game.
Known Limitations
Results depend on the quality of captured battle data.
Only battles uploaded after configuration can be guaranteed to appear.
Short battles may not provide enough evidence for some officer mechanics.
Missing battle events can affect calculations.
Player research and technology information may be incomplete or outdated.
A crew that works for one player may perform differently for another.
Some comparisons may have too few matching battles.
Game updates can temporarily affect parsing or identification.
Archived searches may take longer than recent-battle searches.
Complex AI questions may require several tool calls.
Recommendations cannot guarantee a specific battle outcome.
Website, Discord, or AI features may occasionally be unavailable.
Reporting a Bug
Use the bug-report area in Discord.
Include:
Tool page or feature
What you expected
What happened
Approximate date and time
Browser
Operating system
STFC player name
Battle or event ID, when available
Whether the problem can be repeated
Screenshots with credentials and unrelated personal information hidden
Never include:
Passwords
Access tokens
API keys
Authorization headers
Private MCP credentials
Complete private configuration files
Complete database files
Requesting a Feature
Use the feature-request area in Discord.
Describe:
The problem you are trying to solve
What you expected the tool to help accomplish
An example battle, alliance, or analysis situation
Whether it applies to the website, Discord, Community Mod upload, AI connection, or battle analysis
Why the feature would be useful to other players
Feature requests are more useful when they explain the underlying problem instead of only proposing a button or screen.
Access and Safety
Each registered user receives individual access.
Please do not:
Share your access token
Post credentials publicly
Use another player’s registered identity
Attempt to modify another user’s data
Attempt to bypass access controls
Attempt to overload or disrupt the service
Use the tool for harassment or targeted abuse
Access may be limited or removed when it is shared, abused, or used to disrupt the service.
Your STFC player name and battle information may already be visible during normal alliance activity, armadas, PvP, rankings, chat, and battle reports. STFC-Tool uses the player name to associate voluntarily uploaded battle records with the correct registered user.
STFC-Tool does not require your Scopely username, password, or real-world identity.
Service Availability
STFC-Tool is an independently operated community project.
The website, Discord integration, battle upload endpoint, or AI connection may occasionally be unavailable because of:
Maintenance
Game updates
Parser changes
Database maintenance
Network interruptions
Feature testing
Unexpected errors
Service notices may be posted in the Discord #tool-status or #announcements channels.
Twitch and Community Testing
STFC-Tool may be demonstrated during Twitch streams through:
Crew comparisons
Hostile tests
Battle-log reviews
Viewer battle clinics
Officer-trigger analysis
Damage, mitigation, repair, and hull-loss comparisons
Search demonstrations using stored battle history
ChatGPT or Claude battle questions
Twitch channel:
https://www.twitch.tv/punkndrublic01
Frequently Asked Questions
Is STFC-Tool official?
No. It is an independent community-created project.
Do I need to request approval through Discord?
No. Players can register directly through the STFC-Tool website.
Do I need to install a separate mod?
No. STFC-Tool uses the sync-target functionality in the existing STFC Community Mod.
What do I add to the mod?
The website generates a TOML sync-target block. Copy it into your existing community_patch_settings.toml file and restart the game and mod.
Why does registration ask for my STFC player name?
The player name connects your token and uploaded battle logs to the correct in-game identity. It is not used as a Scopely login.
Is my STFC player name personal information?
It identifies your game account, but it is already visible during normal gameplay, alliance activity, chat, armadas, PvP, rankings, and battle reports. STFC-Tool does not require your legal name, email login, home address, payment information, or Scopely credentials.
Can I use the website without ChatGPT or Claude?
Yes. The AI connection is optional.
Can another user see my AI conversation?
No. AI conversations remain separate.
Can another user search my battles?
Only when your battle-sharing setting allows your eligible records to be included in registered-user searches and comparisons.
Can I turn sharing off?
Yes. When sharing is disabled, your data will not be returned in another user’s website or AI comparison queries. You can still access your own data.
Does adding more users improve the tool?
Yes. Sharing-enabled battles can improve comparisons by adding more ships, crews, targets, and observed outcomes. It does not combine users’ AI conversations.
Can STFC-Tool guarantee that a crew will work?
No. It reports available evidence and makes recommendations based on comparable battles and known combat context.
Why can I not see my latest battle?
Possible causes include:
The TOML sync block is missing or incorrect
The game or mod was not restarted
The access token is incorrect
The battle is still processing
The player link does not match
The upload endpoint was temporarily unavailable
The battle capture was incomplete
Does STFC-Tool control my game?
The public battle-history connection uploads battle logs through the existing Community Mod sync-target feature. It does not move ships, start battles, join armadas, claim rewards, or play the game for you.
Project Links
Registration and setup:
https://toolbox.punkndrublic.us/alliance-start
Battle history:
https://toolbox.punkndrublic.us/my-battles
Discord:
https://discord.gg/YsXgcrFe7
Twitch:
https://www.twitch.tv/punkndrublic01
Independent Project Disclaimer
STFC-Tool is an independent community-created project.
It is not affiliated with, sponsored by, or endorsed by Scopely, Paramount, CBS, Discord, Twitch, Cloudflare, OpenAI, Anthropic, the STFC Community Mod maintainers, Spock’s Club, or STFC.Space.
All game names, characters, artwork, and trademarks belong to their respective owners.
STFC-Tool provides community-created storage, search, communication support, and analysis based on available information. It does not guarantee battle outcomes, account safety, uninterrupted service, or continued compatibility with future game or Community Mod updates.
