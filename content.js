/**
 * Extracts raw message data: author, timestamp, and full HTML content.
 * @param {HTMLElement} messageElement The message element.
 * @returns {object | null} An object with data or null if the message is empty.
 */
function extractRawMessageData(messageElement) {
    // Author
    const authorEl = messageElement.querySelector('[data-qa="message_sender_name"]');
    const author = authorEl ? authorEl.textContent.trim() : null;

    // Timestamp (full)
    const timestampEl = messageElement.querySelector('[data-ts]');
    let timestamp = 0;
    if (timestampEl) {
        timestamp = timestampEl.getAttribute('data-ts');
    }

    // Raw HTML content
    const textContainer = messageElement.querySelector('[data-qa="message-text"]');
    if (!textContainer) return null;

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
    // clear tags
    messageText = messageText.replace(/<[^>]*>/g, '');

    messageText = messageText.trim().replace(/\n\s*\n/g, '\n\n').replace(/\s\s+/g, ' ');

    return messageText;
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
    const header = `# Conversation Export: ${channelTitle} \n\n (Last ${exportedCount} messages)\n\n---\n\n`;
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
    if (!targetContainer) return;

    const tabsContainer = targetContainer.closest('.p-view_header__actions');
    if (!tabsContainer) return;

    if (document.getElementById('slack-exporter-controls')) return;

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
    const observer = new MutationObserver((mutationsList, observer) => {
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
