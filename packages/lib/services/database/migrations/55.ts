import { SqlQuery } from '../types';

// Local-only query performance indexes. These do not change any table structure
// or synced data — they only speed up the queries that filter and sort the
// note list by folder:
//
// - `previews()` filters notes by (parent_id, deleted_time, is_conflict) and
//   sorts by user_updated_time DESC. Before this index every such query was a
//   full table scan of a wide table (body, extracted_resource_ids, …) plus a
//   TEMP B-TREE for the ORDER BY.
// - `Folder.addNoteCounts()` joins notes on parent_id to compute the sidebar
//   note counts; the index covers the join key.
// - folders.parent_id is used to build the notebook tree on every sidebar
//   refresh.
//
// The trailing user_updated_time column lets the default sort order avoid a
// separate sorting step. Indexes are not synced and can be dropped/rebuilt
// freely.

export default (): (SqlQuery|string)[] => {
	return [
		'CREATE INDEX IF NOT EXISTS notes_parent_deleted_conflict ON notes(parent_id, deleted_time, is_conflict, user_updated_time)',
		'CREATE INDEX IF NOT EXISTS folders_parent_id ON folders(parent_id)',
	];
};
