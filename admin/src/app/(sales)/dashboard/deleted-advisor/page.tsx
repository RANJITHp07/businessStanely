import DeletedAgentPage from "@/app/(dashboard)/agent/_component/deletedAgentPage";

// Deleted client advisors are now a tab on /dashboard/agent; this route stays
// so existing links keep resolving.
export default function DeletedAdvisorsPage() {
    return <DeletedAgentPage role="advisor" />;
}
