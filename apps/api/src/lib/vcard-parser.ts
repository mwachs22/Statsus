/**
 * Lightweight vCard parser (v3.0/v4.0).
 * Handles RFC 6350 line folding and the most common properties.
 */

export interface ParsedContact {
  uid?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  emails: Array<{ type: string; value: string }>;
  phones: Array<{ type: string; value: string }>;
  organization?: string;
  title?: string;
  photo_url?: string;
  notes?: string;
}

function unfold(raw: string): string {
  return raw.replace(/\r\n([ \t])/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function extractType(params: string): string {
  const match = params.match(/TYPE=([^;,]+)/i);
  return match?.[1]?.toLowerCase() ?? 'other';
}

export function parseVCard(raw: string): ParsedContact {
  const contact: ParsedContact = { emails: [], phones: [] };
  const lines = unfold(raw).split('\n');

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const propFull = line.slice(0, colonIdx).toUpperCase();
    const value = line.slice(colonIdx + 1).trim();
    if (!value) continue;

    const semiIdx = propFull.indexOf(';');
    const propName = semiIdx !== -1 ? propFull.slice(0, semiIdx) : propFull;
    const params = semiIdx !== -1 ? propFull.slice(semiIdx + 1) : '';

    switch (propName) {
      case 'UID': contact.uid = value; break;
      case 'FN':  contact.full_name = value; break;
      case 'N': {
        const parts = value.split(';');
        contact.last_name  = parts[0]?.trim() || undefined;
        contact.first_name = parts[1]?.trim() || undefined;
        break;
      }
      case 'EMAIL':
        contact.emails.push({ type: extractType(params), value });
        break;
      case 'TEL':
        contact.phones.push({ type: extractType(params), value });
        break;
      case 'ORG':
        // ORG may be "Company;Department" — take first segment
        contact.organization = value.split(';')[0].trim() || undefined;
        break;
      case 'TITLE': contact.title = value; break;
      case 'NOTE':  contact.notes = value.replace(/\\n/g, '\n'); break;
      case 'PHOTO': {
        // PHOTO;VALUE=URI:https://... or PHOTO;ENCODING=b;TYPE=JPEG:base64...
        if (params.includes('URI') || value.startsWith('http')) {
          contact.photo_url = value;
        }
        break;
      }
    }
  }

  // Fallback: if FN is missing, build from N
  if (!contact.full_name && (contact.first_name || contact.last_name)) {
    contact.full_name = [contact.first_name, contact.last_name].filter(Boolean).join(' ');
  }

  return contact;
}
