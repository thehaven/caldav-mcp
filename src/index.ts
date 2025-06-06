#!/usr/bin/env node

import 'dotenv/config';

async function main() {
  // Exit gracefully if required env vars are not set
  if (!process.env.CALDAV_BASE_URL || !process.env.CALDAV_USERNAME || !process.env.CALDAV_PASSWORD) {
    console.error(
      "Missing CalDAV configuration. Please set CALDAV_BASE_URL, CALDAV_USERNAME, and CALDAV_PASSWORD in your environment or .env file."
    );
    process.exit(0); // Exit gracefully
  }

  console.log("CALDAV_BASE_URL:", process.env.CALDAV_BASE_URL);
  console.log("CALDAV_USERNAME:", process.env.CALDAV_USERNAME);
  console.log("CALDAV_PASSWORD:", process.env.CALDAV_PASSWORD ? "set" : "not set");

  const client = await CalDAVClient.create({
    baseUrl: process.env.CALDAV_BASE_URL || "",
    auth: {
      type: "basic",
      username: process.env.CALDAV_USERNAME || "",
      password: process.env.CALDAV_PASSWORD || ""
    }
  });

  const calendars = await client.getCalendars();

  // Support calendar path or prefix via env
  const calendarPath = process.env.CALDAV_CALENDAR_PATH || "";
  let matchedCalendars: Array<{ url: string; displayName?: string; description?: string; color?: string }>;

  if (calendarPath.endsWith("/")) {
    // Match all calendars under the given prefix
    matchedCalendars = calendars.filter((cal: { url: string }) => cal.url.startsWith(calendarPath));
  } else if (calendarPath) {
    // Match only the calendar with the exact path
    matchedCalendars = calendars.filter((cal: { url: string }) => cal.url === calendarPath);
  } else {
    // Default: use all calendars
    matchedCalendars = calendars;
  }

  if (matchedCalendars.length === 0) {
    throw new Error(`No calendars found matching path: ${calendarPath}`);
  }

  function findCalendar(
    calendars: Array<{ url: string; displayName?: string; description?: string; color?: string }>,
    query: string
  ): { url: string; displayName?: string; description?: string; color?: string } | null {
    if (!query) return null;
    let cal = calendars.find((cal) => cal.url === query || cal.displayName === query);
    if (cal) return cal;
    cal = calendars.find((cal) =>
      cal.url.toLowerCase().includes(query.toLowerCase()) ||
      (cal.displayName && cal.displayName.toLowerCase().includes(query.toLowerCase()))
    );
    return cal || null;
  }

  server.tool(
    "create-event",
    {
      summary: z.string(),
      start: z.string().datetime(),
      end: z.string().datetime(),
      calendar: z.string().optional(), // <-- Add calendar parameter
      timezone: z.string().optional()
    },
    async ({summary, start, end, calendar, timezone}) => {
      let selectedCalendar;
      if (calendar) {
        selectedCalendar = matchedCalendars.find(cal => cal.url === calendar || cal.displayName === calendar);
        if (!selectedCalendar) throw new Error(`Calendar not found: ${calendar}`);
      } else {
        // Try to match username, fallback to first
        selectedCalendar =
          matchedCalendars.find(cal =>
            cal.url.includes(process.env.CALDAV_USERNAME || "") ||
            cal.displayName === process.env.CALDAV_USERNAME
          ) || matchedCalendars[0];
      }
      const eventStart = timezone ? DateTime.fromISO(start, { zone: timezone }).toJSDate() : new Date(start);
      const eventEnd = timezone ? DateTime.fromISO(end, { zone: timezone }).toJSDate() : new Date(end);
      const event = await client.createEvent(selectedCalendar.url, {
        summary: summary,
        start: eventStart,
        end: eventEnd,
      });
      return {
        content: [{type: "text", text: event.uid}]
      };
    }
  );

  // --- list-events ---
  server.tool(
    "list-events",
    {
      start: z.string().datetime(),
      end: z.string().datetime(),
      calendar: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional()
    },
    async ({start, end, calendar, limit, offset}) => {
      let calendarsToQuery: typeof matchedCalendars;
      if (calendar) {
        const found = matchedCalendars.find(cal => cal.url === calendar || cal.displayName === calendar);
        if (!found) throw new Error(`Calendar not found: ${calendar}`);
        calendarsToQuery = [found];
      } else {
        const userCal = matchedCalendars.find(cal =>
          cal.url.includes(process.env.CALDAV_USERNAME || "") ||
          cal.displayName === process.env.CALDAV_USERNAME
        );
        calendarsToQuery = userCal ? [userCal] : matchedCalendars;
      }

      const allEvents = (
        await Promise.all(
          calendarsToQuery.map(cal => client.getEvents(cal.url))
        )
      ).flat();

      const startDate = new Date(start);
      const endDate = new Date(end);

      const filteredEvents = allEvents.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return eventStart <= endDate && eventEnd >= startDate;
      });

      // Pagination
      const pagedEvents = filteredEvents.slice(offset || 0, (offset || 0) + (limit || 100));

      return {
        content: [{
          type: "text",
          text: pagedEvents.map(e => `${e.summary}\nStart: ${e.start}\nEnd: ${e.end}`).join("\n")
        }]
      };
    }
  );

  server.tool(
    "list-calendars",
    {},
    async () => {
      return {
        content: [
          {
            type: "text",
            text: matchedCalendars
              .map(cal =>
                `Name: ${cal.displayName || "(no name)"}\nURL: ${cal.url}` +
                (cal.description ? `\nDescription: ${cal.description}` : "") +
                (cal.color ? `\nColor: ${cal.color}` : "")
              )
              .join("\n\n")
          }
        ]
      };
    }
  );

  server.tool(
    "list-default-calendar",
    {},
    async () => {
      // Try to match username, fallback to first
      const defaultCalendar =
        matchedCalendars.find(cal =>
          cal.url.includes(process.env.CALDAV_USERNAME || "") ||
          cal.displayName === process.env.CALDAV_USERNAME
        ) || matchedCalendars[0];

      return {
        content: [
          {
            type: "text",
            text: `Default Calendar:\nName: ${defaultCalendar.displayName || "(no name)"}\nURL: ${defaultCalendar.url}`
          }
        ]
      };
    }
  );

  server.tool(
    "list-next-event",
    {
      calendar: z.string().optional()
    },
    async ({ calendar }) => {
      let calendarsToQuery: typeof matchedCalendars;
      if (calendar) {
        const found = matchedCalendars.find(cal => cal.url === calendar || cal.displayName === calendar);
        if (!found) throw new Error(`Calendar not found: ${calendar}`);
        calendarsToQuery = [found];
      } else {
        const userCal = matchedCalendars.find(cal =>
          cal.url.includes(process.env.CALDAV_USERNAME || "") ||
          cal.displayName === process.env.CALDAV_USERNAME
        );
        calendarsToQuery = userCal ? [userCal] : matchedCalendars;
      }

      const now = new Date();
      const allEvents = (
        await Promise.all(
          calendarsToQuery.map(cal => client.getEvents(cal.url))
        )
      ).flat();

      const upcoming = allEvents
        .filter(event => new Date(event.start) > now)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      if (upcoming.length === 0) {
        return { content: [{ type: "text", text: "No upcoming events found." }] };
      }

      const next = upcoming[0];
      return {
        content: [
          {
            type: "text",
            text: `Next Event:\n${next.summary}\nStart: ${next.start}\nEnd: ${next.end}`
          }
        ]
      };
    }
  );

  // --- list-events-range ---
  server.tool(
    "list-events-range",
    {
      rangeType: z.enum(["day", "week", "month"]),
      date: z.string().datetime(),
      calendar: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional()
    },
    async ({ rangeType, date, calendar, limit, offset }) => {
      const baseDate = new Date(date);
      let start: Date, end: Date;

      if (rangeType === "day") {
        start = new Date(baseDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 1);
      } else if (rangeType === "week") {
        start = new Date(baseDate);
        start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(end.getDate() + 7);
      } else if (rangeType === "month") {
        start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
        end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
      }

      let calendarsToQuery: typeof matchedCalendars;
      if (calendar) {
        const found = matchedCalendars.find(cal => cal.url === calendar || cal.displayName === calendar);
        if (!found) throw new Error(`Calendar not found: ${calendar}`);
        calendarsToQuery = [found];
      } else {
        const userCal = matchedCalendars.find(cal =>
          cal.url.includes(process.env.CALDAV_USERNAME || "") ||
          cal.displayName === process.env.CALDAV_USERNAME
        );
        calendarsToQuery = userCal ? [userCal] : matchedCalendars;
      }

      const allEvents = (
        await Promise.all(
          calendarsToQuery.map(cal => client.getEvents(cal.url))
        )
      ).flat();

      const filteredEvents = allEvents.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return eventStart < end && eventEnd >= start;
      });

      const pagedEvents = filteredEvents.slice(offset || 0, (offset || 0) + (limit || 100));
      return {
        content: [{
          type: "text",
          text: pagedEvents.length
            ? pagedEvents.map((e: any) => `${e.summary}\nStart: ${e.start}\nEnd: ${e.end}`).join("\n")
            : "No events found for this range."
        }]
      };
    }
  );

  // --- get-event ---
  server.tool(
    "get-event",
    {
      uid: z.string(),
      calendar: z.string().optional()
    },
    async ({ uid, calendar }) => {
      let selectedCalendar;
      if (calendar) {
        selectedCalendar = findCalendar(matchedCalendars, calendar);
        if (!selectedCalendar) throw new Error(`Calendar not found: ${calendar}`);
      } else {
        selectedCalendar =
          findCalendar(matchedCalendars, process.env.CALDAV_USERNAME || "") || matchedCalendars[0];
      }
      // There is no client.getEvent, so fetch all events and filter by UID
      const events = await client.getEvents(selectedCalendar.url);
      const event = events.find((e: any) => e.uid === uid);
      if (!event) {
        return { content: [{ type: "text", text: "Event not found." }] };
      }
      return {
        content: [
          {
            type: "text",
            text: `Event:\nSummary: ${event.summary}\nStart: ${event.start}\nEnd: ${event.end}\nUID: ${event.uid}${(event as any)?.rrule ? `\nRecurrence: ${(event as any).rrule}` : ""}${Array.isArray((event as any).attendees) ? `\nAttendees: ${(event as any).attendees.join(", ")}` : ""}`
          }
        ]
      };
    }
  );

  // --- delete-event ---
  server.tool(
    "delete-event",
    {
      uid: z.string(),
      calendar: z.string().optional()
    },
    async ({ uid, calendar }) => {
      let selectedCalendar;
      if (calendar) {
        selectedCalendar = matchedCalendars.find(cal => cal.url === calendar || cal.displayName === calendar);
        if (!selectedCalendar) throw new Error(`Calendar not found: ${calendar}`);
      } else {
        selectedCalendar =
          matchedCalendars.find(cal =>
            cal.url.includes(process.env.CALDAV_USERNAME || "") ||
            cal.displayName === process.env.CALDAV_USERNAME
          ) || matchedCalendars[0];
      }
      await client.deleteEvent(selectedCalendar.url, uid);
      return {
        content: [
          {
            type: "text",
            text: `Event with UID ${uid} deleted from calendar ${selectedCalendar.displayName || selectedCalendar.url}.`
          }
        ]
      };
    }
  );

  // --- update-event ---
  server.tool(
    "update-event",
    {
      uid: z.string(),
      summary: z.string().optional(),
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
      calendar: z.string().optional()
    },
    async ({
      uid,
      summary,
      start,
      end,
      calendar,
    }: {
      uid: string;
      summary?: string;
      start?: string;
      end?: string;
      calendar?: string;
    }) => {
      let selectedCalendar;
      if (calendar) {
        selectedCalendar = findCalendar(matchedCalendars, calendar);
        if (!selectedCalendar) throw new Error(`Calendar not found: ${calendar}`);
      } else {
        selectedCalendar =
          findCalendar(matchedCalendars, process.env.CALDAV_USERNAME || "") || matchedCalendars[0];
      }
      // There is no client.updateEvent, so delete and re-create the event
      const events = await client.getEvents(selectedCalendar.url);
      const event = events.find((e: any) => e.uid === uid);
      if (!event) {
        return {
          content: [
            {
              type: "text",
              text: "Event not found."
            }
          ]
        };
      }

      // Prepare updated fields
      const updatedSummary = summary ?? event.summary;
      const updatedStart = start ? new Date(start) : new Date(event.start);
      const updatedEnd = end ? new Date(end) : new Date(event.end);

      // Delete the old event
      await client.deleteEvent(selectedCalendar.url, uid);

      // Create a new event with the updated details
      const newEvent = await client.createEvent(selectedCalendar.url, {
        summary: updatedSummary,
        start: updatedStart,
        end: updatedEnd,
      });

      return {
        content: [
          {
            type: "text",
            text: `Event updated:\nSummary: ${updatedSummary}\nStart: ${updatedStart.toISOString()}\nEnd: ${updatedEnd.toISOString()}\nUID: ${newEvent.uid}`
          }
        ]
      };
    }
  );

  server.tool(
    "search-events",
    {
      query: z.string(),
      calendar: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional()
    },
    async ({ query, calendar, limit, offset }) => {
      let calendarsToQuery: typeof matchedCalendars;
      if (calendar) {
        const found = findCalendar(matchedCalendars, calendar);
        if (!found) throw new Error(`Calendar not found: ${calendar}`);
        calendarsToQuery = [found];
      } else {
        const userCal = findCalendar(matchedCalendars, process.env.CALDAV_USERNAME || "");
        calendarsToQuery = userCal ? [userCal] : matchedCalendars;
      }

      const allEvents = (
        await Promise.all(
          calendarsToQuery.map(cal => client.getEvents(cal.url))
        )
      ).flat();

      const filteredEvents = allEvents.filter((event: any) =>
        (event.summary && event.summary.toLowerCase().includes(query.toLowerCase())) ||
        (event.description && event.description.toLowerCase().includes(query.toLowerCase()))
      );

      const pagedEvents = filteredEvents.slice(offset || 0, (offset || 0) + (limit || 100));
      return {
        content: [{
          type: "text",
          text: pagedEvents.length
            ? pagedEvents.map(e => `${e.summary}\nStart: ${e.start}\nEnd: ${e.end}`).join("\n")
            : "No events found matching your search."
        }]
      };
    }
  );

  server.tool(
    "health-check",
    {},
    async () => {
      try {
        await client.getCalendars();
        return { content: [{ type: "text", text: "CalDAV server is reachable and healthy." }] };
      } catch (e) {
        return { content: [{ type: "text", text: `Health check failed: ${e instanceof Error ? e.message : String(e)}` }] };
      }
    }
  );

  server.tool(
    "check-conflicts",
    {
      start: z.string().datetime(),
      end: z.string().datetime(),
      calendar: z.string().optional()
    },
    async ({ start, end, calendar }: { start: string; end: string; calendar?: string }) => {
      let selectedCalendar;
      if (calendar) {
        selectedCalendar = findCalendar(matchedCalendars, calendar);
        if (!selectedCalendar) throw new Error(`Calendar not found: ${calendar}`);
      } else {
        selectedCalendar =
          findCalendar(matchedCalendars, process.env.CALDAV_USERNAME || "") || matchedCalendars[0];
      }
      const allEvents = await client.getEvents(selectedCalendar.url);
      const newStart = new Date(start);
      const newEnd = new Date(end);

      const conflicts = allEvents.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return eventStart < newEnd && eventEnd > newStart;
      });

      return {
        content: [{
          type: "text",
          text: conflicts.length
            ? `Conflicting events:\n${conflicts.map(e => `${e.summary}\nStart: ${e.start}\nEnd: ${e.end}`).join("\n")}`
            : "No conflicts found."
        }]
      };
    }
  );

  server.tool(
    "export-events",
    {
      calendar: z.string().optional(),
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional()
    },
    async ({
      calendar,
      start,
      end
    }: {
      calendar?: string;
      start?: string;
      end?: string;
    }) => {
      let selectedCalendar;
      if (calendar) {
        selectedCalendar = findCalendar(matchedCalendars, calendar);
        if (!selectedCalendar) throw new Error(`Calendar not found: ${calendar}`);
      } else {
        selectedCalendar =
          findCalendar(matchedCalendars, process.env.CALDAV_USERNAME || "") || matchedCalendars[0];
      }
      let events = await client.getEvents(selectedCalendar.url);
      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        events = events.filter(event => {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
          return eventStart <= endDate && eventEnd >= startDate;
        });
      }
      // ICS export is not supported by the current CalDAV client.
      return {
        content: [{ type: "text", text: "ICS export is not supported by the current CalDAV client." }]
      };
    }
  );

  server.tool(
    "import-events",
    {
      calendar: z.string().optional(),
      ics: z.string()
    },
    async ({ calendar, ics }: { calendar?: string; ics: string }) => {
      let selectedCalendar;
      if (calendar) {
        selectedCalendar = findCalendar(matchedCalendars, calendar);
        if (!selectedCalendar) throw new Error(`Calendar not found: ${calendar}`);
      } else {
        selectedCalendar =
          findCalendar(matchedCalendars, process.env.CALDAV_USERNAME || "") || matchedCalendars[0];
      }
      // Parse the ICS data and create the event
      // This is a basic example; for full ICS parsing, use a library like ical.js
      const matchSummary = ics.match(/SUMMARY:(.*)/);
      const matchStart = ics.match(/DTSTART(?:;[^:]+)?:([^\r\n]+)/);
      const matchEnd = ics.match(/DTEND(?:;[^:]+)?:([^\r\n]+)/);

      if (!matchSummary || !matchStart || !matchEnd) {
        throw new Error("ICS data missing SUMMARY, DTSTART, or DTEND fields.");
      }

      const summary = matchSummary[1].trim();
      const start = matchStart[1].trim();
      const end = matchEnd[1].trim();

      // Convert to ISO string if needed
      const startDate = DateTime.fromFormat(start, "yyyyMMdd'T'HHmmss", { zone: "utc" }).isValid
        ? DateTime.fromFormat(start, "yyyyMMdd'T'HHmmss", { zone: "utc" }).toJSDate()
        : new Date(start);
      const endDate = DateTime.fromFormat(end, "yyyyMMdd'T'HHmmss", { zone: "utc" }).isValid
        ? DateTime.fromFormat(end, "yyyyMMdd'T'HHmmss", { zone: "utc" }).toJSDate()
        : new Date(end);

      await client.createEvent(selectedCalendar.url, {
        summary,
        start: startDate,
        end: endDate,
      });

      return {
        content: [{ type: "text", text: "Event imported successfully." }]
      };
    }
  );

  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();