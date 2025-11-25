/**
 * Извлекает сырые данные сообщения: автора, временную метку и полный HTML-контент.
 * @param {HTMLElement} messageElement Элемент сообщения.
 * @returns {object | null} Объект с данными или null, если сообщение пустое.
 */
function extractRawMessageData(messageElement) {
    // 1. Автор
    const authorEl = messageElement.querySelector('[data-qa="message_sender_name"]');
    const author = authorEl ? authorEl.textContent.trim() : null;

    // 2. Временная метка (полная)
    const timestampEl = messageElement.querySelector('[data-ts]');
    let timestamp = 0;
    if (timestampEl) {
        timestamp = timestampEl.getAttribute('data-ts');
    }

    // 3. Сырой HTML-контент
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

/**
 * Очищает сырой HTML, заменяя прикрепленные файлы/изображения на [file].
 * @param {string} rawHtml Сырой HTML-контент сообщения.
 * @returns {string} Очищенный HTML-контент.
 */
function cleanAndFormatData(rawHtml) {
    let cleanHtml = rawHtml;

    // 1. Замена прикрепленных файлов, изображений и вложений на [file]
    // Ищем контейнеры вложений, файлов и изображений Slack
    const fileSelectors = [
        // Контейнер для прикрепленных файлов/документов
        '.c-message_attachment_container',
        // Контейнер для файлов (включая изображения)
        '.c-message__files_container',
        // Контейнер для встраиваемого видео
        '.c-message__video_container',
        // Контейнер для встроенных ссылок с превью
        '.c-message_attachment'
    ];

    // Используем временный контейнер для парсинга HTML и манипуляции DOM
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = rawHtml;

    fileSelectors.forEach(selector => {
        const elementsToReplace = tempDiv.querySelectorAll(selector);
        elementsToReplace.forEach(el => {
            // Заменяем элемент на текст [file]
            el.outerHTML = ' [file] ';
        });
    });

    cleanHtml = tempDiv.innerHTML.trim();

    return cleanHtml;
}

function formatToMarkdown(messageText) {

    // 1. БЛОК КОДА (PRE/CODE) -> ```code```
    messageText = messageText.replace(
        /<\s*pre[^>]*>\s*<\s*code[^>]*>(.*?)<\s*\/\s*code\s*>\s*<\s*\/\s*pre\s*>/gis,
        (match, content) => {
            const codeContent = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            return `\n\`\`\`\n${codeContent.trim()}\n\`\`\`\n`;
        }
    );

    // 2. Цитаты (c-message__quote) -> > Цитата
    messageText = messageText.replace(
        /<div[^>]*class="[^"]*c-message__quote[^"]*"[^>]*>(.*?)<\/div>/gis,
        (match, content) => {
            let quotedText = content.replace(/<\s*p[^>]*>(.*?)<\s*\/\s*p\s*>/gis, '$1\n')
                .replace(/<br\s*\/?>/gi, '\n')
                .trim();

            const lines = quotedText.split('\n').map(line => `> ${line.trim()}`);
            return `\n${lines.join('\n')}\n`;
        }
    );

    // 3. Жирный, Курсив, Код в строке
    messageText = messageText.replace(/<\s*(strong|b)[^>]*>(.*?)<\s*\/\s*(strong|b)\s*>/gi, '**$2**');
    messageText = messageText.replace(/<\s*(em|i)[^>]*>(.*?)<\s*\/\s*(em|i)\s*>/gi, '*$2*');
    messageText = messageText.replace(/<\s*code[^>]*>(.*?)<\s*\/\s*code\s*>/gi, '`$1`');

    // 4. Ссылки и Списки
    messageText = messageText.replace(/<\s*a\s+href="([^"]+)"[^>]*>(.*?)<\s*\/\s*a\s*>/gi, (match, url, text) => {
        return `[${text.trim()}](${url})`;
    });
    messageText = messageText.replace(/<\s*li[^>]*>(.*?)<\s*\/\s*li\s*>/gi, '* $1\n');

    // 5. Перенос строки и очистка тегов
    messageText = messageText.replace(/<br\s*\/?>/gi, '\n');
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

/**
 * Форматирует объект Date в строку вида YYYY.MM.DD HH:MM:SS
 * @param {Date} date Объект JavaScript Date
 * @returns {string} Строковое представление даты
 */
