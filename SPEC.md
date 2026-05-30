# TeamProxy — Product Specification

## What Is TeamProxy?

TeamProxy is a web application that lets people read and send Microsoft Teams messages **without needing a Microsoft Teams account or license**. An administrator connects their organization's Microsoft Teams account, picks which conversations to share, and invited users can then chat through a simple web interface.

Think of it as a **private window into selected Teams conversations** — the admin controls who sees what, and who can reply.

---

## Who Is It For?

| Role | Who They Are | What They Can Do |
|---|---|---|
| **Admin** | The person who sets up the app. Has a Microsoft Teams account with the right permissions. | Connects Microsoft Teams, manages which chats are visible, controls who can send messages, manages the MS connection. |
| **User** | Anyone the admin gives login credentials to. Does **not** need a Microsoft account. | Views allowed chats, reads messages in real-time, sends messages (if the admin allows it for that chat). |

---

## Features

### 1. Logging In

- Everyone logs in with a username and password provided by the admin.
- There are no sign-up pages, no email verification, no "forgot password." The admin creates credentials manually through environment configuration.
- A login session lasts **30 days** — after that, the user needs to log in again.
- There is rate limiting on login attempts to prevent brute-force attacks (max 5 attempts per minute from the same network).

### 2. Connecting Microsoft Teams (Admin Only)

- On the **Settings** page (visible only to admins), the admin clicks **"Connect"** to link their Microsoft Teams account.
- This redirects to Microsoft's login page. The admin signs in and authorizes the app.
- Once connected, the app can:
  - Read chat messages
  - Send messages on the admin's behalf
  - Receive real-time notifications when new messages arrive
- The connection stays active automatically — the app refreshes the Microsoft token every 5 minutes behind the scenes.
- If the connection breaks (e.g., the admin revokes permission in Microsoft), the admin must reconnect manually.
- The admin can **disconnect** at any time from Settings, which immediately stops all access to Teams data.

### 3. Browsing Chats

- After logging in, users land on the **Chats** page — a sidebar listing all conversations the admin has made visible to them.
- Each chat in the sidebar shows:
  - A name or the other person's name
  - A small icon indicating the chat type (direct message, group chat, or meeting chat — meeting chats are group chats associated with a Teams meeting)
  - A preview of the most recent message
  - A dot indicator when there are unread messages
  - How long ago the last message was sent
- The list updates in real-time — when a new message arrives in any chat, the sidebar preview changes instantly without reloading the page.
- On mobile, users see either the chat list or the conversation. On desktop, both are shown side by side.

### 4. Reading Messages

- Clicking a chat opens the **conversation view** showing messages in chronological order.
- Messages load in pages of 20. Scrolling to the top loads older messages.
- **Own messages** appear on the right side (green accent). **Other people's messages** appear on the left.
- **Images** display inline and can be opened in a full-screen lightbox viewer with pinch-to-zoom and pan support.
- **System events** (someone was added, someone left, the topic was changed, etc.) appear as centered neutral pills in the message timeline.
- If the user is scrolled near the bottom, new messages auto-scroll into view. If they've scrolled up reading older messages, a **"N new"** button appears to jump to the latest messages.

### 5. Sending Messages

