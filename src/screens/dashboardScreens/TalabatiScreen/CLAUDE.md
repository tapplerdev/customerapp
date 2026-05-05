# TalabatiScreen — Job Status & Rendering Logic

## Job Status Lifecycle

```
                         Customer creates job
                                │
                                ▼
                           ┌────────┐
                           │ active │
                           └───┬────┘
              ┌────────┬───────┴───────┬──────────────┐
              ▼        ▼               ▼              ▼
         ┌─────────┐ ┌─────┐   ┌──────────┐  ┌───────────────┐
         │cancelled│ │ended│   │ completed │  │cancelledByTappler│
         └─────────┘ └─────┘   └──────────┘  └───────────────┘
          Customer    Cron       Review         Admin
          cancels     expires    submitted      cancels after
                                (proCompleted   job report
                                 Job = true)
```

### Status Details

| Status | Color | Label | Who triggers | When / How |
|--------|-------|-------|-------------|------------|
| `active` | Green (#00BC3A) | "Active" | System | Job created, waiting for pros |
| `cancelled` | Red | "Cancelled" | **Customer** | Customer calls `PATCH /jobs/:id/cancel` with cancel reasons |
| `ended` | Grey (#707070) | "Expired" | **Cron job** (every minute) | Auto-expires active jobs based on date type (see below) |
| `completed` | Green (#00BC3A) | "Completed" | **Review system** | Customer submits review with `proCompletedJob: true`. If `proCompletedJob: false`, status stays unchanged |
| `cancelledByTappler` | Grey (#707070) | "Expired" | **Admin** | Pro reports job (fake/invalid/ads) → admin processes report as not valid → job cancelled, chat sends `job_cancelled_by_tappler` message |

### Auto-Expiry Rules (cron every minute)

`JobScheduler.handleExpiredJobs()` finds active jobs past their deadline:

| dateType | Expires after |
|----------|--------------|
| `null` (urgent/no date) | 2 hours after `requestedOn` |
| `asap` | 24 hours after `requestedOn` |
| `48hours` | 48 hours after `requestedOn` |
| `notDecided` / `week` | 7 days after `requestedOn` |
| `date` (specific date+time) | After the latest date+timeslot passes |

### All Pros Decline
If all selected pros set `selectionStatus → "proRejected"`, the job stays `"active"`. It does NOT auto-end. Opportunity pros can still send offers. The job eventually expires via the cron job.

---

## Pro Selection Statuses (JobPro.selectionStatus)

| Status | Meaning |
|--------|---------|
| `selected` | Customer picked this pro when creating the job |
| `opportunity` | Pro found the job themselves (bought with points), hasn't sent offer yet |
| `offer` | Pro sent an offer (either responding to selection, or after opportunity) |
| `proRejected` | Pro declined the job request |
| `customerRejected` | Customer passed on an opportunity pro |

### How a pro reaches `offer` status:
- **Selected path**: Customer selects pro → pro responds with offer → `proOfferSentAt` set
- **Opportunity path**: Pro finds job → `opportunity` → pro sends offer → `proOpportunityOfferSentAt` set → customer accepts → `opportunityAcceptedAt` set

---

## Card Rendering

Each job card in the FlatList:

```
┌────────────────────────────────────────────┐
│ Service Category Name           text-15 700│
│ Status: Active/Expired/etc      text-12    │
│ Area: Cairo                     text-12    │
│ Posted: 22 April 2026 9:46PM  ┌──────────┐│
│                               │ Offers 1 ││
│                               └──────────┘│
│ ┌──────────────┬───┐                       │
│ │ Leave Review │ ★ │                       │
│ └──────────────┴───┘                       │
│────────────────────────────────────────────│
└────────────────────────────────────────────┘
```

### 1. Status line
Always the **real backend status** — never overridden with client-side labels.

### 2. Offers badge
Shows when `getOffersCount(job) > 0`. Counts:
```
pros where:
  selectionStatus === "opportunity"
  OR (selectionStatus === "offer"
      AND proOpportunityOfferSentAt exists
      AND opportunityAcceptedAt is null)
```
= opportunity pros whose offers the customer hasn't accepted yet.

### 3. Leave Review button
Shows when `hasPendingReview(job)` is true:
```
pros.some(p => p.selectionStatus === "offer" && !p.review)
```
= any pro who sent an offer but hasn't been reviewed.

### Independence
All three elements are **independent**. Any combination can appear:
- Expired + Offers + Leave Review (all three)
- Active + nothing (no offers, no reviewable pros)
- Expired + Leave Review (pro sent offer, job expired, no review yet)
- Expired + Offers (opportunity pro found job, customer hasn't responded)

---

## Review Eligibility (Backend Validation)

A customer can leave a review when:
1. The pro exists on the job
2. The pro has `selectionStatus === "offer"`
3. The customer hasn't already reviewed that pro

There is **no check on job status** — reviews can be left while the job is still `"active"` or after it's `"ended"`.

## Review Scoring

`proCompletedJob` is stored as metadata only — it does **NOT** factor into the pro's review score or ranking algorithm. The `overallScore` is calculated as the average of the 5 star categories (quality, completion in time, job awareness, honesty, response time). The `ProReviewScoreEntity` has no `proCompletedJob` field.

## Key Rule
**Never use "Pending review" as a status label.** It's not a real backend status. The review button is a separate UI element.