function formatDateTime(date) {
    // Вспомогательная функция для добавления ведущего нуля
    const pad = (number) => number.toString().padStart(2, '0');

    const year = date.getFullYear();
    // getMonth() возвращает 0-11, поэтому добавляем 1
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());

    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    // Собираем финальную строку
    return `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`;
}


/**
 * Обработчик клика по кнопке экспорта.
 */
function handleExportClick() {
    // 1. Получаем количество сообщений
    const countInput = document.getElementById('message-count-input');
    let count = parseInt(countInput ? countInput.value : '100', 10);

    if (isNaN(count) || count <= 0) {
        count = 100;
    }

    // 2. Находим сообщения
    const messagesContainer = document.querySelector('.c-virtual_list__scroll_container[role="presentation"]');
    if (!messagesContainer) {
        alert("Не удалось найти контейнер сообщений. Убедитесь, что вы находитесь в активном диалоге.");
        return;
    }

    const allMessageElements = messagesContainer.querySelectorAll('[data-qa="message_container"]');
    if (allMessageElements.length === 0) {
        alert("Сообщения не найдены.");
        return;
    }

    const messagesArray = Array.from(allMessageElements);
    const lastNMessages = messagesArray.slice(-count);

    let markdownContent = '';
    let exportedCount = 0;

    for (const messageEl of lastNMessages) {
        const rawData = extractRawMessageData(messageEl);

        if (!rawData) {
            continue;
        }

        rawData.cleanHtml = formatToMarkdown(rawData.rawHtml);

        if (rawData.author) {
            markdownContent += `\n\n**${rawData.author}**\n`;
        }

        if (rawData.timestamp) {
            markdownContent += `${toDate(rawData.timestamp)}\n`;
        }

        markdownContent += `${rawData.cleanHtml}\n`

        exportedCount++;
    }

    if (markdownContent === '') {
        alert("Не удалось извлечь текстовые сообщения для экспорта.");
        return;
    }

    // 4. Создание и скачивание файла
    const channelTitle = document.title.replace(' | Slack', '').trim();
    const header = `# Экспорт диалога: ${channelTitle} \n\n (Последние ${exportedCount} сообщений)\n\n---\n\n`;
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

    alert(`Экспорт завершен! Скачан файл "${fileName}" с ${exportedCount} сообщениями.`);
}

/**
 * Вставляет поле ввода и кнопку экспорта в заголовок канала.
 */
function insertExportButton() {
    const targetContainer = document.querySelector('[data-qa="huddle_channel_header_button"]');
    if (!targetContainer) return;

    const tabsContainer = targetContainer.closest('.p-view_header__actions');
    if (!tabsContainer) return;

    if (document.getElementById('slack-exporter-controls')) return;

    // Контейнер для элементов управления
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'slack-exporter-controls';

    // Поле ввода количества
    const countInput = document.createElement('input');
    countInput.id = 'message-count-input';
    countInput.type = 'number';
    countInput.min = '1';
    countInput.value = '100'; // Значение по умолчанию
    countInput.title = 'Количество сообщений для экспорта (по умолчанию: 100)';

    // Кнопка экспорта
    const exportButton = document.createElement('button');
    exportButton.id = 'markdown-export-btn';
    exportButton.title = 'Экспортировать последние N сообщений в Markdown';

    exportButton.innerHTML = `
        <svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 9H5c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2zM5 11h14v6H5v-6zm14-8H5c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 5h14v2H5V5z"/>
        </svg>
        <span>Экспорт MD</span>
    `;

    exportButton.addEventListener('click', handleExportClick);

    controlsContainer.appendChild(countInput);
    controlsContainer.appendChild(exportButton);

    // Вставляем контейнер в DOM
    tabsContainer.prepend(controlsContainer);
}

/**
 * Использует MutationObserver для отслеживания загрузки интерфейса Slack
 * и вставляет элементы управления.
 */
function observeDOM() {
    const observer = new MutationObserver((mutationsList, observer) => {
        // Проверяем, появился ли целевой элемент для кнопки
        const targetContainer = document.querySelector('[data-qa="huddle_channel_header_button"]');

        if (targetContainer && !document.getElementById('slack-exporter-controls')) {
            insertExportButton();
        }
    });

    // Начинаем наблюдение за изменениями в теле документа
    observer.observe(document.body, {childList: true, subtree: true});

    // Попытка вставки при первой загрузке
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        insertExportButton();
    }
}

// Запускаем процесс
observeDOM();
