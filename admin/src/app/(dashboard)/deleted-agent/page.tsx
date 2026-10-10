import DeletedAgentPage from "../agent/_component/deletedAgentPage";

// Deleted execution agents are now a tab on /agent; this route stays so
// existing links keep resolving.
export default function DeletedAgentsPage() {
    return <DeletedAgentPage role="execution" />;
}