- At the bottom of the conversation is a message input box.
- **Press Enter to send.** Shift+Enter for a new line.
- The admin controls whether users can send messages **per chat**. If sending is disabled for a chat, the input area is hidden.
- When a user sends a message, it appears immediately in the conversation with a loading spinner. Once the app confirms it was delivered to Teams, the spinner disappears. If delivery fails, an error message appears inline.
- Messages are sent as the connected Microsoft account (the admin's account).

#### @ Mentions

- Typing `@` in the message box opens a dropdown listing members of that chat (including external/guest participants).
- The user can scroll through the list or keep typing to filter. Arrow keys and Enter select a member.
- Selected mentions appear as `@Name` in the input and are delivered as proper Teams mentions (the person gets notified).

#### Image Attachments

- Users can attach one image per message using the paperclip button.
- Images must be under **3 MB**.
- The image appears as a preview above the input before sending. It can be removed before sending.

### 6. Real-Time Updates

The app updates live without refreshing the page:

| What Happens | What The User Sees |
|---|---|
| A new message arrives in any visible chat | Sidebar preview updates instantly. If the chat is open, the message appears in the conversation. |
| The admin makes a new chat visible | The chat appears in the user's sidebar immediately. |
| The admin hides a chat | The chat disappears from the user's sidebar immediately. If the user had it open, they're returned to the empty state. |
| The admin toggles send permission | The message input appears or disappears for all users in that chat. |

If the connection drops, the app automatically reconnects and resumes from the last received message using oRPC's built-in reconnection. Missed messages are filled in automatically.

### 6.1 Connection Issues & Error States

The app handles problems gracefully. The user should never need to manually refresh the page.

| What Happens | What The User Sees |
|---|---|
| Brief network drop (< 5s) | Nothing — auto-reconnects via oRPC's `retry: true`, resumes from `lastEventId`. No messages missed. |
| Extended outage (> 5s) | A subtle "Reconnecting…" indicator in the header. Disappears once reconnected. Missed messages filled in via `lastEventId` resume. |
| Server restart | Same as extended outage — auto-reconnects and resumes from the last received event. |
| Microsoft API rate-limited | Sending shows inline error: "Couldn't send — please try again in a moment." User can retry. Reading continues from cached data. |
| Microsoft connection lost (admin revoked) | Users see a banner: "Teams connection is offline." Chats show last-known messages, no new updates. Admin must reconnect. |
| Message delivery fails | Message appears inline with an error indicator and a "Retry" button. Does not disappear. |
| Image upload exceeds 3 MB | Rejected immediately with "Image must be under 3 MB" shown below the input. |
| Image rejected by Teams API | Same as message delivery failure — error inline with retry option. |
| Webhook subscription gap | Invisible to the user. When the subscription renews, the app fetches missed messages and backfills them into the conversation and sidebar. |

### 7. Chat Management — Admin Settings

On the **Settings** page (admin-only), the admin can:

#### Microsoft Teams Connection

- See whether Microsoft Teams is connected and when the token expires.
- Connect or disconnect the Microsoft account.

#### Chat Visibility Table

- A paginated table listing **every chat** available in the connected Microsoft Teams account.
- For each chat, two toggle switches:
  - **Visible** — when ON, this chat appears in users' sidebars. When OFF, users can't see it.
  - **Can Reply** — when ON, users can send messages in this chat. When OFF, the chat is read-only for users.
- Each row also shows the **webhook subscription status**: Active (receiving live updates), Expired (will be renewed automatically), or None (no live updates — will be set up automatically).
- Toggles take effect immediately across all connected users.

---

## How It Works Behind The Scenes

This section explains the moving parts in plain language.

### Webhook Subscriptions (How New Messages Arrive)

Microsoft Teams doesn't push messages to the app automatically. Instead:

1. The app creates a **subscription** with Microsoft for each visible chat, saying "tell me when a new message is created in this chat."
2. These subscriptions last **at most 1 hour** (set to 55 minutes).
3. Every **15 minutes**, a background job renews subscriptions that are about to expire and creates new ones for chats that are missing subscriptions.
4. When Microsoft detects a new message, it sends a notification to the app's webhook endpoint.
5. The app validates the notification, fetches the full message from Microsoft, and pushes it to all connected users in real-time.

There is a small gap risk: if a subscription expires before the next renewal cycle, messages during that window are missed. They would appear when the user scrolls to load history.

### Message Security

- Microsoft OAuth tokens are encrypted with **AES-256-GCM** encryption before being stored in the database.
- The encryption key is set via an environment variable and never exposed to the frontend.
- Session cookies are `httpOnly` (inaccessible to JavaScript) and validated against the database on every request.
- All passwords are compared using **timing-safe comparison** (preventing timing attacks).

### Data Storage

All data is stored in a single **SQLite database file**:

| Data | Purpose |
|---|---|
| **Sessions** | Tracks who is logged in. Auto-cleaned after 30 days. |
| **OAuth Tokens** | The encrypted Microsoft connection tokens. Old inactive tokens cleaned after 7 days. |
| **Allowed Chats** | Which chats are visible and reply-enabled, plus webhook subscription details. |

### Background Jobs

| Frequency | Job | What It Does |
|---|---|---|
| Every 5 minutes | Token Refresh | Checks if the Microsoft token is about to expire and refreshes it. If refresh fails, marks the connection as inactive (admin must reconnect). |
| Every 15 minutes | Subscription Renewal | Renews webhook subscriptions that are expiring soon. Creates subscriptions for any visible chats that don't have one yet. |
| Daily at 3 AM | Cleanup | Deletes expired login sessions and old inactive tokens to keep the database small. |

---

## Page Map

| URL | Who Sees It | What's On It |
|---|---|---|
| `/login` | Everyone (when not logged in) | Login form — username and password fields. |
| `/chats` | All logged-in users | Main interface — chat sidebar on the left, conversation on the right. |
| `/settings` | Admins only | MS connection card + chat visibility management table. |

The header on every page (once logged in) shows the app name, the user's role icon, and a dropdown menu with links to Chats, Settings (admin only), and Sign Out.

---

## Limitations

- **One Microsoft account**: The app connects to a single Microsoft Teams account. All messages are sent as that account.
- **No message editing or deletion**: Users can send messages but cannot edit or delete them through the app.
- **No file attachments**: Only image attachments are supported (no PDFs, documents, etc.).
- **No search**: There is no message search functionality.
- **No group creation**: Users cannot create new chats — they can only interact with chats the admin has shared.
- **Subscription gap**: If a webhook subscription expires before renewal, messages sent during that gap are missed in real-time (still available via history loading).
- **Teams channels**: The underlying code has support for Microsoft Teams channels (not just chats), but this is not yet exposed in the user interface.
