"""WhatsApp and phone number normalization utilities for ClassroomOS.

Supports Pakistani mobile formats (03xx, 3xx, +92, 0092) and international E.164.
"""

import re
from typing import Dict, Any, Optional
from urllib.parse import quote


def normalize_phone_number(raw_phone: Optional[str], default_country_code: str = '92') -> Dict[str, Any]:
    """Normalize a phone number string for WhatsApp dispatch (wa.me) and database storage.

    Returns a dict with:
      - is_valid: bool
      - normalized: str (clean digits without '+' or leading zeros, ready for wa.me/<normalized>)
      - display_format: str (E.164 formatted string with '+' and spacing)
      - country: str (detected region description)
      - error: Optional[str]
    """
    if not raw_phone or not str(raw_phone).strip():
        return {
            'is_valid': False,
            'normalized': '',
            'display_format': '',
            'country': '',
            'error': 'Phone number is required.'
        }

    trimmed = str(raw_phone).strip()
    # Strip spaces, hyphens, parentheses, dots, slashes
    cleaned = re.sub(r'[\s\-\(\)\.\/\\]', '', trimmed)

    is_explicit_international = False
    if cleaned.startswith('+'):
        is_explicit_international = True
        digits = re.sub(r'\D', '', cleaned[1:])
    elif cleaned.startswith('00'):
        is_explicit_international = True
        digits = re.sub(r'\D', '', cleaned[2:])
    else:
        digits = re.sub(r'\D', '', cleaned)

    if not digits:
        return {
            'is_valid': False,
            'normalized': '',
            'display_format': trimmed,
            'country': '',
            'error': 'Phone number does not contain any digits.'
        }

    # Explicit international formats
    if is_explicit_international:
        if len(digits) < 8:
            return {
                'is_valid': False,
                'normalized': digits,
                'display_format': f"+{digits}",
                'country': 'International',
                'error': 'International number is too short (minimum 8 digits required).'
            }
        if len(digits) > 15:
            return {
                'is_valid': False,
                'normalized': digits,
                'display_format': f"+{digits}",
                'country': 'International',
                'error': 'International number exceeds maximum length (maximum 15 digits).'
            }

        if digits.startswith('92'):
            national = digits[2:]
            display = f"+92 {national[:3]} {national[3:]}" if len(national) >= 10 else f"+92 {national}"
            return {
                'is_valid': True,
                'normalized': digits,
                'display_format': display,
                'country': 'Pakistan (+92)',
                'error': None
            }

        return {
            'is_valid': True,
            'normalized': digits,
            'display_format': f"+{digits}",
            'country': f"International (+{digits[:3]})",
            'error': None
        }

    # Pakistani local formats
    # Case A: 11 digits starting with 03 (Standard Pakistan mobile: 03001234567)
    if len(digits) == 11 and digits.startswith('03'):
        national = digits[1:]
        normalized = '92' + national
        display = f"+92 {national[:3]} {national[3:]}"
        return {
            'is_valid': True,
            'normalized': normalized,
            'display_format': display,
            'country': 'Pakistan (+92)',
            'error': None
        }

    # Case B: 10 digits starting with 3 (Pakistan mobile entered without 0: 3001234567)
    if len(digits) == 10 and digits.startswith('3'):
        normalized = '92' + digits
        display = f"+92 {digits[:3]} {digits[3:]}"
        return {
            'is_valid': True,
            'normalized': normalized,
            'display_format': display,
            'country': 'Pakistan (+92)',
            'error': None
        }

    # Case C: 12 digits starting with 923 (Pakistan mobile with country code already: 923001234567)
    if len(digits) == 12 and digits.startswith('923'):
        national = digits[2:]
        display = f"+92 {national[:3]} {national[3:]}"
        return {
            'is_valid': True,
            'normalized': digits,
            'display_format': display,
            'country': 'Pakistan (+92)',
            'error': None
        }

    # Case D: Other local numbers starting with 0 (landline / local)
    if digits.startswith('0') and len(digits) in (10, 11):
        national = digits[1:]
        normalized = default_country_code + national
        return {
            'is_valid': True,
            'normalized': normalized,
            'display_format': f"+{default_country_code} {national}",
            'country': f"Pakistan (+{default_country_code})",
            'error': None
        }

    # Case E: Generic digits with country code already (10 to 15 digits)
    if 10 <= len(digits) <= 15:
        return {
            'is_valid': True,
            'normalized': digits,
            'display_format': f"+{digits}",
            'country': 'International',
            'error': None
        }

    if len(digits) < 10:
        return {
            'is_valid': False,
            'normalized': digits,
            'display_format': digits,
            'country': '',
            'error': 'Phone number is too short (minimum 10 digits required).'
        }

    return {
        'is_valid': False,
        'normalized': digits,
        'display_format': digits,
        'country': '',
        'error': 'Invalid phone number format.'
    }


def build_whatsapp_click_to_chat_url(normalized_digits: str, message_text: str = '') -> str:
    """Build official WhatsApp wa.me click-to-chat URL."""
    clean = re.sub(r'\D', '', str(normalized_digits or ''))
    if not clean:
        return ''
    if message_text:
        return f"https://wa.me/{clean}?text={quote(message_text)}"
    return f"https://wa.me/{clean}"
