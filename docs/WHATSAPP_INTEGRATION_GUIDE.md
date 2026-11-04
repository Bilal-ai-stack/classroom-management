# ClassroomOS — WhatsApp Notification Integration & Technical Reference Guide

This document provides a comprehensive technical and operational reference for WhatsApp guardian notifications in **ClassroomOS 2.1.2**, covering the active **Manual Click-to-Chat (`wa.me`)** engine and the optional **Automated WhatsApp Business Cloud API** architecture.

---

## 1. Executive Summary & Messaging Architecture

ClassroomOS supports two distinct communication modes for guardian attendance alerts:

| Capability | Manual Click-to-Chat (`wa.me`) | Automated Cloud API (`v21.0`) |
| :--- | :--- | :--- |
| **Status in ClassroomOS** | **Active & Production-Ready** | Optional Enterprise Upgrade |
| **Setup Cost** | **\$0.00 (Free Forever)** | Requires Meta Business Verification |
| **Monthly / Per-Message Cost** | **Zero API charges** | Meta Conversation-based billing |
| **Hardware / App Required** | WhatsApp Web or WhatsApp Desktop | Cloud-to-Cloud server integration |
| **Sender Identity** | Educator or School's WhatsApp account | Official Verified Business Profile |
| **Dispatches** | Educator confirms send inside WhatsApp | Completely automated server dispatch |
| **Audit Status in ClassroomOS** | `prepared` (Link Prepared - Manual) | `sent` / `delivered` via Webhooks |

---

## 2. Why Manual Mode Requires Pressing "Send" Inside WhatsApp

A primary user question is: **"Why does WhatsApp open without automatically sending the message?"**

### The Technical & Security Rationale

1. **Browser Sandboxing & Web Security**: Web applications running in modern browsers (Chrome, Edge, Firefox, Brave) operate within a strict sandbox. A website or local application cannot programmatically inject keystrokes or simulate clicks inside external software or third-party web domains (such as `web.whatsapp.com`).
2. **Meta Anti-Spam Protocol**: Meta designed the official WhatsApp click-to-chat URL protocol (`https://wa.me/<number>?text=<encoded_text>`) exclusively as an *intent to chat*. The protocol automatically opens the conversation with the recipient and populates the text input box with the pre-filled message. **Meta explicitly forbids third-party systems from triggering message transmission without the account owner pressing "Send" or Enter.**
3. **Educator Review & Safeguard**: This manual step ensures teachers have a final opportunity to review, personalize, or correct student attendance messages before they are dispatched to parents.

### Accurate Status Reporting (Honesty in Logging)

ClassroomOS adheres to a strict data integrity rule: **Never report a message as "sent" or "delivered" without verified receipt confirmation.**
- When an educator clicks **Open in WhatsApp**, ClassroomOS records the action in `whatsapp_notifications` with `mode='manual_link'` and `status='prepared'`.
- The Admin Portal displays this status with an informational blue badge: `Link Prepared (Manual)`.
- Statuses such as `sent` or `delivered` are strictly reserved for verified webhook receipts from Meta Cloud API.

---

## 3. Phone Number Normalization & Regional Formatting

In ClassroomOS 2.1.2, both the frontend (`phoneUtils.js`) and backend (`phase4_quality/phone_utils.py`) implement robust normalization for Pakistani local numbers and international E.164 formats.

### Pakistani Number Formats Handled

Pakistan mobile numbers typically use network prefixes like `0300`, `0301`, `0312`, `0321`, `0333`, `0345`, `0355`. When entered by guardians or school administrators, they often include spaces, hyphens, or leading zeros.

| Raw Entry Format | Detected Type | Normalized (`wa.me`) | Display E.164 | Status |
| :--- | :--- | :--- | :--- | :--- |
| `03001234567` | Local 11-digit | `923001234567` | `+92 300 1234567` | Valid |
| `0300-1234567` | Hyphenated local | `923001234567` | `+92 300 1234567` | Valid |
| `0321 7654321` | Spaced local | `923217654321` | `+92 321 7654321` | Valid |
| `3001234567` | 10-digit without 0 | `923001234567` | `+92 300 1234567` | Valid |
| `+92 300 1234567` | International E.164 | `923001234567` | `+92 300 1234567` | Valid |
| `00923001234567` | Exit code format | `923001234567` | `+92 300 1234567` | Valid |

> [!IMPORTANT]
> **Why numbers failed previously:** WhatsApp's `wa.me` protocol requires the international country code without a leading `+` or leading `0`. Passing `03001234567` directly caused WhatsApp to look for country code `0`, triggering: *"Phone number shared via url is invalid"*. Normalizing `03xx` to `923xx` completely resolves this failure.

### International Formats Handled

| Raw Entry Format | Country | Normalized (`wa.me`) | Display E.164 |
| :--- | :--- | :--- | :--- |
| `+1 (555) 234-5678` | North America (+1) | `15552345678` | `+1 555 234 5678` |
| `+44 7911 123456` | United Kingdom (+44) | `447911123456` | `+44 7911 123456` |
| `+971 50 123 4567` | UAE (+971) | `971501234567` | `+971 50 123 4567` |
| `+966 50 123 4567` | Saudi Arabia (+966) | `966501234567` | `+966 50 123 4567` |

