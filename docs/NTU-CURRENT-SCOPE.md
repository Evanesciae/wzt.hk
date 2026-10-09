# NTU: course-material bridge

The current user-approved scope supersedes the earlier GLM/Telegram setup plan.

The website collects and privately stores NTULearn course files, assignment descriptions, announcements, versions and sync history. Muse will later read and operate through this website; Muse itself will invoke GLM and development tools. The website does not require a GLM key or Telegram bot for this workflow.

The main navigation entry is **NTU**, pointing to `/admin/study`. Only that navigation label is English; settings and page descriptions are Chinese. School connection and course selection remain at `/admin/ntu`; both pages require an actual admin session. The normal setup flow contains only school connection, course choice and deterministic synchronization. Historical note storage and prior backend integrations remain for compatibility, but model-analysis and messaging setup are not exposed in this workflow. Saving school-only settings disables website AI summaries and Telegram; saving sync settings disables automatic file analysis.

Future Muse authentication, read/write capabilities and content extraction should be implemented against the actual Muse connection mechanism. Do not share the VPS runner token with Muse: that credential can receive the school's Cookie and is intended for the server synchronizer. No Muse integration is claimed complete by this change.

User preference: reasonable changes to the existing site are welcome. Reuse existing infrastructure, but do not hide essential entry points or avoid necessary UX changes under the guise of preserving the site.
