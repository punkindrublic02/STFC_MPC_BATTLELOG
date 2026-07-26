STFC-Tool User Guide
STFC-Tool is an independent battle-analysis and alliance-support tool for Star Trek Fleet Command. It allows you to store battle logs automatically, review combat mechanics, and query your battle history using AI assistants like ChatGPT and Claude.
Registration & Name Linking
Start setup here: https://toolbox.punkndrublic.us/alliance-start
Registration requires:
•	STFC In-Game Name (Must match your exact in-game player name)
•	Alliance Name
•	Battle-sharing preference
Why Your In-Game Name Matters
STFC-Tool does not collect personal identification (real name, email passwords, Scopely logins, or payment details).
Instead, your in-game name connects your access token to your uploaded battle logs.
When asking questions in ChatGPT or Claude, the AI relies on this matched identity to pull your specific ship setups, officer triggers, and battle history rather than generic or unassigned data.
Important: Once registered, save the generated Access Token. Treat this token like a password and do not share it publicly.
Connecting to the STFC Community Mod
STFC-Tool uses the built-in sync features of the existing STFC Community Mod—no extra mod installation is required.
1.	Copy the generated [sync.targets.alliance] configuration block from the website.
2.	Open your existing community_patch_settings.toml file.
3.	Paste the block into the file and save.
4.	Restart STFC and the Community Mod.
The access token inside the TOML block routes your battle logs to your registered identity on the server.
Using ChatGPT & Claude (MCP Integration)
Connecting STFC-Tool via its Model Context Protocol (MCP) connection allows ChatGPT or Claude to search your battle records and answer questions using your actual gameplay data.
Because your Access Token is mapped to your STFC In-Game Name, the AI can seamlessly answer questions like:
•	"Review my most recent battle."
•	"What crew did I use the last time I fought a level 71 Academy Drone?"
•	"Compare my last two crew setups on my Vengeance and show which had lower hull loss."
•	"Which officers triggered most often during my last armada?"
AI Privacy
•	Your AI conversations are completely private.
•	Other users cannot see your prompts, history, or custom instructions.
•	STFC-Tool does not train AI models on private user conversations.
Key Rules & Security
•	Keep your token secure: Never share your access token, authorization headers, or private TOML configurations.
•	Control your data: You can toggle battle sharing on or off during registration. When disabled, your logs are hidden from community-wide comparisons and accessible only by you.
•	No game control: STFC-Tool only reads combat logs; it cannot interact with your game or execute actions for you.
Quick Links
•	Register / Connect: https://toolbox.punkndrublic.us/alliance-start
•	Battle History: https://toolbox.punkndrublic.us/my-battles
•	Discord Community: https://discord.gg/YsXgcrFe7
•	Twitch Stream: https://www.twitch.tv/punkndrublic01

