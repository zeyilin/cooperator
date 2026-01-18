# 🥕 Cooperator

A Chrome extension that adds an "ADD TO CALENDAR" button on Park Slope Food Coop shift pages, letting you quickly add shifts to Google Calendar.

## Features

- One-click add to Google Calendar
- Only appears on shifts you're scheduled for
- Preserves shift description and requirements with formatting
- Automatically sets EST timezone and PSFC location

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
4. Select the `cooperator` folder (the one containing `manifest.json`)

![Chrome Extensions Page](https://developer.chrome.com/static/docs/extensions/get-started/tutorial/hello-world/image/extensions-page-e702401975f3c.png)

### Step 3: Use It

1. Log in to [members.foodcoop.com](https://members.foodcoop.com)
2. Navigate to a shift you're **scheduled for**
3. Click **ADD TO CALENDAR**
4. Google Calendar opens with the shift pre-filled

## What Gets Added

| Field | Value |
|-------|-------|
| **Title** | `PSFC Shift: [Name] (Shift #XXXXXX)` |
| **Duration** | 2 hours 45 minutes |
| **Timezone** | America/New_York (EST/EDT) |
| **Location** | Park Slope Food Coop, 782 Union St, Brooklyn, NY 11215 |
| **Description** | Full shift description and requirements |

## Privacy

- Only runs on `members.foodcoop.com`
- No data collection or transmission
- No special permissions required

## License

MIT
