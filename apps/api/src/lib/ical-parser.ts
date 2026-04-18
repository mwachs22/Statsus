/**
 * Lightweight ICS (iCalendar) parser — handles VEVENT components.
 * Supports RFC 5545 line folding, value encoding, DATE and DATE-TIME.
 */

export interface ICalEvent {
  uid: string;
  summary?: string;
  description?: string;
  location?: string;
  organizer?: string;
  attendees: Array<{ email: string; name?: string; partstat?: string }>;
  start_time: Date;
  end_time?: Date;
  all_day: boolean;
  recurrence_rule?: string;
  status?: string;
}

function unfold(raw: string): string {
  return raw.replace(/\r\n([ \t])/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function decodeValue(v: string): string {
  return v.replace(/\\n/g, '\n').replace(/\\N/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseDateTime(
  value: string,
  params: string
): { date: Date; allDay: boolean } {
  const v = value.trim();
  const isDate = /VALUE=DATE(?!-TIME)/i.test(params) || /^\d{8}$/.test(v);

  if (isDate) {
    // YYYYMMDD — treat as local midnight
    return {
      date: new Date(
        parseInt(v.slice(0, 4), 10),
        parseInt(v.slice(4, 6), 10) - 1,
        parseInt(v.slice(6, 8), 10)
      ),
      allDay: true,
    };
  }

  // YYYYMMDDTHHMMSS[Z]
  const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T${v.slice(9, 11)}:${v.slice(11, 13)}:${v.slice(13, 15)}${v.endsWith('Z') ? 'Z' : ''}`;
  return { date: new Date(iso), allDay: false };
}

export function parseICS(raw: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = unfold(raw).split('\n');

  let cur: Partial<ICalEvent> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      cur = { attendees: [] };
      continue;
    }
    if (trimmed === 'END:VEVENT') {
      if (cur?.uid && cur.start_time) events.push(cur as ICalEvent);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const propFull = line.slice(0, colonIdx);
    const rawValue = line.slice(colonIdx + 1);

    const semiIdx = propFull.indexOf(';');
    const propName = semiIdx !== -1 ? propFull.slice(0, semiIdx).toUpperCase() : propFull.toUpperCase();
    const params = semiIdx !== -1 ? propFull.slice(semiIdx + 1) : '';
    const value = decodeValue(rawValue);

    switch (propName) {
      case 'UID':         cur.uid = value.trim(); break;
      case 'SUMMARY':    cur.summary = value; break;
      case 'DESCRIPTION': cur.description = value; break;
      case 'LOCATION':   cur.location = value; break;
      case 'RRULE':      cur.recurrence_rule = rawValue.trim(); break;
      case 'STATUS':     cur.status = value.trim().toUpperCase(); break;
      case 'ORGANIZER':  cur.organizer = value.replace(/^mailto:/i, ''); break;
      case 'DTSTART': {
        const { date, allDay } = parseDateTime(rawValue, params);
        cur.start_time = date;
        cur.all_day = allDay;
        break;
      }
      case 'DTEND': {
        const { date } = parseDateTime(rawValue, params);
        cur.end_time = date;
        break;
      }
      case 'ATTENDEE': {
        const emailMatch = value.match(/^mailto:(.+)$/i);
        const cnMatch = params.match(/CN=([^;]+)/i);
        const partstatMatch = params.match(/PARTSTAT=([^;]+)/i);
        if (emailMatch) {
          cur.attendees!.push({
            email: emailMatch[1].trim(),
            name: cnMatch?.[1].replace(/^"|"$/g, ''),
            partstat: partstatMatch?.[1],
          });
        }
        break;
      }
    }
  }

  return events;
}