---

## 4. Attendance Notification Templates

ClassroomOS generates student-specific, contextual notices that interpolate:
- Guardian Name
- Student Name
- Class Name and Section
- Student Roll Number
- Date of Attendance
- Official School Name (configured in Admin Settings)

### Template Options

1. **Absent Notice**:
   > *"Dear Mr. Khan, this is an official attendance notice from Springfield Academy. Your child Ali Khan (Class Grade 5, Section A, Roll #12) was marked ABSENT today (2026-11-03). Please contact the school office if you have any questions or to submit an excuse note."*
2. **Late Arrival Notice**:
   > *"Dear Mr. Khan, this is an official attendance notice from Springfield Academy. Your child Ali Khan (Class Grade 5, Section A, Roll #12) arrived LATE to class today (2026-11-03)."*
3. **Present Notice**:
   > *"Dear Mr. Khan, this is to inform you that your child Ali Khan (Class Grade 5, Section A, Roll #12) was marked PRESENT today (2026-11-03) at Springfield Academy."*
4. **General Notice**:
   > *"Dear Mr. Khan, this is an official attendance notice regarding Ali Khan (Class Grade 5, Section A, Roll #12) from Springfield Academy."*

Teachers can edit the message directly in the preview modal or click **Copy Text** to paste into desktop WhatsApp or email.

---

## 5. Automated WhatsApp Business Cloud API (Setup & Costs)

For institutions seeking fully automated background dispatches without manual teacher clicks, ClassroomOS includes the foundational schema and Admin Settings interface for Meta's official WhatsApp Business Cloud API.

### Technical Architecture

```
[ ClassroomOS Server ]
       |
       | HTTPS POST /v21.0/{phone_number_id}/messages
       v
[ Meta Graph API ] ---> [ WhatsApp Network ] ---> [ Guardian Device ]
       ^
       | Webhook (Status: sent, delivered, read)
       |
[ ClassroomOS Webhook Receiver ]
```

### Step-by-Step Meta Cloud API Provisioning

1. **Meta Business Account**:
   - Register at [developers.facebook.com](https://developers.facebook.com).
   - Create or select an existing Meta Business Manager account.
   - Complete Legal Business Verification (upload school registration certificate/tax documents).
2. **Create a Meta App**:
   - App Type: **Business**.
   - Add the **WhatsApp** product to the application.
3. **Provision a Dedicated Phone Number**:
   - Must be a number that can receive an SMS or voice OTP for verification.
   - **Crucial**: This number **cannot** be currently registered on the personal WhatsApp or WhatsApp Business mobile app. If currently registered, delete the account in WhatsApp settings first.
4. **Obtain Credentials**:
   - **Phone Number ID**: 15-digit identifier located in the WhatsApp Getting Started panel.
   - **WhatsApp Business Account ID (WABA ID)**: 15-digit identifier for your business account.
   - **System User Permanent Access Token**: Generated in Meta Business Settings under System Users with permission `whatsapp_business_messaging`.
5. **Create Pre-Approved Message Templates**:
   - Meta requires all outbound business-initiated messages to use pre-approved templates under the **Utility** category.
   - Example template format:
     ```
     Dear {{1}}, your child {{2}} was marked {{3}} on {{4}} at {{5}}.
     ```
6. **Enter Credentials in ClassroomOS**:
   - Navigate to **Admin Settings -> WhatsApp Platform**.
   - Input your Phone Number ID, WABA ID, and Permanent Token.
   - Save configuration.

### Meta Conversation Pricing Structure (Estimates)

Meta charges per **24-hour conversation window** rather than per individual text message.

| Category | Description | Approx. Rate (Pakistan) | Approx. Rate (North America) |
| :--- | :--- | :--- | :--- |
| **Utility** | Attendance alerts, invoices, confirmations | **~\$0.005 to \$0.012 USD** | ~\$0.015 USD |
| **Service** | Parent-initiated support inquiries | **1,000 free / month**, then ~\$0.005 | ~\$0.008 USD |
| **Authentication** | Password resets, OTPs | **~\$0.008 to \$0.015 USD** | ~\$0.013 USD |
| **Marketing** | School event promotions, fee reminders | **~\$0.025 to \$0.045 USD** | ~\$0.025 USD |

*Note: Pricing is established directly by Meta and subject to regional currency adjustments.*

---

## 6. Verification and Troubleshooting

### Common Questions

- **Question:** *The button says "Open in WhatsApp ↗", but nothing happens when I click.*
  - **Resolution:** Check your browser's pop-up blocker. Allow pop-ups from `localhost` / `127.0.0.1` so that `window.open` can launch the WhatsApp tab.
- **Question:** *WhatsApp Web displays: "Phone number shared via url is invalid".*
  - **Resolution:** In ClassroomOS 2.1.2, this is resolved by automatic normalization. If editing a student, verify the phone has at least 10 digits and starts with `03` or a valid international country code.
- **Question:** *Does sending a WhatsApp notification cost anything in manual mode?*
  - **Resolution:** No. Manual mode uses your existing browser WhatsApp connection. It is 100% free of charge.

