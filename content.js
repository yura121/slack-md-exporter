// ====================================================================
// Утилитарная функция для форматирования текста в Markdown
// Сохраняет: жирный, курсив, код, ссылки, цитаты, блоки кода, временные метки.
// ====================================================================

/**
 * Преобразует элемент сообщения Slack в строку Markdown, сохраняя форматирование.
 * @param {HTMLElement} messageElement Элемент сообщения.
 * @returns {string | null} Строка Markdown или null, если сообщение не текстовое.
 */
function messageToMarkdown(messageElement) {
    // 1. Извлечение автора и полной временной метки
    const authorEl = messageElement.querySelector('[data-qa="message_sender_name"]');
    const author = authorEl ? authorEl.textContent.trim() : 'Unknown User';

    const timestampEl = messageElement.querySelector('[data-qa="timestamp"]');
    let timestamp = '';

    if (timestampEl) {
        // Полная дата/время хранится в атрибуте 'aria-label' или 'title'
        let fullTime = timestampEl.getAttribute('aria-label') || timestampEl.getAttribute('title');
        if (fullTime) {
            timestamp = fullTime.replace(/г\./, 'года');
        } else {
            timestamp = timestampEl.textContent.trim();
        }
    }

    const authorAndTimestamp = timestamp
        ? `${author} (отправлено: ${timestamp})`
        : author;

    // 2. Ищем текст сообщения и исключаем сообщения только с вложениями
    const textContainer = messageElement.querySelector('[data-qa="message_content"]');
    if (!textContainer) return null;

    // Получаем "сырой" HTML из текстовых блоков
    let rawHtml = '';
    const textBlocks = textContainer.querySelectorAll('.p-rich_text_section, .c-message__body > p');

    if (textBlocks.length > 0) {
        textBlocks.forEach(block => {
            rawHtml += block.innerHTML + '\n';
        });
    } else {
        rawHtml = textContainer.innerHTML;
    }

    let messageText = rawHtml.trim();
    if (messageText === '') return null;

    // =================================================================
    // 3. Конвертация HTML/Слак-форматирования в Markdown
    // =================================================================

    // 3.1. БЛОК КОДА (PRE/CODE) -> ```code```
    // Обрабатываем первым, чтобы избежать конфликта с кодом в строке
    messageText = messageText.replace(
        /<\s*pre[^>]*>\s*<\s*code[^>]*>(.*?)<\s*\/\s*code\s*>\s*<\s*\/\s*pre\s*>/gis,
        (match, content) => {
            // Очистка HTML-сущностей внутри блока кода
            const codeContent = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
            return `\n\`\`\`\n${codeContent.trim()}\n\`\`\`\n`;
        }
    );

    // 3.2. Цитаты (c-message__quote) -> > Цитата
    messageText = messageText.replace(
        /<div[^>]*class="[^"]*c-message__quote[^"]*"[^>]*>(.*?)<\/div>/gis,
        (match, content) => {
            // Заменяем <p> и <br> на переносы для корректной обработки строк
            let quotedText = content.replace(/<\s*p[^>]*>(.*?)<\s*\/\s*p\s*>/gis, '$1\n')
                .replace(/<br\s*\/?>/gi, '\n')
                .trim();

            // Добавляем символ цитаты к каждой строке
            const lines = quotedText.split('\n').map(line => `> ${line.trim()}`);
            return `\n${lines.join('\n')}\n`;
        }
    );

    // 3.3. Жирный текст (<b> или <strong>) -> **жирный**
    messageText = messageText.replace(/<\s*(strong|b)[^>]*>(.*?)<\s*\/\s*(strong|b)\s*>/gi, '**$2**');

    // 3.4. Курсив (<i> или <em>) -> *курсив*
    messageText = messageText.replace(/<\s*(em|i)[^>]*>(.*?)<\s*\/\s*(em|i)\s*>/gi, '*$2*');

    // 3.5. Код в строке (<code>) -> `код`
    messageText = messageText.replace(/<\s*code[^>]*>(.*?)<\s*\/\s*code\s*>/gi, '`$1`');

    // 3.6. Ссылки (<a href="URL">Текст</a>) -> [Текст](URL)
    messageText = messageText.replace(/<\s*a\s+href="([^"]+)"[^>]*>(.*?)<\s*\/\s*a\s*>/gi, (match, url, text) => {
        return `[${text.trim()}](${url})`;
    });

    // 3.7. Списки <li> -> * элемент
    messageText = messageText.replace(/<\s*li[^>]*>(.*?)<\s*\/\s*li\s*>/gi, '* $1\n');

    // 3.8. Перенос строки (<br>) -> \n
    messageText = messageText.replace(/<br\s*\/?>/gi, '\n');

    // 3.9. Очистка оставшихся HTML-тегов и лишних пробелов
    messageText = messageText.replace(/<[^>]*>/g, '');
    messageText = messageText.trim().replace(/\n\s*\n/g, '\n\n').replace(/\s\s+/g, ' ');

    if (messageText === '') return null;

    // 4. Финальное форматирование
    return `**${authorAndTimestamp}:** ${messageText}`;
}

// ====================================================================
// Основная логика: добавление кнопки и обработка клика
// ====================================================================

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
    countInput.value = '10'; // Значение по умолчанию
    countInput.title = 'Количество сообщений для экспорта (по умолчанию: 10)';

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
 * Обработчик клика по кнопке экспорта.
 */
function handleExportClick() {
    // 1. Получаем количество сообщений из поля ввода
    const countInput = document.getElementById('message-count-input');
    let count = parseInt(countInput ? countInput.value : '10', 10);

    if (isNaN(count) || count <= 0) {
        count = 10;
    }

    // 2. Находим контейнер и элементы сообщений
    const messagesContainer = document.querySelector('[data-qa="tabs_content_container"] .c-virtual_list__scroll_container');
    if (!messagesContainer) {
        alert("Не удалось найти контейнер сообщений. Убедитесь, что вы находитесь в активном диалоге.");
        return;
    }

    const allMessageElements = messagesContainer.querySelectorAll('[data-qa="message_container"]');
    if (allMessageElements.length === 0) {
        alert("Сообщения не найдены.");
        return;
    }

    // 3. Извлекаем последние N сообщений
    const messagesArray = Array.from(allMessageElements);
    const lastNMessages = messagesArray.slice(-count);

    let markdownContent = '';
    let exportedCount = 0;

    // 4. Форматируем и строим Markdown
    for (const messageEl of lastNMessages) {
        const md = messageToMarkdown(messageEl);
        if (md) {
            markdownContent += md + '\n\n---\n\n';
            exportedCount++;
        }
    }

    if (markdownContent === '') {
        alert("Не удалось извлечь текстовые сообщения для экспорта.");
        return;
    }

    // 5. Создание заголовка файла
    const channelTitle = document.title.replace(' | Slack', '').trim();
    const header = `# Экспорт диалога: ${channelTitle} \n\n (Последние ${exportedCount} сообщений)\n\n---\n\n`;
    const finalContent = header + markdownContent;


    // 6. Создание и скачивание файла
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


// ====================================================================
// Запуск скрипта: наблюдатель DOM для SPA-приложения Slack
// ====================================================================

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
