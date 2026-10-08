# LangFlow Prototype

This folder holds the visual prototype for the DL-06 chatbot orchestration
workflow.

## Files

- `discountmate_chatbot_flow.json` describes the same node and edge structure
  implemented in `../agents/langgraph_workflow.py`.
- `requirements.txt` keeps LangFlow as an optional local prototyping dependency
  instead of adding it to the ML service runtime image.

## Local Use

From `Backend/ml-service/chatbots/langflow`, install the optional dependency in
your local Python environment:

```bash
pip install -r requirements.txt
```

Then import or recreate the flow in LangFlow using the JSON node and edge
definitions as the source of truth for visual testing.
