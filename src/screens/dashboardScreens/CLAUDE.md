# Chat System — Customer App

## Chat Visibility (MessagesScreen)

A chat appears on the Messages screen ONLY if:
- **Direct message** (no job linked, `chat.job` is null) — always shown
- **Pro's `selectionStatus` is `"offer"` or `"selected"`** — pro has engaged with the customer

Hidden from Messages screen (but still exist in the database and viewable from JobDetailScreen → Other Pros tab):
- `"opportunity"` — pro hasn't responded yet, chat was auto-created by backend
- `"proRejected"` — pro declined the lead
- `"customerRejected"` — customer rejected the pro's offer

Job status (`"active"`, `"ended"`, `"completed"`) does NOT affect chat visibility — the pro's `selectionStatus` doesn't change when a job ends.

### How chats become visible

1. Backend auto-creates chats for every selected pro when a job is submitted (`selectionStatus: "opportunity"`)
2. These chats are hidden from Messages screen
3. Customer can view them from JobDetailScreen → Other Pros tab → tap pro card
4. When customer sends first message in an opportunity chat, backend auto-upgrades `selectionStatus` from `"opportunity"` → `"offer"` (via `MessageEvents.messageCreated` listener)
5. `sendMessage` mutation invalidates `"Chats"` tag → `getChats` refetches → chat now passes the filter → appears on Messages screen

## Chat Features by Job Status (MessagesDetailsScreen)

### Active job (`job.status === "active"`)
- Full chat functionality: text, attachments (camera, gallery, documents, location)
- Offer section visible if pro has `ratePerHour`
- Action bar shown: Call, My Review, My Request
- Three-dot menu: "My request details" + "Cancel service request"

### Ended/completed job (`isJobInactive === true`)
- Text messaging still works
- Attachment picker opens but all options are greyed out (opacity 0.3, non-tappable)
- "Attachments unavailable for ended requests" message shown
- Action bar still shown (Call, My Review, My Request)
- Three-dot menu: only "My request details" (no cancel option)

### Direct message (no job)
- Full chat functionality
- No offer section
- No action bar (Call, My Review, My Request hidden)
- Three-dot menu with limited options

## Data Flow

### Chat types
- `ChatType.job` — full job relation (loaded via LEFT JOIN, always available when chat has a job)
- `ChatType.jobId` — scalar column (was broken due to missing `@JoinColumn`, fixed but use `chat.job?.id` as source of truth)

### Key hooks (src/hooks/)
- `useChatContext(chatPreview)` — derives: proName, lastSeenText, isJobInactive, offerAmount, hasJob, chatId, pro, serviceCategoryId, jobId
- `useMessagePagination(chatId)` — handles page state, message accumulation, dedup, mark-as-read
- `useMessageGroups(messages)` — groups by date, flattens for inverted FlatList, computes read receipts
- `useAttachments({ maxCount, chatId, onMessageSent })` — camera/gallery permissions, CameraRoll, upload, send flow

## Attachment Picker (Bottom Sheet)

Uses `@gorhom/bottom-sheet` v5 with `enableDynamicSizing`.

Layout:
- "Photos & videos" header with "View library" link (red, bold, opens full gallery picker)
- Horizontal photo strip: camera button + recent photos from `CameraRoll.getPhotos()`
- "Upload file" row
- "Location" row

Max 4 attachments. Pending attachments show as 60x60 thumbnails below the input with X-to-remove.

Upload flow: each file uploaded to `POST /files` → returns `storageKey` → passed to `sendMessage` as `files[]`.
