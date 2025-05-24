#!/bin/bash

# Run the conversion script
echo "Converting Anthropic models to Google Vertex AI..."
node scripts/convert-to-vertex.js

# Restart the LangGraph server to apply changes
echo "Restarting LangGraph server..."
yarn langgraph:in_mem:up 