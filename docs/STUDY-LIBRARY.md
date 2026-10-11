# Private course file library

The NTU navigation opens `/admin/study`. Course cards and the sidebar lead to a course root; folder links and breadcrumbs support nested folders (maximum 12 levels). Existing selected/imported courses receive 课件, 作业, and 参考资料 folders in migration 0018. Existing source IDs, versions, notes and downloads remain intact. New manually created courses receive the same folders.

Uploads are independent of the NTULearn Cookie, runner token, selected school courses, GLM, and Telegram. They require the existing website admin session and CSRF protection. The server streams with a 25 MiB bound, calculates SHA-256, stores originals under the existing private R2 prefix and records versions in the existing D1 tables. Same-name uploads in the same folder update the current version; previous versions remain downloadable. Identical bytes reuse the version. Moving a file preserves its ID and notes. Conflicting same-name uploaded files cannot be moved together. Folder names are normalized and path separators rejected; folder IDs are checked against their course.

The browser uploads files sequentially, displays individual progress/failures, supports retry, and warns before leaving during uploads. A failure leaves other files available to finish. Download routes continue to force attachment delivery and require admin authentication. Files are never exposed through the public media route. Uploading does not trigger model calls or notifications.

The previous school-sync settings and recent runs are at `/admin/study/settings`; the school connection/announcements remain at `/admin/ntu`. Neither is a prerequisite for manual uploading.

The settings page has a one-shot “立即同步” action. Migration 0019 adds a pending request that lets the existing runner bypass its interval and expired-cookie suppression once, without enabling scheduled sync. Active runs remain exclusive; finishing clears the request. Deploy the updated runner too. The UI refreshes pending results every 15 seconds. This uses the server's saved school session, not the user's unrelated local browser session.

This increment supports individual and multi-file selection/drop, not recursive folder selection, automatic laptop-folder watching, full-text extraction/search or offline editing. Those can be added to the same library without coupling it back to school authentication.

Validation: `npm run test:ntu`, `npm run check`, `npm run build`. Regression tests cover no-school-login upload, nested folders, same-name versioning, deduplication, move followed by upload, private download, course boundary checks and size limits. Apply migration 0018 before deploying. On rollback retain additive tables/columns and private objects; restoring an old full database would discard newer user uploads.
