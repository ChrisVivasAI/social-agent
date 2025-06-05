# Memory V2

This module contains the reflection graph used by the social media agent. The graph defined in [`memory_v2/graph.py`](memory_v2/graph.py) updates a set of prompt rules based on user feedback. It is registered as `reflection_v2` in [`langgraph.json`](langgraph.json).

## Setup

Install the Python dependencies with [Poetry](https://python-poetry.org/):

```bash
poetry install
```

## Usage

Run the graph with the LangGraph CLI or start a local server:

```bash
langgraph run reflection_v2 --input '{"original_post": "...", "user_response": "..."}'
# or
langgraph dev
```

## Tests

Execute the test suite using the provided `Makefile`:

```bash
make test
```

The Makefile also exposes targets such as `make lint` and `make format` for code quality checks.
