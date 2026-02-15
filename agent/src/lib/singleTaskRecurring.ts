import prisma from "@/lib/prisma";
import { createTransporter } from "@/lib/email";

// Send daily activity emails to agents with yesterday's activities (login/logout times and comments)
export async function sendActivityEmailsToAgents() {
  // Calculate yesterday's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const endOfYesterday = new Date(today);
  // end of yesterday is start of today (midnight)
  try {
    // Get all agents with their email
    const agents = await prisma.agent.findMany({
      where: { status: "active" },
      select: { id: true, name: true, email: true },
    });

    if (!agents.length) {
      console.log("No active agents found to send activity emails");
      return;
    }

    // Get all owners for CC
    const owners = await prisma.user.findMany({
      where: { adminType: "owner", status: "active" },
      select: { email: true, username: true },
    });

    const ownerEmails = owners.map((o) => o.email);

    // Send activity email to each agent
    for (const agent of agents) {
      try {
        // Fetch login history for the agent on this date
        const loginHistory = await prisma.loginHistory.findMany({
          where: {
            agentId: agent.id,
            loginAt: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          orderBy: { loginAt: "asc" },
        });

        // Fetch comments added for tasks by this agent
        const comments = await prisma.comment.findMany({
          where: {
            authorId: agent.id,
            createdAt: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          include: { task: true },
          orderBy: { createdAt: "asc" },
        });

        // Fetch timesheet entries for this agent
        const timesheetEntries = await prisma.timesheetEntry.findMany({
          where: {
            agentId: agent.id,
            date: {
              gte: yesterday,
              lt: endOfYesterday,
            },
          },
          orderBy: { date: "asc" },
        });

        // Build HTML email content
        const activityHTML = buildActivityEmailHTML(
          agent.name,
          loginHistory,
          comments,
          timesheetEntries,
          yesterday,
        );

        // Send email to agent with owners CC'd
        const transporter = createTransporter();
        await transporter.sendMail({
          from: `"${process.env.COMPANY_NAME || "LegalStanley"}" <${process.env.EMAIL_USER}>`,
          to: agent.email,
          // cc: ownerEmails.join(","),
          cc: "ranjithp5841@gmail.com",
          subject: `Daily Activity Report - ${formatDate(yesterday)}`,
          html: activityHTML,
          text: `Activity report for ${agent.name} on ${formatDate(yesterday)}`,
        });
      } catch (error) {
        console.error(`Error sending activity email to ${agent.name}:`, error);
      }
    }
  } catch (error) {
    console.error("Error in sendActivityEmailsToAgents:", error);
  }
}

// Helper function to format date
function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return date.toLocaleDateString("en-US", options);
}

// Helper function to format time
function formatTime(date: Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Build HTML email with agent activities
function buildActivityEmailHTML(
  agentName: string,
  loginHistory: any[],
  comments: any[],
  timesheetEntries: any[],
  date: Date,
): string {
  const dateStr = formatDate(date);

  let html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section-title { background-color: #34495e; color: white; padding: 10px; border-radius: 3px; font-weight: bold; margin-bottom: 10px; }
          .activity-item { background-color: #f5f5f5; padding: 10px; margin-bottom: 8px; border-left: 4px solid #3498db; border-radius: 3px; }
          .login-item { border-left-color: #27ae60; }
          .logout-item { border-left-color: #e74c3c; }
          .comment-item { border-left-color: #f39c12; }
          .timesheet-item { border-left-color: #9b59b6; }
          .time-badge { background-color: #ecf0f1; padding: 2px 6px; border-radius: 3px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background-color: #ecf0f1; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Daily Activity Report</h2>
            <p><strong>Agent:</strong> ${agentName}</p>
            <p><strong>Date:</strong> ${dateStr}</p>
          </div>

          ${
            loginHistory.length > 0
              ? `
          <div class="section">
            <div class="section-title">Login/Logout History</div>
            ${loginHistory
              .map((log) => {
                const loginTime = formatTime(log.loginAt);
                const logoutTime = log.logoutAt
                  ? formatTime(log.logoutAt)
                  : "Still Online";
                return `
              <div class="activity-item">
                <strong>Login:</strong> <span class="time-badge">${loginTime}</span>
                <strong>Logout:</strong> <span class="time-badge">${logoutTime}</span>
                ${log.device ? `<br><small>Device: ${log.device}</small>` : ""}
                ${log.location ? `<br><small>Location: ${log.location}</small>` : ""}
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            timesheetEntries.length > 0
              ? `
          <div class="section">
            <div class="section-title">Timesheet Entries</div>
            ${timesheetEntries
              .map((entry) => {
                return `
              <div class="activity-item timesheet-item">
                <strong>${entry.title}</strong><br>
                <span class="time-badge">${entry.startTime} - ${entry.endTime}</span><br>
                ${entry.project ? `<small>Project: ${entry.project}</small><br>` : ""}
                ${entry.description ? `<small>${entry.description}</small><br>` : ""}
                <small>Status: ${entry.status}</small>
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            comments.length > 0
              ? `
          <div class="section">
            <div class="section-title">Comments Added</div>
            ${comments
              .map((comment) => {
                return `
              <div class="activity-item comment-item">
                <strong>${comment.task.title}</strong><br>
                <p>${comment.content}</p>
                <small>
${comment.startTime ? `Start Time: ${comment.startTime}` : ""}
${comment.endTime ? `End Time: ${comment.endTime}` : ""}
</small>
              </div>
            `;
              })
              .join("")}
          </div>
          `
              : ""
          }

          ${
            loginHistory.length === 0 &&
            comments.length === 0 &&
            timesheetEntries.length === 0
              ? `
          <div class="section">
            <p><em>No activities recorded for this date.</em></p>
          </div>
          `
              : ""
          }
        </div>
      </body>
    </html>
  `;

  return html;
}
