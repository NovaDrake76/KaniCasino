# KaniCasino Discord bot

Read-only. It shows what a player has and where they stand; opening cases, spending and
everything else stays on the site. That split is deliberate: the bot is how people find
KaniCasino, not a second place to play it.

## Commands

| | |
| --- | --- |
| `/link` | attach a Discord user to a site account, once |
| `/showcase [player]` | pinned character, level, fan rank, collection |
| `/topfan <character>` | who in this server collects that character hardest |
| `/leaderboard [sort]` | the players in this server, by level or collection |
| `/help` | what this is |

## Setup

```
cd bot
npm install
cp .env.example .env      # fill it in
node src/register.js <guildId>   # a test server, instant
npm start
```

`node src/register.js` with no argument registers globally, which can take up to an hour to
propagate. Only rerun it when a command's name, description or options change.

`DISCORD_BOT_SECRET` must match the one in `backend/.env`. Everything under `/discord/*`
checks it, because the site API key ships inside the frontend bundle and guards nothing.

## How linking works

`/link` asks the backend for a short code and answers privately with a URL. Opening that
URL while logged in on the site attaches the Discord account to whichever account holds
that session. The bot never sees a password and cannot link an account on its own: the
website session is the proof of who is being linked.

Codes last 15 minutes and Mongo expires the row itself. A Discord account created in the
last 30 days is refused, which costs nothing to check because the snowflake carries its
own creation time.

## Server boards

A player joins a server's board by running a command there, not by being a member. So the
bot never needs the member list, never asks for a privileged intent, and a board shows the
people who actually play rather than everyone in the channel.

## What it costs

Every endpoint the bot calls projects the inventory away and is bounded:

- `/showcase` is one document, read by an indexed `discordId`.
- `/topfan` is one fan board document plus an `$in` capped at the 50 rows that board keeps.
- `/leaderboard` is an indexed lookup on `discordGuilds`, limited to 15.

Nothing here counts an inventory, and nothing runs on a timer. Commands are also rate
limited per user in the bot's own memory, so spam is a map lookup rather than a query.
