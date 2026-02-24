Copilot Instructions: Directory Structure and File Placement

Follow the existing repository structure. Do not invent new top-level folders.

Root rule
- All new application code must be created under `src/` unless it is a build/config file that already belongs in the repo root.

Where to put new files
- Apps and app-specific code:
  - `src/apps/<app>/` where <app> is one of: dashboard, experimental, stable, wizard
  - Keep code scoped to the app when it is not shared.
- Shared React components (higher-level, composable UI):
  - `src/components/`
- Basic UI building blocks (web components and React equivalents):
  - `src/elements/`
- React hooks:
  - `src/hooks/`
- Shared libraries and modules:
  - `src/lib/` (place into an existing subfolder if relevant)
- Utilities (small pure helpers):
  - `src/utils/`
- Types and interfaces:
  - `src/types/`
- Constants:
  - `src/constants/`
- Static assets:
  - `src/assets/`
- Styles:
  - `src/styles/` for shared Sass stylesheets
  - `src/themes/` for Sass and MUI theme-related code
- Plugins (dynamically loaded runtime features):
  - `src/plugins/`
- Localization and translations:
  - `src/strings/`
  - Only commit translation changes to `en-us.json` unless explicitly instructed otherwise.

Folders to avoid or not add to
- Do not create new code in `src/controllers/` (legacy).
- Do not create new code in `src/scripts/` (legacy/messy).
- Do not move modern code into legacy folders.

Creation rules
- Before creating a new file, search the repo for an existing similar file and follow its naming, export style, and patterns.
- Always output the full intended file path at the top of your response when proposing new files.
- Prefer adding to existing files over creating new files when it keeps the structure simpler.
- If a shared component/hook/util could be reused by multiple apps, place it in the shared folder (`components`, `hooks`, `lib`, `utils`) instead of an app folder.
- If unsure where a file belongs, ask for guidance or propose two options with the exact paths.

Naming conventions
- Match existing conventions in the repo for casing and file extensions.
- Default to TypeScript (`.ts`, `.tsx`) if nearby code uses it.

Do not do these
- Do not create new directory trees without checking whether a suitable folder already exists.
- Do not add duplicate utilities or components if an equivalent already exists in `src/lib`, `src/utils`, `src/components`, or `src/elements`.