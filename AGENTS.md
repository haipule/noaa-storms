# NOAA Storms Development Instructions

## Scope

These instructions apply to the entire `noaa-storms` repository.

## Configuration and WebApp Responsibilities

- Put every user-editable setting in the Signal K plugin configuration schema in `index.js`.
- The WebApp in `public/` is display-only. Do not add editable settings, configuration forms, toggles, or persistence controls to the WebApp.
- The WebApp may display effective configuration values and runtime state reported by the plugin API.
- When the WebApp shows a state that can only be changed through plugin configuration, provide a clear link to the NOAA Storms plugin configuration page in the Signal K Admin UI.
- Keep configuration validation and defaults in the plugin backend so all consumers observe the same effective settings.

## GPX Export Status

- GPX recording, its output directory, and cleanup behavior must be configured only through the Signal K plugin configuration.
- The WebApp may show whether GPX recording is enabled and whether each active storm is eligible to produce a GPX file.
- For each storm, distinguish at least these display states: file written, waiting for usable forecast data, skipped by configuration, and write error.
- Display the output filename or path only when it is safe and useful; do not expose sensitive filesystem details unnecessarily.
- A GPX status indicator should link to the NOAA Storms plugin configuration page so users can change recording settings there.

## Safety

- Never delete arbitrary GPX files. Cleanup may remove only files that the plugin can prove it created and only within its configured managed output directory.
- Perform cleanup only after a successful, valid live NOAA response. Fetch or parsing failures must not trigger deletion.
- Test mode must not delete live GPX files.
- Write generated files atomically so an interrupted update cannot replace a valid GPX file with a partial file.

## Change Discipline

- Keep changes focused and avoid unrelated refactoring.
- Add automated tests for new behavior, especially configuration validation, GPX generation, write failures, and cleanup boundaries.
- Do not publish, release, push, or create GitHub issues or pull requests without explicit user approval.
