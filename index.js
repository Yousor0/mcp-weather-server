// =============================================================================
// MY FIRST MCP SERVER - Weather Tool
// =============================================================================
// This file creates an MCP (Model Context Protocol) server that Claude can
// connect to. It exposes one tool: get_weather.
//
// Data sources (both free, no API key required):
//   - Nominatim (OpenStreetMap) for geocoding location names → coordinates
//   - Open-Meteo for weather forecasts
// =============================================================================

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// -----------------------------------------------------------------------------
// WMO Weather Code descriptions
// Open-Meteo uses standard WMO weather codes. This maps them to readable text.
// Full list: https://open-meteo.com/en/docs#weathervariables
// -----------------------------------------------------------------------------
const WMO_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

function describeWeather(code) {
  return WMO_CODES[code] ?? `Unknown (code ${code})`;
}

// -----------------------------------------------------------------------------
// Step 1: Convert a location name to lat/lon using OpenStreetMap Nominatim
// -----------------------------------------------------------------------------
async function geocode(location) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;

  const response = await fetch(url, {
    headers: {
      // Nominatim requires a User-Agent identifying your app
      "User-Agent": "my-first-mcp-weather-server/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Geocoding failed for "${location}": ${response.statusText}`,
    );
  }

  const results = await response.json();

  if (results.length === 0) {
    throw new Error(`Location not found: "${location}"`);
  }

  return {
    name: results[0].display_name,
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
  };
}

// -----------------------------------------------------------------------------
// Step 2: Fetch weather data from Open-Meteo using lat/lon
// Returns current conditions, next 24 hours hourly, and 7-day daily forecast
// -----------------------------------------------------------------------------
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    // Current conditions
    current: "temperature_2m,weather_code",
    // Hourly for the next 24 hours (API returns up to 7 days; we slice later)
    hourly: "temperature_2m,weather_code",
    // Daily high/low and condition for 7 days
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    timezone: "auto", // auto-detect timezone from coordinates
    forecast_days: 7,
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Weather fetch failed: ${response.statusText}`);
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// Step 3: Format the raw API response into a clean, readable object
// -----------------------------------------------------------------------------
function formatWeather(locationName, data) {
  // --- Current conditions ---
  const current = {
    temperature: `${data.current.temperature_2m}°F`,
    condition: describeWeather(data.current.weather_code),
  };

  // --- Hourly forecast (next 24 hours) ---
  // The API returns arrays; index 0 = current hour, index 23 = 23 hours from now
  const hourly = data.hourly.time.slice(0, 24).map((time, i) => ({
    time: new Date(time).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    temperature: `${data.hourly.temperature_2m[i]}°F`,
    condition: describeWeather(data.hourly.weather_code[i]),
  }));

  // --- 7-day daily forecast ---
  const daily = data.daily.time.map((date, i) => ({
    day: new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    high: `${data.daily.temperature_2m_max[i]}°F`,
    low: `${data.daily.temperature_2m_min[i]}°F`,
    condition: describeWeather(data.daily.weather_code[i]),
  }));

  return {
    location: locationName,
    current,
    next_24_hours: hourly,
    weekly_forecast: daily,
  };
}

// =============================================================================
// MCP SERVER SETUP
// =============================================================================

// Create the server instance
// The first argument is server metadata; the second declares its capabilities
const server = new Server(
  {
    name: "weather-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {}, // This server exposes tools (not resources or prompts)
    },
  },
);

// -----------------------------------------------------------------------------
// Handler: list_tools
// Claude calls this first to discover what tools are available on this server
// -----------------------------------------------------------------------------
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_weather",
        description:
          "Get weather information for one or more locations. Returns current conditions, hourly forecast for the next 24 hours, and daily high/low forecast for the next 7 days.",
        inputSchema: {
          type: "object",
          properties: {
            locations: {
              type: "array",
              items: { type: "string" },
              description:
                'One or more location names, e.g. ["New York", "Tokyo", "London"]',
              minItems: 1,
            },
          },
          required: ["locations"],
        },
      },
    ],
  };
});

// -----------------------------------------------------------------------------
// Handler: call_tool
// Claude calls this when it wants to actually run the get_weather tool
// -----------------------------------------------------------------------------
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Make sure it's the tool we know about
  if (request.params.name !== "get_weather") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const { locations } = request.params.arguments;

  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error(
      'The "locations" argument must be a non-empty array of strings.',
    );
  }

  // Fetch weather for every requested location (in parallel for speed)
  const results = await Promise.all(
    locations.map(async (location) => {
      try {
        const { name, lat, lon } = await geocode(location);
        const rawWeather = await fetchWeather(lat, lon);
        return formatWeather(name, rawWeather);
      } catch (err) {
        // Return an error object for this location instead of crashing everything
        return { location, error: err.message };
      }
    }),
  );

  // Return the results as formatted JSON text
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
});

// =============================================================================
// START THE SERVER
// =============================================================================
// StdioServerTransport means Claude communicates with this server over
// stdin/stdout — the standard way MCP servers work with Claude Code.
// =============================================================================

const transport = new StdioServerTransport();
await server.connect(transport);

// Note: Do NOT use console.log here — stdout is reserved for MCP messages.
// Use console.error for any debugging you need.
console.error("Weather MCP server running. Waiting for requests...");
