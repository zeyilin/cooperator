# 🥕 Cooperator

A Chrome extension that adds an "Add to Google Calendar" button on the Park Slope Food Coop home page and shift detail pages.

## Features

- **Home Page Integration**: Add shifts directly from your dashboard (fetches full details in background)
- **Shift Details Integration**: One-click add button on shift confirmation pages
- **Smart Parsing**: Automatically extracts correct date, time, and shift name (including emojis 💳)
- **Rich Event Details**: Preserves full shift description, requirements, and location
- **Timezone Aware**: Automatically sets EST/EDT regardless of your system time

## Installation

### Step 1: Download the Extension

**Option A:** Clone this repository

```bash
git clone https://github.com/YOUR_USERNAME/cooperator.git
```

**Option B:** Download ZIP

1. Click the green **Code** button above
2. Select **Download ZIP**
3. Extract the ZIP file

### Step 2: Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the folder containing `manifest.json`

### Step 3: Use It

**On the Home Page:**

1. Log in to [members.foodcoop.com](https://members.foodcoop.com/services/home)
2. Look for "Add to Google Calendar ⧉" next to your scheduled shifts
3. Click it to open a pre-filled Google Calendar event

**On Shift Confirmation Pages:**

1. Navigate to any shift you're scheduled for
2. Click the large **ADD TO CALENDAR** button
3. Google Calendar opens with the shift pre-filled

## What Gets Added

| Field | Value |
|-------|-------|
| **Title** | `PSFC Shift: [Name] (Shift #XXXXXX)` |
| **Duration** | 2 hours 45 minutes (based on shift time) |
| **Timezone** | America/New_York (EST/EDT) |
| **Location** | Park Slope Food Coop, 782 Union St, Brooklyn, NY 11215 |
| **Description** | Full shift description, requirements, and link to shift page |

## Privacy

- Only runs on `members.foodcoop.com`
- No data collection or transmission
- No special permissions required

## License

MIT

---

<p align="center"><sub>Created with <a href="https://cloud.google.com/">Google Antigravity</a> 🚀</sub></p>
