/**
 * WhatsApp & Phone Number Normalization Utilities
 * Supports Pakistani local (03xx, 3xx, +92, 0092) and international E.164 formats.
 */

/**
 * Normalizes a raw phone number string into clean digits for wa.me click-to-chat
 * and returns metadata including validation status, formatted display, and country label.
 *
 * @param {string} rawPhone - Raw input phone number (e.g., "0300-1234567", "+92 321 7654321", "+1 (555) 234-5678")
 * @param {string} defaultCountryCode - Country calling code without '+' (defaults to '92' for Pakistan)
 * @returns {{
 *   isValid: boolean,
 *   normalized: string,       // Clean digits without '+' or leading zero, ready for wa.me/<normalized>
 *   displayFormat: string,    // Human-readable E.164 display format e.g. "+92 300 1234567"
 *   country: string,          // Detected region label (e.g. "Pakistan (+92)", "International (+1)")
 *   error: string | null      // Validation error message or null
 * }}
 */
export function normalizePhoneNumber(rawPhone, defaultCountryCode = '92') {
  if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
    return {
      isValid: false,
      normalized: '',
      displayFormat: '',
      country: '',
      error: 'Phone number is required.'
    };
  }

  const trimmed = rawPhone.trim();
  // Strip whitespace, hyphens, parentheses, dots, slashes
  const cleaned = trimmed.replace(/[\s\-\(\)\.\/\\]/g, '');

  let digits = '';
  let isExplicitInternational = false;

  if (cleaned.startsWith('+')) {
    isExplicitInternational = true;
    digits = cleaned.slice(1).replace(/\D/g, '');
  } else if (cleaned.startsWith('00')) {
    isExplicitInternational = true;
    digits = cleaned.slice(2).replace(/\D/g, '');
  } else {
    digits = cleaned.replace(/\D/g, '');
  }

  if (!digits) {
    return {
      isValid: false,
      normalized: '',
      displayFormat: trimmed,
      country: '',
      error: 'Phone number does not contain any digits.'
    };
  }

  // Handle explicit international prefix (+ or 00)
  if (isExplicitInternational) {
    if (digits.length < 8) {
      return {
        isValid: false,
        normalized: digits,
        displayFormat: `+${digits}`,
        country: 'International',
        error: 'International number is too short (minimum 8 digits required).'
      };
    }
    if (digits.length > 15) {
      return {
        isValid: false,
        normalized: digits,
        displayFormat: `+${digits}`,
        country: 'International',
        error: 'International number exceeds maximum length (maximum 15 digits).'
      };
    }

    // Check if it is a Pakistani international number
    if (digits.startsWith('92')) {
      const national = digits.slice(2);
      const display = national.length >= 10
        ? `+92 ${national.slice(0, 3)} ${national.slice(3)}`
        : `+92 ${national}`;
      return {
        isValid: true,
        normalized: digits,
        displayFormat: display,
        country: 'Pakistan (+92)',
        error: null
      };
    }

    return {
      isValid: true,
      normalized: digits,
      displayFormat: `+${digits}`,
      country: `International (+${digits.slice(0, Math.min(3, digits.length))})`,
      error: null
    };
  }

  // Handle local Pakistani formats without explicit leading '+' or '00'
  // Case A: 11 digits starting with 03 (Standard Pakistan mobile: 03001234567)
  if (digits.length === 11 && digits.startsWith('03')) {
    const national = digits.slice(1); // 3001234567
    const normalized = '92' + national;
    const display = `+92 ${national.slice(0, 3)} ${national.slice(3)}`;
    return {
      isValid: true,
      normalized,
      displayFormat: display,
      country: 'Pakistan (+92)',
      error: null
    };
  }

  // Case B: 10 digits starting with 3 (Pakistan mobile entered without leading 0: 3001234567)
  if (digits.length === 10 && digits.startsWith('3')) {
    const normalized = '92' + digits;
    const display = `+92 ${digits.slice(0, 3)} ${digits.slice(3)}`;
    return {
      isValid: true,
      normalized,
      displayFormat: display,
      country: 'Pakistan (+92)',
      error: null
    };
  }

  // Case C: 12 digits starting with 923 (Pakistan mobile with country code already: 923001234567)
  if (digits.length === 12 && digits.startsWith('923')) {
    const national = digits.slice(2);
    const display = `+92 ${national.slice(0, 3)} ${national.slice(3)}`;
    return {
      isValid: true,
      normalized: digits,
      displayFormat: display,
      country: 'Pakistan (+92)',
      error: null
    };
  }

  // Case D: Other local Pakistani numbers starting with 0 (landline / SCOM, e.g. 0511234567)
  if (digits.startsWith('0') && (digits.length === 10 || digits.length === 11)) {
    const national = digits.slice(1);
    const normalized = defaultCountryCode + national;
    return {
      isValid: true,
      normalized,
      displayFormat: `+${defaultCountryCode} ${national}`,
      country: `Pakistan (+${defaultCountryCode})`,
      error: null
    };
  }

  // Case E: General digits already including country code (10 to 15 digits)
  if (digits.length >= 10 && digits.length <= 15) {
    return {
      isValid: true,
      normalized: digits,
      displayFormat: `+${digits}`,
      country: 'International',
      error: null
    };
  }

  // If too short
  if (digits.length < 10) {
    return {
      isValid: false,
      normalized: digits,
      displayFormat: digits,
      country: '',
      error: 'Phone number is too short (minimum 10 digits for local mobile or 8+ with country code).'
    };
  }

  return {
    isValid: false,
    normalized: digits,
    displayFormat: digits,
    country: '',
    error: 'Invalid phone number format. Please enter a valid number (e.g. 03001234567 or +923001234567).'
  };
}

/**
 * Builds the official WhatsApp click-to-chat URL according to Meta specifications.
 * https://faq.whatsapp.com/5913398998672934
 *
 * @param {string} normalizedDigits - Clean digits without leading zeros, brackets, or '+'
 * @param {string} messageText - The message to pre-fill
 * @returns {string} The full click-to-chat URL
 */
export function buildWhatsAppClickToChatUrl(normalizedDigits, messageText = '') {
  if (!normalizedDigits) return '';
  const cleanDigits = String(normalizedDigits).replace(/\D/g, '');
  if (!cleanDigits) return '';

  const encoded = encodeURIComponent(messageText || '');
  return encoded
    ? `https://wa.me/${cleanDigits}?text=${encoded}`
    : `https://wa.me/${cleanDigits}`;
}

