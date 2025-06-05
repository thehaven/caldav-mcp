# caldav-mcp

A CalDAV Model Context Protocol (MCP) server to expose calendar operations as tools for AI assistants.

## Features

- Connect to CalDAV servers
- Create, update, and delete calendar events
- List calendar events by time range, day, week, or month
- List all available calendars and the default calendar
- List the next upcoming event
- Search for events by keyword
- Get event details by UID
- Pagination and timezone support for event listings
- Health check for CalDAV server connectivity
- Fuzzy/partial calendar selection
- **Conflict detection** for event creation and updates
- **Recurring event support** (recurrence rules shown in event details)
- **Event attendees** shown in event details (if available)
- **Import/export events** in ICS format
- **Calendar metadata** (color, description) shown in listings

## Setup

1. Install dependencies:

```bash
npm install
```

1. Create a `.env` file in the project root with your CalDAV credentials:

{
  "mcpServers": {
    ...,
    "calendar": {
      "command": "npx",
      "args": [
        "caldav-mcp"
      ],
      "env": {
        "CALDAV_BASE_URL": "[CalDAV server URL]",
        "CALDAV_USERNAME": "`<CalDAV username>`",
        "CALDAV_PASSWORD": "<CalDAV password>",
        // Example: Use all calendars under /shared-calendars/
        "CALDAV_CALENDAR_PATH": "/shared-calendars/"
      }
    }
  }
}

```env
CALDAV_BASE_URL=<CalDAV server URL>
CALDAV_USERNAME=<CalDAV username>
CALDAV_PASSWORD=<CalDAV password>
```

## Setup in Claude Desktop

{
  "mcpServers": {
    ...,
    "calendar": {
      "command": "npx",
      "args": [
        "caldav-mcp"
      ],
      "env": {
        "CALDAV_BASE_URL": "<CalDAV server URL>",
        "CALDAV_USERNAME": "`<CalDAV username>`",
        "CALDAV_PASSWORD": "<CalDAV password>",
        // Example: Use all calendars under /shared-calendars/
        "CALDAV_CALENDAR_PATH": "/shared-calendars/"
      }
    }
  }
}

```json
{
  "mcpServers": {
    ...,
    "calendar": {
      "command": "npx",
      "args": [
        "caldav-mcp"
      ],
      "env": {
        "CALDAV_BASE_URL": "<CalDAV server URL>",
        "CALDAV_USERNAME": "<CalDAV username>",
        "CALDAV_PASSWORD": "<CalDAV password>",
        // Example: Use all calendars under /shared-calendars/
        "CALDAV_CALENDAR_PATH": "/shared-calendars/"
      }
    }
  }
}
```

## Calendar Path Selection

You can control which calendars are used by setting the `CALDAV_CALENDAR_PATH` environment variable:

- **Single Calendar:**  
  Set `CALDAV_CALENDAR_PATH` to the exact calendar path (e.g. `/user-calendar` or `/family/child1/`) to use only that calendar.

- **Multiple Calendars (Prefix):**  
  Set `CALDAV_CALENDAR_PATH` to a path ending with a slash (e.g. `/family/`) to match all calendars whose paths start with that prefix.

- **All Calendars:**  
  If `CALDAV_CALENDAR_PATH` is not set, all available calendars will be used.

**Examples:**

```sh
# Use only a specific calendar (by path)
export CALDAV_CALENDAR_PATH=/user-calendar

# Use only a specific family member's calendar
export CALDAV_CALENDAR_PATH=/family/child1/

# Use all calendars under a specific prefix
export CALDAV_CALENDAR_PATH=/family/
```

## Available Tools

- **create-event**: Create a new event (with optional timezone and calendar selection)
- **list-events**: List events in a time range (with pagination, timezone, and calendar selection)
- **list-events-range**: List events by day, week, or month
- **list-calendars**: List all available calendars (shows color, description, etc.)
- **list-default-calendar**: Show the default calendar (matching username or first available)
- **list-next-event**: Show the next upcoming event
- **get-event**: Get details for a specific event by UID (shows recurrence and attendees if available)
- **update-event**: Update an event’s summary, start, or end time by UID
- **delete-event**: Delete an event by UID
- **search-events**: Search for events by keyword (summary or description)
- **health-check**: Check CalDAV server connectivity
- **check-conflicts**: Check for conflicting events in a calendar for a given time range
- **export-events**: Export events as ICS (optionally by date range)
- **import-events**: Import events from ICS

## Notes

- Calendar selection supports fuzzy/partial matching by display name or path.
- Pagination is supported via `limit` and `offset` parameters.
- Timezone handling is supported for event creation and listing.
- Recurring events are listed if supported by your CalDAV server; recurrence rules are shown in event details.
- Attendees are shown in event details if available.
- Calendar metadata (color, description) is shown in calendar listings.
- ICS import/export requires your CalDAV server and client to support these features.
- Conflict detection helps prevent overlapping events.

MIT
