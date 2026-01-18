/**
 * Cooperator - PSFC Shift to Google Calendar Extension
 * Content script that runs on shift claim and home pages
 */

(function () {
    'use strict';

    const MONTHS = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3,
        'may': 4, 'june': 5, 'july': 6, 'august': 7,
        'september': 8, 'october': 9, 'november': 10, 'december': 11
    };

    // Format date for Google Calendar (YYYYMMDDTHHMMSS)
    function formatDateForGCal(dateTime, durationMinutes = 165) {
        const month = MONTHS[dateTime.month.toLowerCase()];
        const day = parseInt(dateTime.day, 10);
        const year = parseInt(dateTime.year, 10);

        // Parse time
        const timeMatch = dateTime.time.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const isPM = timeMatch[3].toLowerCase() === 'pm';

        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;

        const startDate = new Date(year, month, day, hours, minutes, 0);
        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

        const formatDate = (date) => {
            const pad = (n) => n.toString().padStart(2, '0');
            return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
        };

        return { start: formatDate(startDate), end: formatDate(endDate) };
    }

    // Build Google Calendar URL
    function buildGoogleCalendarUrl(shiftDetails) {
        const baseUrl = 'https://calendar.google.com/calendar/render';
        const params = new URLSearchParams();

        params.set('action', 'TEMPLATE');
        const titleParts = [`PSFC Shift: ${shiftDetails.titleWithEmoji}`];
        if (shiftDetails.shiftId) {
            titleParts.push(`(Shift #${shiftDetails.shiftId})`);
        }
        params.set('text', titleParts.join(' '));

        if (shiftDetails.dateTime) {
            const dates = formatDateForGCal(shiftDetails.dateTime, 165);
            params.set('dates', `${dates.start}/${dates.end}`);
            params.set('ctz', 'America/New_York');
        }

        let description = '';
        if (shiftDetails.shiftId) {
            description += `View shift: https://members.foodcoop.com/services/shift_claim/${shiftDetails.shiftId}/\n\n`;
        }
        if (shiftDetails.description) {
            description += '<b>SHIFT DESCRIPTION</b>\n\n' + shiftDetails.description + '\n\n';
        } else if (shiftDetails.shiftId) {
            // For home page events without full details
            description += 'Open the shift link above for full shift details and requirements.\n\n';
        }
        if (shiftDetails.requirements && shiftDetails.requirements.length > 0) {
            description += '<b>SHIFT REQUIREMENTS</b>\n\n' + shiftDetails.requirements.join('\n');
        }

        params.set('details', description);
        params.set('location', 'Park Slope Food Coop, 782 Union St, Brooklyn, NY 11215');

        return `${baseUrl}?${params.toString()}`;
    }

    // Create a calendar link element
    function createCalendarLink(shiftDetails) {
        // Create wrapper span
        const wrapper = document.createElement('span');
        wrapper.className = 'cooperator-calendar-wrapper';
        wrapper.style.cssText = 'margin-left: 8px;';

        // Non-clickable separator
        const separator = document.createElement('span');
        separator.textContent = '| ';

        // Clickable link
        const link = document.createElement('a');
        link.className = 'cooperator-calendar-link';
        link.href = buildGoogleCalendarUrl(shiftDetails);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Add to Google Calendar ⧉';
        link.style.cssText = 'text-decoration: none;';
        link.addEventListener('mouseover', () => link.style.textDecoration = 'underline');
        link.addEventListener('mouseout', () => link.style.textDecoration = 'none');

        wrapper.appendChild(separator);
        wrapper.appendChild(link);
        return wrapper;
    }

    // ==================== HOME PAGE LOGIC ====================

    // Fetch and parse shift details from a shift claim page
    async function fetchShiftDetails(shiftId) {
        try {
            const response = await fetch(`https://members.foodcoop.com/services/shift_claim/${shiftId}/`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const details = {
                title: '',
                titleWithEmoji: '',
                description: '',
                requirements: []
            };

            // Get shift title with emoji from h4 in main content
            // The h4 contains: "Checkout 💳 Shift #1066265 1:00 pm, Sunday..."
            const header = doc.querySelector('#main_content h4');
            if (header) {
                // Get just the text before "Shift #" or time pattern
                const fullText = header.textContent.trim();
                // Split on "Shift #" or the date/time pattern
                const parts = fullText.split(/Shift\s*#|\d{1,2}:\d{2}\s*(am|pm)/i);
                if (parts[0]) {
                    const titleText = parts[0].trim();
                    // Match: word characters and spaces, then optional emoji
                    const match = titleText.match(/^(.+?)\s*([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])?\s*$/u);
                    if (match && match[1]) {
                        details.title = match[1].trim();
                        details.titleWithEmoji = match[2] ? `${match[1].trim()} ${match[2]}` : match[1].trim();
                    } else {
                        // Fallback - just use the cleaned text
                        details.title = titleText;
                        details.titleWithEmoji = titleText;
                    }
                }
            }

            // Get shift description
            const descriptionHeader = doc.querySelector('h5');
            let descriptionElements = [];
            if (descriptionHeader && descriptionHeader.textContent.includes('Shift Description')) {
                let currentElement = descriptionHeader.nextElementSibling;
                while (currentElement) {
                    const tagName = currentElement.tagName.toLowerCase();
                    if (tagName === 'h5' || currentElement.textContent.includes('Shift Requirements')) break;
                    if (tagName === 'p') {
                        let formattedText = currentElement.innerHTML
                            .replace(/<strong>/gi, '<b>')
                            .replace(/<\/strong>/gi, '</b>')
                            .replace(/<br\s*\/?>/gi, '\n')
                            .replace(/<(?!b>|\/b>)[^>]+>/g, '')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/&amp;/g, '&')
                            .trim();
                        if (formattedText) descriptionElements.push(formattedText);
                    }
                    currentElement = currentElement.nextElementSibling;
                }
            }
            details.description = descriptionElements.join('\n\n');

            // Get shift requirements
            const requirementsHeader = Array.from(doc.querySelectorAll('h2, h3, strong, b'))
                .find(el => el.textContent.includes('Shift Requirements'));
            if (requirementsHeader) {
                let ul = requirementsHeader.nextElementSibling;
                while (ul && ul.tagName.toLowerCase() !== 'ul') ul = ul.nextElementSibling;
                if (ul) {
                    ul.querySelectorAll('li').forEach(li => {
                        let formattedText = li.innerHTML
                            .replace(/<strong>/gi, '<b>')
                            .replace(/<\/strong>/gi, '</b>')
                            .replace(/<(?!b>|\/b>)[^>]+>/g, '')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/&amp;/g, '&')
                            .trim();
                        if (formattedText) details.requirements.push('• ' + formattedText);
                    });
                }
            }

            return details;
        } catch (error) {
            console.warn('Cooperator: Failed to fetch shift details', error);
            return { title: '', titleWithEmoji: '', description: '', requirements: [] };
        }
    }

    function injectHomePageButtons() {
        const shiftCards = document.querySelectorAll('.shiftcard');

        shiftCards.forEach(async (card) => {
            // Skip if already processed
            if (card.querySelector('.cooperator-calendar-wrapper')) return;

            // Extract date from datecard
            const dateCard = card.querySelector('.datecard');
            if (!dateCard) return;

            const month = dateCard.querySelector('.month')?.textContent.trim();
            const day = dateCard.querySelector('.date')?.textContent.trim();
            const dayOfWeek = dateCard.querySelector('.day')?.textContent.trim();

            // Extract time (e.g., "10:30am - 1:15pm")
            const timeCard = card.querySelector('.timecard');
            const timeText = timeCard?.textContent.trim();
            const timeMatch = timeText?.match(/(\d{1,2}:\d{2}\s*(?:am|pm))/i);
            const startTime = timeMatch ? timeMatch[1] : null;

            // Extract shift name with emoji
            const shiftContent = card.querySelector('.col-8, .col-sm-9, .col-md-10');
            let shiftName = '';
            let shiftEmoji = '';

            if (shiftContent) {
                const textContent = shiftContent.textContent;
                const nameMatch = textContent.match(/([A-Za-z][A-Za-z\s:]*[A-Za-z])\s*([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])?/u);
                if (nameMatch) {
                    shiftName = nameMatch[1].trim();
                    shiftEmoji = nameMatch[2] || '';
                }
            }

            // Extract shift ID from the "View in Shift Calendar" link
            const shiftLink = card.querySelector('a[href*="shift_claim"]');
            const shiftIdMatch = shiftLink?.href.match(/shift_claim\/(\d+)/);
            const shiftId = shiftIdMatch ? shiftIdMatch[1] : '';

            // Determine year
            const currentDate = new Date();
            let year = currentDate.getFullYear();
            const monthNum = MONTHS[month?.toLowerCase()];
            if (monthNum !== undefined && monthNum < currentDate.getMonth()) {
                year = currentDate.getFullYear() + 1;
            }

            if (!month || !day || !startTime || !shiftId) return;

            // Create a placeholder first (shows "Loading...")
            const wrapper = document.createElement('span');
            wrapper.className = 'cooperator-calendar-wrapper';
            wrapper.style.cssText = 'margin-left: 8px;';

            const separator = document.createElement('span');
            separator.textContent = '| ';

            const loadingText = document.createElement('span');
            loadingText.textContent = 'Loading...';
            loadingText.style.cssText = 'cursor: wait;';

            wrapper.appendChild(separator);
            wrapper.appendChild(loadingText);

            if (shiftLink) {
                shiftLink.parentNode.insertBefore(wrapper, shiftLink.nextSibling);
            }

            // Fetch full details in background
            const fullDetails = await fetchShiftDetails(shiftId);

            const shiftDetails = {
                title: fullDetails.title || shiftName,
                titleWithEmoji: fullDetails.titleWithEmoji || (shiftEmoji ? `${shiftName} ${shiftEmoji}` : shiftName),
                shiftId: shiftId,
                dateTime: {
                    time: startTime,
                    dayOfWeek: dayOfWeek,
                    month: month,
                    day: day,
                    year: year.toString()
                },
                description: fullDetails.description,
                requirements: fullDetails.requirements
            };

            // Replace loading text with actual link
            const link = document.createElement('a');
            link.className = 'cooperator-calendar-link';
            link.href = buildGoogleCalendarUrl(shiftDetails);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Add to Google Calendar ⧉';
            link.style.cssText = 'text-decoration: none;';
            link.addEventListener('mouseover', () => link.style.textDecoration = 'underline');
            link.addEventListener('mouseout', () => link.style.textDecoration = 'none');

            wrapper.replaceChild(link, loadingText);
        });

        console.log('Cooperator: Home page buttons injected with full details');
    }

    // ==================== SHIFT CLAIM PAGE LOGIC ====================
    function parseShiftClaimDetails() {
        const details = {
            title: '',
            titleWithEmoji: '',
            dateTime: '',
            shiftId: '',
            description: '',
            requirements: []
        };

        // Get shift title with emoji
        const header = document.querySelector('h4') || document.querySelector('h1, h2');
        if (header) {
            const titleText = header.textContent.trim();
            const match = titleText.match(/^([A-Za-z][A-Za-z\s]*[A-Za-z])\s*([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])?/u);
            if (match) {
                details.title = match[1].trim();
                details.titleWithEmoji = match[2] ? `${match[1].trim()} ${match[2]}` : match[1].trim();
            } else {
                details.title = titleText.split(/\s+/)[0];
                details.titleWithEmoji = details.title;
            }
        }

        // Get shift ID from URL
        const urlMatch = window.location.pathname.match(/\/shift_claim\/(\d+)/);
        if (urlMatch) {
            details.shiftId = urlMatch[1];
        }

        // Get date and time
        const bodyText = document.body.innerText;
        const dateTimeRegex = /(\d{1,2}:\d{2}\s*(?:am|pm)),?\s*(\w+day)\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/i;
        const dateMatch = bodyText.match(dateTimeRegex);
        if (dateMatch) {
            details.dateTime = {
                time: dateMatch[1],
                dayOfWeek: dateMatch[2],
                month: dateMatch[3],
                day: dateMatch[4],
                year: dateMatch[5]
            };
        }

        // Get shift description
        const descriptionHeader = document.querySelector('h5');
        let descriptionElements = [];
        if (descriptionHeader && descriptionHeader.textContent.includes('Shift Description')) {
            let currentElement = descriptionHeader.nextElementSibling;
            while (currentElement) {
                const tagName = currentElement.tagName.toLowerCase();
                if (tagName === 'h5' || currentElement.textContent.includes('Shift Requirements')) break;
                if (tagName === 'p') {
                    let formattedText = currentElement.innerHTML
                        .replace(/<strong>/gi, '<b>')
                        .replace(/<\/strong>/gi, '</b>')
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<(?!b>|\/b>)[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .trim();
                    if (formattedText) descriptionElements.push(formattedText);
                }
                currentElement = currentElement.nextElementSibling;
            }
        }
        details.description = descriptionElements.join('\n\n');

        // Get shift requirements
        const requirementsHeader = Array.from(document.querySelectorAll('h2, h3, strong, b'))
            .find(el => el.textContent.includes('Shift Requirements'));
        if (requirementsHeader) {
            let ul = requirementsHeader.nextElementSibling;
            while (ul && ul.tagName.toLowerCase() !== 'ul') ul = ul.nextElementSibling;
            if (ul) {
                ul.querySelectorAll('li').forEach(li => {
                    let formattedText = li.innerHTML
                        .replace(/<strong>/gi, '<b>')
                        .replace(/<\/strong>/gi, '</b>')
                        .replace(/<(?!b>|\/b>)[^>]+>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .trim();
                    if (formattedText) details.requirements.push('• ' + formattedText);
                });
            }
        }

        return details;
    }

    function isScheduledForShift() {
        const pageText = document.body.innerText.toLowerCase();
        return pageText.includes('you are currently scheduled to work this shift') ||
            pageText.includes('currently scheduled to work this shift');
    }

    function injectShiftClaimButton() {
        if (document.querySelector('.cooperator-calendar-btn')) return;
        if (!isScheduledForShift()) {
            console.log('Cooperator: User not scheduled for this shift');
            return;
        }

        const shiftDetails = parseShiftClaimDetails();
        const cancelBtn = document.querySelector('input.btn-danger, input[value="CANCEL SHIFT"], button.btn-danger');
        if (!cancelBtn) {
            console.warn('Cooperator: Could not find cancel button');
            return;
        }

        const wrapper = document.createElement('span');
        wrapper.style.cssText = 'display: inline-block; text-align: center; margin-right: 10px; vertical-align: top;';

        const button = document.createElement('a');
        button.className = 'cooperator-calendar-btn btn btn-success';
        button.href = buildGoogleCalendarUrl(shiftDetails);
        button.target = '_blank';
        button.rel = 'noopener noreferrer';
        button.style.cssText = 'display: block; margin-bottom: 2px;';
        button.textContent = 'ADD TO CALENDAR';

        const smallText = document.createElement('small');
        smallText.textContent = 'for Google Calendar';
        smallText.style.cssText = 'font-size: 10px; color: #666; display: block;';

        wrapper.appendChild(button);
        wrapper.appendChild(smallText);
        cancelBtn.parentElement.insertBefore(wrapper, cancelBtn);

        console.log('Cooperator: Shift claim button injected');
    }

    // ==================== MAIN ====================
    function init() {
        const path = window.location.pathname;
        // Matches /services, /services/, /services/home, /services/home/
        const isHomePage = path === '/services' || path === '/services/' || path.includes('/services/home');
        const isShiftClaimPage = path.includes('/shift_claim/');

        if (isHomePage) {
            injectHomePageButtons();
        } else if (isShiftClaimPage) {
            injectShiftClaimButton();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
