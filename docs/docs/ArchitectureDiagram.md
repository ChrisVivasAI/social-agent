# Enhanced Dictation System - Architecture Diagram

## Overall System Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                               User Interface                               │
├───────────┬───────────┬─────────────┬───────────────┬────────────────────┤
│ Hierarchy │ Dictation │ Suggestion  │ Feedback      │ Dashboard &        │
│ Layout    │ Controls  │ Overlay     │ Confirmation  │ Canvas Views       │
└─────┬─────┴─────┬─────┴──────┬──────┴───────┬───────┴─────────┬──────────┘
      │           │            │              │                 │
┌─────▼───────────▼────────────▼──────────────▼─────────────────▼──────────┐
│                              Core Controllers                             │
├───────────────┬─────────────────┬───────────────┬──────────────────────┬─┘
│ Dictation     │ Command         │ Context       │ Mode                 │
│ Manager       │ Interpreter     │ Manager       │ Controller           │
└───────┬───────┴────────┬────────┴───────┬───────┴──────────┬───────────┘
        │                │                │                  │
┌───────▼────────────────▼────────────────▼──────────────────▼───────────┐
│                             Service Layer                               │
├────────────────┬────────────────┬───────────────┬────────────────────┬─┘
│ Command        │ Suggestion     │ AI            │ State              │
│ Processor      │ Generator      │ Categorizer   │ Persistence        │
└────────┬───────┴────────┬───────┴───────┬───────┴──────────┬─────────┘
         │                │               │                  │
┌────────▼────────────────▼───────────────▼──────────────────▼─────────┐
│                              Data Layer                               │
├───────────────┬─────────────────┬───────────────┬───────────────────┬┘
│ Hierarchy     │ Note            │ User          │ Dictation         │
│ Store         │ Store           │ Preferences   │ Memory            │
└───────────────┴─────────────────┴───────────────┴───────────────────┘
```

## Component Interactions

### Dictation Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │  Dictation  │     │   Command   │     │   Context   │
│   Speech    ├────►│   Manager   ├────►│ Interpreter ├────►│   Manager   │
└─────────────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │                   │
                           ▼                   ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐    ┌─────────────┐
                    │ Suggestion  │     │   Command   │    │  Feedback   │
                    │  Generator  │     │  Processor  │    │ Confirmation│
                    └──────┬──────┘     └──────┬──────┘    └──────┬──────┘
                           │                   │                   │
                           ▼                   ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐    ┌─────────────┐
                    │ Suggestion  │     │   State     │    │     UI      │
                    │   Overlay   │     │   Update    │    │   Update    │
                    └─────────────┘     └─────────────┘    └─────────────┘
```

### Context Management

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ Hierarchy     │       │ Context       │       │ Mode          │
│ Navigation    ├──────►│ Manager       │◄──────┤ Controller    │
└───────┬───────┘       └───────┬───────┘       └───────────────┘
        │                       │
        ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ Selected Item │       │ Dictation     │       │ UI Updates    │
│ Update        │◄──────┤ Context Update│──────►│ (Indicators)  │
└───────────────┘       └───────┬───────┘       └───────────────┘
                                │
                                ▼
                        ┌───────────────┐       ┌───────────────┐
                        │ Command       │       │ Suggestion    │
                        │ Interpretation│──────►│ Relevance     │
                        └───────────────┘       └───────────────┘
```

### Dictation Modes

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ User Command  │       │ Mode          │       │ Command       │
│ "Switch Mode" ├──────►│ Controller    ├──────►│ Parser Update │
└───────────────┘       └───────┬───────┘       └───────────────┘
                                │
                                ▼
                        ┌───────────────┐       ┌───────────────┐
                        │ Mode-Specific │       │ UI Mode       │
                        │ Behavior      │──────►│ Indicator     │
                        └───────┬───────┘       └───────────────┘
                                │
                                │
                                ▼
              ┌───────────────────────────────────────┐
              │            Available Modes            │
              ├───────────────┬───────────────────────┤
              │ Global Mode   │ In-Note Mode          │
              │ - High-level  │ - Content editing     │
              │   commands    │ - Structured input    │
              │ - Navigation  │ - Formatting          │
              │ - Creation    │ - Section management  │
              └───────────────┴───────────────────────┘
```

### AI Categorization Flow

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ Dictated      │       │ AI            │       │ Theme         │
│ Content       ├──────►│ Categorizer   ├──────►│ Detection     │
└───────────────┘       └───────────────┘       └───────┬───────┘
                                                        │
                                                        ▼
                                                ┌───────────────┐
                                                │ Categorization│
                                                │ Suggestions   │
                                                └───────┬───────┘
                                                        │
                        ┌───────────────┐              │
                        │ User          │              ▼
                        │ Feedback      │◄─────┬───────────────┐
                        └───────┬───────┘      │ Suggestion    │
                                │              │ Presentation  │
                                │              └───────────────┘
                                ▼
                        ┌───────────────┐       ┌───────────────┐
                        │ Learning      │       │ Future        │
                        │ System Update │──────►│ Suggestion    │
                        └───────────────┘       │ Improvement   │
                                                └───────────────┘
```

## Data Flow

```
┌───────────────────────────────────────────────────────────┐
│                      User Interaction                      │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                    Speech Recognition                      │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                     Command Parsing                        │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌─────────────────┬─────────────┴─────────────┬─────────────┐
│  Navigation     │     Creation Commands     │  Editing    │
│  Commands       │                           │  Commands   │
└────────┬────────┴─────────────┬─────────────┴──────┬──────┘
         │                      │                    │
         ▼                      ▼                    ▼
┌────────────────┐  ┌─────────────────────┐  ┌─────────────┐
│Context Updates │  │ State Modifications │  │Content      │
│                │  │                     │  │Modifications│
└────────┬───────┘  └──────────┬──────────┘  └──────┬──────┘
         │                     │                    │
         └─────────────────────┼────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────┐
│                     UI Updates                             │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                     User Feedback                          │
└───────────────────────────────────────────────────────────┘
```

## Implementation Notes

1. **Component Communication**
   - Components primarily communicate through state updates and events
   - Direct coupling between components is minimized
   - Context changes propagate through the system via subscriptions

2. **Extensibility Points**
   - Command Interpreter can be extended with new command patterns
   - Mode Controller supports adding new dictation modes
   - AI Categorizer can incorporate additional analysis algorithms

3. **Performance Considerations**
   - Speech recognition processing occurs in a separate thread
   - Suggestion generation is performed asynchronously
   - UI updates are batched where possible to prevent jank

4. **State Management**
   - Zustand stores maintain application state
   - Context changes trigger cascading updates
   - Component local state is used for ephemeral UI state 