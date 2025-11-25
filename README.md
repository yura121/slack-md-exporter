# Slack Markdown Exporter

## 🌟 Project Overview

**Slack Markdown Exporter** is a Google Chrome extension designed for the quick and convenient export of message history from any active Slack conversation (channel or direct message) into **Markdown format** (`.md`).

The extension allows the user to select **how many of the latest messages** they wish to export. It preserves key formatting elements (bold text, italics, links, code blocks, quotes) and includes full timestamps and the author's name for each message.

---

## 🚀 Installation and Usage

Since this is a custom extension, it must be installed in Chrome's **Developer mode**.

### Step 1: File Preparation

1. Create a new folder on your computer, for example, `slack-md-exporter`.
2. Place the following files (containing the code provided by your "Programming Partner") into this folder:
    * `manifest.json`
    * `content.js`
    * `style.css`
    * `icon.png`

### Step 2: Chrome Installation

1. Open Google Chrome and navigate to: `chrome://extensions`.
2. Enable **"Developer mode"** in the upper right corner of the page.
3. Click the **"Load unpacked"** button.
4. Select the `slack-md-exporter` folder.

The extension will now be successfully installed and active.

### Step 3: Export

1. Open the Slack web version (`https://app.slack.com/`) and navigate to the desired channel or conversation.
2. An **input field** and an **"Export MD"** button will appear next to the active Slack conversation title (channel or direct message).
3. Enter the desired number of the latest messages to export (e.g., `100`).
4. Click **"Export MD"**.
5. The file (`[Channel_Name]_export.md`) will be automatically downloaded.