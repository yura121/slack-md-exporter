/**
 * Extracts raw message data: author, timestamp, and full HTML content.
 * @param {HTMLElement} messageElement The message element.
 * @returns {object | null} An object with data or null if the message is empty.
 */
function extractRawMessageData(messageElement) {
    // Author
    const authorEl = messageElement.querySelector('[data-qa="message_sender_name"]');
    const author = authorEl ? authorEl.textContent.trim() : null;

    // Timestamp
    const timestampEl = messageElement.querySelector('[data-ts]');
    const timestamp = timestampEl ? timestampEl.getAttribute('data-ts') : 0;

    // Raw HTML content
    const textContainer = messageElement.querySelector('[data-qa="message-text"]');
    if (!textContainer) {
        return null;
    }

    let rawHtml = '';
    const textBlocks = textContainer.querySelectorAll('.p-rich_text_block');

    if (textBlocks.length > 0) {
        textBlocks.forEach(block => {
            rawHtml += block.innerHTML + '\n';
        });
    } else {
        rawHtml = textContainer.innerHTML;
    }

    if (rawHtml.trim() === '') {
        return null;
    }

    return {
        author: author,
        timestamp: timestamp,
        rawHtml: rawHtml.trim()
    };
}

function formatToMarkdown(messageText) {
    // line break
    messageText = messageText.replace(/<br\s*[^>]*\/?>/gi, '\n');

    // transform blockquote
    messageText = replaceBlockquotes(messageText);

    // transform lists
    messageText = transformHtmlList(messageText);

    // clear tags
    messageText = messageText.replace(/<[^>]*>/g, '');

    // adding an extra new line after a quote
    messageText = separateQuoteFromText(messageText);

    return messageText;
}

/**
 * Inserts an extra newline (\n) when transitioning from a quoted line (starting with >) to an unquoted line.
 * This ensures proper visual separation (an empty line) when exiting a blockquote context in plain text format.
 * @param {string} text The source text.
 * @returns {string} The transformed text.
 */
function separateQuoteFromText(text) {
    // Regular expression with the 'gm' (global, multiline) flags:
    // 1. (^>.*\S): Group 1. Captures a line that starts with '>',
    //    contains any characters, and ends with a non-whitespace character (\S).
    // 2. \n: The single newline character we want to duplicate.
    // 3. (\s*[^>].*): Group 2. Captures the subsequent line:
    //    allows leading whitespace (\s*), but requires that the first
    //    non-whitespace character is NOT '>'.
    const regex = /(^>.*\S)\n(\s*[^>].*)/gm;

    // Replace the matched pattern:
    // $1: The first line (quoted)
    // \n\n: Double newline (inserts an empty line)
    // $2: The second line (unquoted)
    return text.replace(regex, "$1\n\n$2");
}

/**
 * Replaces all HTML <blockquote> tags within an HTML string with their content,
 * adding the "> " prefix before each line inside the quote.
 * @param {string} htmlString The source HTML string.
 * @returns {string} The string with transformed quotes.
 */
function replaceBlockquotes(htmlString) {
    // Regex to capture the entire <blockquote> block and its inner content.
    // [^>]*: Matches any attributes inside the tag.
    // ([\s\S]*?): Group 1 captures the content, including newlines (\n).
    const blockquoteRegex = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi;

    return htmlString.replace(blockquoteRegex, (match, content) => {
        // Split the content into individual lines by the newline character (\n)
        const lines = content.split('\n');

        // Prepend the "> " prefix to each line
        const prefixedLines = lines.map(line => `> ${line.trim()}`);

        // Join the lines back together with newlines (\n)
        return prefixedLines.join('\n') + '\n';
    });
}

/**
 * Transforms all <ol> structures within an HTML string into text-based numbered lists.
 * Applies a block quote prefix (>) if the <ol> has data-border="1".
 * @param {string} htmlString The full HTML content to process.
 * @returns {string} The processed string with lists converted to text.
 */
function transformHtmlList(htmlString) {
    // Regex to find all OL tags and capture the data-border value and inner content.
    // Group 1: Captures the data-border value (e.g., "1").
    // Group 2: Captures all content inside <ol> (<li>...</li>).
    const olRegex = /<ol[^>]*data-border="(\d)"[^>]*>([\s\S]*?)<\/ol>/gi;

    // Replace the entire OL block using a callback function.
    // The callback runs for every OL found (due to the 'g' flag).
    // Return the HTML string with all lists transformed.
    return htmlString.replace(olRegex, (match, borderValue, listContent) => {

        // Check the condition for block quoting (data-border="1")
        const hasBorder = borderValue === '1';
        // Determine the prefix ("> " or "")
        const prefix = hasBorder ? '> ' : '';

        // Regex to find all LI tags and capture the content.
        // Group 1: Content inside <li>
        const liRegex = /<li[^>]*>(.*?)<\/li>/gi;
        let counter = 0;

        // Replace the LI tags with numbered lines
        return listContent.replace(liRegex, (match, itemContent) => {
            counter++;
            // Return the numbered line with the prefix and trimmed content.
            // Note: This replaces <li>...</li> with the numbered text.
            return `${prefix}${counter}. ${itemContent.trim()}\n`;
        });
    });
}

