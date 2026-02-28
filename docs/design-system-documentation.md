# UI/UX Design System: ChaosContext AI

## 1. Global Aesthetic

- **Inspiration:** Perplexity AI, Linear, Vercel.
- **Vibe:** Stark, minimalist, developer-focused, academic, high-contrast.
- **Theme:** Dark Mode Only.
- **Rule:** Maximize negative space. Do not use heavy drop shadows. Use extremely subtle 1px borders (`border-white/10`) to separate sections. No gradients except for the primary accent color.

## 2. Color Palette

- **Background (Base):** `#0A0A0A` (Near black, used for the main chat canvas).
- **Background (Sidebar/Cards):** `#141414` (Slightly elevated gray).
- **Text (Primary):** `#EDEDED` (High contrast white for main readability).
- **Text (Secondary/Muted):** `#A1A1AA` (Zinc-400, used for timestamps and minor UI elements).
- **Accent (Mistral Orange):** `#FF8205` (Used sparingly for active states, submit buttons, and "Agent is thinking" indicators).
- **Accent Hover (Mistral Dark Orange):** `#FA500F`
- **Borders:** `#27272A` (Zinc-800, very subtle).

## 3. Typography

- **Font Family (Sans):** `Inter`, `Geist`, or system-ui. Clean and geometric.
- **Font Family (Mono):** `Geist Mono` or `Fira Code`. Used exclusively for the Agent's "Thought Process", tool calls, and code blocks.
- **Sizing (Base):** 16px for body text to ensure maximum readability.
- **Line Height:** 1.6 for chat responses to make dense information easy to scan.

## 4. Core Components

### A. Layout Structure

- A collapsible left sidebar (width: 260px) for chat history.
- A centered main chat container (max-width: 800px) with heavy left/right padding.
- A sticky input bar at the bottom, floating slightly above the edge.

### B. Chat Interface Rules (Perplexity Style)

- **User Messages:** Right-aligned, contained in a subtle bubble with a background color of `#27272A`.
- **Agent Messages:** Left-aligned, NO bubble container. The text should flow directly on the main `#0A0A0A` background like a standard document.
- **Agent "Thought Process" (Tool Calls):** Must appear _before_ the final answer. Rendered in the monospace font, sized at 13px, colored `#A1A1AA`. Left border should have a 2px Mistral Orange (`#FF8205`) line to indicate AI activity. Example format: `> searching Notion for "login"...`

### C. Inputs & Buttons

- **Chat Input:** Minimalist. No heavy borders. Background `#141414`, subtle border `#27272A`. It should grow with multi-line text.
- **Submit Button:** A small, square button inside the input field. When text is present, background turns Mistral Orange (`#FF8205`) with a white icon.
