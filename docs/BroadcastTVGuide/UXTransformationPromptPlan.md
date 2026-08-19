# AJN Liberty Play — UX Layer Transformation Prompt Plan (v12.5)

## 1. Purpose of This Specification
This document defines a **User Experience (UX) abstraction layer** that sits on top of an existing enterprise-grade backend system (Broadcast Engine, Scheduler, Normalization, Playback Core).

### Core Principle
> The system must expose **simplicity at the surface**, while preserving **full architectural complexity underneath**.

Backend systems are not visible to users. Users only interact with:
* Navigation
* Playback
* Guide
* Library
* Settings

---

## 2. UX Design Objective
Transform the application into a **familiar TV-first interface**, where:
* New users immediately understand what to do
* No configuration is required to start watching content
* TV Guide is always discoverable and primary
* Advanced systems are progressively disclosed

---

## 3. First Launch Experience (Critical Path)

### 3.1 First Screen Rule
On first launch, the user must NEVER see a blank screen, raw architecture, or empty state.

#### Instead show:
```
AJN Liberty Play
────────────────────────────

▶ Continue Watching
Resume Last Channel

📺 TV Guide
Open Live Guide

📁 Open Playlist
M3U • XMLTV • Archive • YouTube • Rumble

🎬 Media Library

⚙ Settings
────────────────────────────
```

#### Behavior Rules
* “Continue Watching” only appears if session exists
* Otherwise default focus = TV Guide
* All actions must be one click

---

## 4. Primary Navigation Model (Global Contract)

### 4.1 Required Global Navigation Items
These must exist in ALL layouts:
* 🏠 Home
* 📺 Guide
* ▶ Player
* 📁 Library
* ⭐ Favorites
* 🔍 Search
* ⚙ Settings

#### Constraints
* Always visible or accessible within 1 click
* Never buried inside contextual menus
* Never dependent on current layout mode

---

## 5. TV Guide Priority Rule

### 5.1 Guide is a First-Class Surface
The TV Guide must:
* Be accessible from Home instantly
* Never require deep navigation
* Support “return to guide” shortcut from Player

#### Required Entry Points:
* Home → Guide button
* Global Nav → Guide tab
* Player overlay → “Go to Guide”

---

## 6. Theatre Mode Design Requirement

### 6.1 Theatre Mode Must Be Explicit (Not Hidden)

#### UI Requirement:
```
Guide | Player | Theatre | Fullscreen
```

#### Rules:
* Theatre Mode is a primary toggle, not hidden in settings
* Must be toggleable in one click
* Must persist across sessions

### 6.2 Persistence Rule
If user selects Theatre Mode:
```text
Settings → Default View = Theatre
```
On next launch:
* App opens directly in Theatre Mode

---

## 7. Startup Flow Logic

### 7.1 Startup Decision Tree
```
APP START
   ↓
Load Session State
   ↓
If Last Session Exists:
      Resume Watching
   ↓
Else:
      Open Home Dashboard
```

### 7.2 Resume UX Pattern
```
Resume Watching
Liberty Movies
01:23:11 remaining

[ Continue ]   [ Restart ]
```

#### Rules:
* Must appear automatically if session exists
* Must include time remaining
* Must offer restart option

---

## 8. Default Player Behavior

### 8.1 User Configurable Startup Target
Settings:
```
Default Startup View
○ TV Guide
○ Player
○ Library
○ Dashboard
```

#### Rule:
* System respects preference immediately on launch
* No override unless session resume exists

---

## 9. Device Adaptive Layout System

### 9.1 Breakpoint Behavior

#### Desktop
* Guide + Player + Playlist + Status panel

#### Laptop
* Guide → Player stacked

#### Tablet
* Player-first layout

#### Phone
* Guide-first single column
* Tap → Player view

### 9.2 Layout Constraint Rule
Never attempt to compress all UI into one screen. Instead:
* Collapse
* Stack
* Prioritize

---

## 10. Template Layout System (Consistency Contract)
All templates must expose identical primary actions:
* TV Guide
* Player
* Search
* Settings
* Theatre Mode

#### Allowed layouts:
* Classic
* Modern
* Broadcast
* OBS
* Compact

#### Rule:
> Layout changes visual structure only, never feature availability.

---

## 11. Content Loading Flow (Unified Import Pipeline)

### 11.1 Standard Flow
```
Open Source Picker
   ↓
Select Input Type
   ↓
Import
   ↓
Guide Auto-Builds
```

### 11.2 Supported Sources
* M3U
* XMLTV
* Archive.org
* YouTube
* Rumble
* Local folders
* RSS
* Podcasts

### 11.3 Automation Rule
If metadata is sufficient:
> TV Guide must populate automatically without manual mapping.

---

## 12. First-Run Wizard (Critical UX Layer)

### 12.1 Wizard Flow
```
Welcome
   ↓
Choose Content Type
   ↓
Select Source
   ↓
Optional: Load Demo Channels
   ↓
Launch Guide
```

### 12.2 Required Option
Always include:
```
✔ Demo Channels
```

#### Purpose:
* Prevent empty system experience
* Allow instant exploration

---

## 13. “Go Live” System Control

### 13.1 Always Visible Control
```
NOW → Return to Live
```

#### Rule:
* One-click return from anywhere
* No scrolling through schedule grids
* Always jumps to active stream

---

## 14. UX Complexity Stratification Model

### 14.1 Beginner Mode
Goal:
> “I just want to watch TV.”

Flow:
* Open app
* Click Guide
* Select channel

### 14.2 Intermediate Mode
Goal:
> “I want to load my playlist.”

Flow:
* Open Playlist
* Import M3U
* Guide auto-updates

### 14.3 Advanced Mode
Goal:
> “I want custom broadcast logic.”

Location:
* Advanced Broadcast Suite only
* Not part of default navigation

Includes:
* Weighted scheduling
* Hybrid sources
* Automation engine controls

---

## 15. UX Design Principle: Progressive Disclosure

### Core Rule
> Complexity must never be removed — only hidden until needed.

#### Layers:
1. Simple TV UI (default)
2. Playlist management (intermediate)
3. Broadcast automation (advanced)

---

## 16. Navigation Simplification Contract
Final navigation structure:
```
🏠 Home
📺 Guide
▶ Player
📁 Library
⭐ Favorites
🔍 Search
⚙ Settings
```

#### Rule:
Everything else must be:
* nested under Settings
* or accessible via Advanced mode

---

## 17. UX Success Criteria
System is considered successful when:

#### New User Test
* User opens app
* Immediately sees Guide or Resume
* Starts playback in < 2 clicks

#### No requirement for:
* Reading documentation
* Understanding backend systems
* Configuring scheduler manually

---

## 18. Final UX Philosophy Statement
> The backend should behave like a broadcast-grade engine.
> The frontend should behave like a television.

Users should never feel they are operating:
* a scheduler
* a normalization system
* a provider abstraction layer

They should feel:
> “This behaves like a modern TV with live channels, guide, and instant resume.”