function toDate(timestampString) {
    const floatTimestamp = parseFloat(timestampString);
    const milliseconds = Math.round(floatTimestamp * 1000);
    const dateObject = new Date(milliseconds);

    return formatDateTime(dateObject);
}

function formatDateTime(date) {
    const pad = (number) => number.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}.${month}.${day} ${hours}:${minutes}`;
}

/**
 * Click handler for the export button.
 */
function handleExportClick() {
    // Get the number of messages
    const countInput = document.getElementById('message-count-input');
    let count = parseInt(countInput ? countInput.value : '100', 10);

    if (isNaN(count) || count <= 0) {
        count = 100;
    }

    // Find the messages
    const messagesContainer = document.querySelector('.c-virtual_list__scroll_container[role="presentation"]');
    if (!messagesContainer) {
        alert("Could not find the message container. Make sure you are in an active conversation.");
        return;
    }

    const allMessageElements = messagesContainer.querySelectorAll('[data-qa="message_container"]');
    if (allMessageElements.length === 0) {
        alert("Messages not found.");
        return;
    }

    const messagesArray = Array.from(allMessageElements);
    const lastNMessages = messagesArray.slice(-count);

    let markdownContent = '';
    let exportedCount = 0;
    let prevFormatedTimestamp = '';

    for (const messageEl of lastNMessages) {
        const rawData = extractRawMessageData(messageEl);

        if (!rawData) {
            continue;
        }

        rawData.cleanHtml = formatToMarkdown(rawData.rawHtml);

        if (rawData.author) {
            markdownContent += `\n**${rawData.author}**\n`;
        }

        if (rawData.timestamp) {
            const currFormatedTimestamp = toDate(rawData.timestamp);
            if (prevFormatedTimestamp !== currFormatedTimestamp) {
                markdownContent += `${currFormatedTimestamp}\n`;
                prevFormatedTimestamp = currFormatedTimestamp;
            }
        }

        markdownContent += `${rawData.cleanHtml}\n`

        exportedCount++;
    }

    if (markdownContent === '') {
        alert("Could not extract text messages for export.");
        return;
    }

    // Create and download the file
    const channelTitle = document.title.replace(' | Slack', '').trim();
    const header = `# Conversation Export: ${channelTitle}\n\n---\n`;
    const finalContent = header + markdownContent;

    const blob = new Blob([finalContent], {type: 'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');

    const fileName = `${channelTitle.replace(/[^a-z0-9]/gi, '_')}_export.md`;

    downloadLink.href = url;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);

    alert(`Export complete! Downloaded file "${fileName}" with ${exportedCount} messages.`);
}

/**
 * Inserts the input field and export button into the channel header.
 */
function insertExportButton() {
    const targetContainer = document.querySelector('[data-qa="huddle_channel_header_button"]');
    if (!targetContainer) {
        return;
    }

    const tabsContainer = targetContainer.closest('.p-view_header__actions');
    if (!tabsContainer) {
        return;
    }

    if (document.getElementById('slack-exporter-controls')) {
        return;
    }

    // Container for controls
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'slack-exporter-controls';

    // Count input field
    const countInput = document.createElement('input');
    countInput.id = 'message-count-input';
    countInput.type = 'number';
    countInput.min = '1';
    countInput.value = '100'; // Default value
    countInput.title = 'Number of messages to export (default: 100)';

    // Export button
    const exportButton = document.createElement('button');
    exportButton.id = 'markdown-export-btn';
    exportButton.title = 'Export last N messages to Markdown';

    exportButton.innerHTML = `
        <svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2zM5 11h14v6H5v-6zm14-8H5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 5h14v2H5V5z"/>
        </svg>
        <span>Export MD</span>
    `;

    exportButton.addEventListener('click', handleExportClick);

    controlsContainer.appendChild(countInput);
    controlsContainer.appendChild(exportButton);

    // Insert the container into the DOM
    tabsContainer.prepend(controlsContainer);
}

/**
 * Uses MutationObserver to track the loading of the Slack interface
 * and inserts the controls.
 */
function observeDOM() {
    const observer = new MutationObserver(() => {
        // Check if the target element for the button has appeared
        const targetContainer = document.querySelector('[data-qa="huddle_channel_header_button"]');

        if (targetContainer && !document.getElementById('slack-exporter-controls')) {
            insertExportButton();
        }
    });

    // Start observing changes in the document body
    observer.observe(document.body, {childList: true, subtree: true});

    // Attempt insertion on first load
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        insertExportButton();
    }
}

// Start the process
observeDOM();
