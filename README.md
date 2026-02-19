# Overview

This MCP server provides instant weather information for any location on demand. Users simply ask about the weather in a specific place, and the server returns the current weather condition and temperature. Beyond current conditions, it also supports future forecasts, letting users specify how far ahead they want to look. This makes it a convenient, conversational tool for quickly checking weather without navigating traditional weather apps or websites.

The inputs from the user that the mcp server takes in are **Location** and **Range of Data Wanted**

# Example Inputs

- "What is the weather like today in Orlando?"
- "What is the weather for the rest of the week in Tokyo?"
- "Is it raining today in Orlando?

# Installation Guide

1. **npm install** (installs dependencies)
2. Open claude using **claude** in terminal
3. Input **/mcp** in the terminal to check if server is connected
4. Input your response

## If it doesn't connect?
1. Check the **.mcp.json** file path
2. Use **pwd** to get the file path
3. Replace the file path in **args**
