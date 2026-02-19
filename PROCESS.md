# Process Reflection

## What I Built

I built a weather MCP server that gives Claude real-time weather data for any location. The server uses `get_weather`, which accepts one or more city names. It chains two free APIs — Nominatim (OpenStreetMap) for converting city names into coordinates, then Open-Meteo for the actual forecast. The response includes current conditions, a 24-hour hourly breakdown, and a 7-day daily high/low forecast. I chose these APIs because neither requires an API key, keeping the setup frictionless. I also made the tool accept an array of locations so Claude can compare multiple cities in a single call.

## How Claude Code Helped

Claude Code helped me mainly with the setup of the MCP server with the sample input that was given to me for the assignment. Additionally, it was useful to help me fix the mcp server not connecting.

## Debugging Journey

The one error I had encountered during the development of this project was the MCP server not connecting to the terminal / claude code. I was able to fix this by retracing my set up steps. The issue that I found was in the **.mcp.json** file, which was hardcoded so the file path would not have been universal, the change that fixes it was just directly putting in the index.js, instead of having a long file path.

## How MCP Works

MCP is a standard protocol that lets Claude communicate to external servers over stdin/stdout. Claude first asks the server to list its tools, then calls specific tools by name and passes structured arguments. The server then handles each request and returns a text response.

## What I'd Do Differently

I would try to add input validation into the code so the response of the chat bot would be more consistent.
