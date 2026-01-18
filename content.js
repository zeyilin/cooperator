/**
 * Cooperator - PSFC Shift to Google Calendar Extension
 * Content script that runs on shift claim pages
 */

(function () {
    'use strict';

    // Parse shift details from the page
    function parseShiftDetails() {
        const details = {
            title: '',
            titleWithEmoji: '',
            dateTime: '',
            shiftId: '',
            description: '',
            requirements: []
        };

        // Get shift title with emoji (e.g., "Checkout 💳")
        // Look for h4 first (used on shift claim pages), then fall back to h1/h2
        const header = document.querySelector('h4') || document.querySelector('h1, h2');
        if (header) {
            const titleText = header.textContent.trim();
            // Match the name and emoji, stopping before "Shift #" or newline
            // Pattern: Word(s) followed by optional emoji, before "Shift #" or line break
            const match = titleText.match(/^([A-Za-z][A-Za-z\s]*[A-Za-z])\s*([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])?/u);
            if (match) {
                details.title = match[1].trim();
                details.titleWithEmoji = match[2] ? `${match[1].trim()} ${match[2]}` : match[1].trim();
            } else {
                // Fallback: just get the first word
                details.title = titleText.split(/\s+/)[0];
                details.titleWithEmoji = details.title;
            }
        }

        // Get shift ID from URL or page
        const urlMatch = window.location.pathname.match(/\/shift_claim\/(\d+)/);
        if (urlMatch) {
            details.shiftId = urlMatch[1];
        }

        // Get date and time - look for the specific format "10:30 am, Sunday January 25, 2026"
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

        // Get shift description with formatting preserved
        const descriptionHeader = document.querySelector('h5');
        let descriptionElements = [];

        if (descriptionHeader && descriptionHeader.textContent.includes('Shift Description')) {
            let currentElement = descriptionHeader.nextElementSibling;

            while (currentElement) {
                const tagName = currentElement.tagName.toLowerCase();
                // Stop at Shift Requirements section
                if (tagName === 'h5' || currentElement.textContent.includes('Shift Requirements')) {
                    break;
                }

                if (tagName === 'p') {
                    // Keep bold tags as HTML <b> for Google Calendar
                    let formattedText = currentElement.innerHTML
                        .replace(/<strong>/gi, '<b>')
                        .replace(/<\/strong>/gi, '</b>')
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<(?!b>|\/b>)[^>]+>/g, '') // Remove HTML tags except <b> and </b>
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .trim();

                    if (formattedText) {
                        descriptionElements.push(formattedText);
                    }
                }
                currentElement = currentElement.nextElementSibling;
            }
        }

        details.description = descriptionElements.join('\n\n');

        // Get shift requirements
        const requirementsHeader = Array.from(document.querySelectorAll('h2, h3, strong, b'))
            .find(el => el.textContent.includes('Shift Requirements'));

        if (requirementsHeader) {
            // Find the ul that follows h5 containing requirements
            let ul = requirementsHeader.nextElementSibling;
            while (ul && ul.tagName.toLowerCase() !== 'ul') {
                ul = ul.nextElementSibling;
            }

            if (ul) {
                const listItems = ul.querySelectorAll('li');
                listItems.forEach(li => {
                    // Keep bold tags as HTML <b>
                    let formattedText = li.innerHTML
                        .replace(/<strong>/gi, '<b>')
                        .replace(/<\/strong>/gi, '</b>')
                        .replace(/<(?!b>|\/b>)[^>]+>/g, '') // Remove HTML tags except <b> and </b>
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .trim();

                    if (formattedText) {
                        details.requirements.push('• ' + formattedText);
                    }
                });
            }
        }

        return details;
    }

    // Format date for Google Calendar (YYYYMMDDTHHMMSS)
    function formatDateForGCal(dateTime, durationMinutes = 165) {
        const monthMap = {
            'january': 0, 'february': 1, 'march': 2, 'april': 3,
            'may': 4, 'june': 5, 'july': 6, 'august': 7,
            'september': 8, 'october': 9, 'november': 10, 'december': 11
        };

        const month = monthMap[dateTime.month.toLowerCase()];
        const day = parseInt(dateTime.day, 10);
        const year = parseInt(dateTime.year, 10);

        // Parse time
        const timeMatch = dateTime.time.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
        let hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const isPM = timeMatch[3].toLowerCase() === 'pm';

        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;

        // Create date in EST/EDT
        const startDate = new Date(year, month, day, hours, minutes, 0);
        const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

        const formatDate = (date) => {
            const pad = (n) => n.toString().padStart(2, '0');
            return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
        };

        return {
            start: formatDate(startDate),
            end: formatDate(endDate)
        };
    }

    // Build Google Calendar URL
    function buildGoogleCalendarUrl(shiftDetails) {
        const baseUrl = 'https://calendar.google.com/calendar/render';
        const params = new URLSearchParams();

        params.set('action', 'TEMPLATE');
        // Title format: "PSFC Shift: [Name] (Shift #XXXXXX)"
        const titleParts = [`PSFC Shift: ${shiftDetails.titleWithEmoji}`];
        if (shiftDetails.shiftId) {
            titleParts.push(`(Shift #${shiftDetails.shiftId})`);
        }
        params.set('text', titleParts.join(' '));

        if (shiftDetails.dateTime) {
            // Default shift duration is 2 hours 45 minutes (165 minutes)
            const dates = formatDateForGCal(shiftDetails.dateTime, 165);
            // Use ctz parameter to specify Eastern Time
            params.set('dates', `${dates.start}/${dates.end}`);
            params.set('ctz', 'America/New_York');
        }

        // Build rich description matching the site's formatting
        let description = '';

        // Add link to shift page
        if (shiftDetails.shiftId) {
            description += `View shift: https://members.foodcoop.com/services/shift_claim/${shiftDetails.shiftId}/\n\n`;
        }

        // Shift Description section
        if (shiftDetails.description) {
            description += '<b>SHIFT DESCRIPTION</b>\n';
            description += '\n';
            description += shiftDetails.description + '\n\n';
        }

        // Shift Requirements section
        if (shiftDetails.requirements.length > 0) {
            description += '<b>SHIFT REQUIREMENTS</b>\n';
            description += '\n';
            description += shiftDetails.requirements.join('\n');
        }

        params.set('details', description);
        params.set('location', 'Park Slope Food Coop, 782 Union St, Brooklyn, NY 11215');

        return `${baseUrl}?${params.toString()}`;
    }

    // Check if user is scheduled for this shift
    function isScheduledForShift() {
        const pageText = document.body.innerText.toLowerCase();
        // Look for the confirmation text that appears when scheduled
        return pageText.includes('you are currently scheduled to work this shift') ||
            pageText.includes('currently scheduled to work this shift');
    }

    // Create and inject the button
    function injectButton() {
        // Don't add button if already exists
        if (document.querySelector('.cooperator-calendar-btn')) {
            return;
        }

        // Only show button if user is scheduled for this shift
        if (!isScheduledForShift()) {
            console.log('Cooperator: User not scheduled for this shift, button not shown');
            return;
        }

        const shiftDetails = parseShiftDetails();

        // Find the cancel button - it's an input with class btn-danger or value "CANCEL SHIFT"
        const cancelBtn = document.querySelector('input.btn-danger, input[value="CANCEL SHIFT"], button.btn-danger');

        if (!cancelBtn) {
            console.warn('Cooperator: Could not find cancel button');
            return;
        }

        // Create a wrapper for button + small text
        const wrapper = document.createElement('span');
        wrapper.style.cssText = 'display: inline-block; text-align: center; margin-right: 10px; vertical-align: top;';

        // Create the button as a link styled like the site's buttons
        const button = document.createElement('a');
        button.className = 'cooperator-calendar-btn btn btn-success';
        button.href = buildGoogleCalendarUrl(shiftDetails);
        button.target = '_blank';
        button.rel = 'noopener noreferrer';
        button.style.cssText = 'display: block; margin-bottom: 2px;';

        // Button text - all caps, no icon
        button.textContent = 'ADD TO CALENDAR';

        // Small text below button
        const smallText = document.createElement('small');
        smallText.textContent = 'for Google Calendar';
        smallText.style.cssText = 'font-size: 10px; color: #666; display: block;';

        wrapper.appendChild(button);
        wrapper.appendChild(smallText);

        // Insert wrapper before the cancel button
        cancelBtn.parentElement.insertBefore(wrapper, cancelBtn);

        console.log('Cooperator: Button injected successfully');
    }

    // Wait for page to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectButton);
    } else {
        injectButton();
    }
})();
