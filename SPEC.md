# Club Mahabaleshwar – Consolidated Booking Spec (v8)

This document consolidates booking rules, calendar logic, tariffs, and file I/O for the **first runnable scaffold**.
It maps policy → JSON fields → UI behavior.

## 1) Definitions & Eligibility
- **Member** (incl. dependents and parents) – standard privileges
- **Temporary Member** – wording kept as-is
- **Seniors (65+)** – discount on weekdays/weekends

## 2) Booking Windows (JSON: rules.booking_windows_days)
- Members/Dependents/Parents: 180 days
- Members with Guests: 90 days
- Temporary Members: 60 days

## 3) Room Limits (JSON: rules.room_limits)
- Weekdays (Mon–Thu): up to 6 rooms per Member
- Weekends/Long Weekends: 1 room for Member + up to 2 for Temporary Members (max 3)
- Unaccompanied Temporary Members: up to 3 rooms

## 4) Special & Closed Periods (JSON: restricted_periods.json)
- **Special (Diwali, Christmas/New Year)** – special tariff applies
- **Closed (Monsoon)** – booking disabled

## 5) Group Bookings (JSON: rules.group_booking)
- Size: 10–19 rooms, 2–5 nights
- Caps: C block ≤ 10 rooms; A block ≤ 9 rooms
- Deposit: ₹20,000
- Not allowed during declared Special/Closed or Long Weekends

## 6) Cancellation/Modification (JSON: rules.cancellation_modification)
- Regular vs Special slabs
- Group: separate thresholds; one free modification; increasing value → no fee
- Bereavement waiver: requires documentation; committee discretion

## 7) Tariffs (JSON: data/config/tariff.json)
- `regular` and `special` sections, inclusive of GST
- `addons.aircon_per_night` = 1000 (C/D/E blocks only)
- Parsed from Excel where possible; otherwise seeded examples

## 8) Data Uploads (CSV)
- `data/uploads/rooms.csv` → columns in `rooms_schema.csv`
- `data/uploads/members.csv` → columns in `members_schema.csv`

## 9) UI/Flow (HTML/JS)
- Six‑month rolling calendar with Special/Closed colors
- Filters: wheelchair, pet-friendly, AC; people fields
- Room chips (demo) – replace via CSV loader in a later step
- Summary block – shows selected rooms and approx. nights

## 10) Safe Edit Plan
- First change only **1 file**: `rules.json` **or** `restricted_periods.json`
- Commit → Test. Only if OK, then edit `tariff.json` or others.
