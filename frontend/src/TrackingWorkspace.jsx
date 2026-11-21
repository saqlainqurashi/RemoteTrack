  import { useEffect, useState } from "react";

const applicationStatuses = [
  "applied",
  "screening",
  "interviewing",
  "offer",
  "rejected",
  "converted",
  "withdrawn",
];
const interviewStatuses = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "rescheduled",
];
const jobTypes = ["remote", "hybrid", "onsite"];
const dateLabel = (value) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";
const timeLabel = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
function localTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function Options({ values, current }) {
  return [...new Set([...(current ? [current] : []), ...values])].map(
    (value) => (
      <option key={value} value={value}>
        {value}
      </option>
    ),
  );
}

export default function TrackingWorkspace({
  api,
  profile,
  members,
  page,
  setPage,
  setNotice,
}) {
  const [applications, setApplications] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editor, setEditor] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(Date.now);
  const admin = profile.role === "superadmin";
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  // The component stays mounted across tracking tabs. Load once per authenticated workspace.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [apps, rounds] = await Promise.all([
          api("/applications"),
          api("/interviews"),
        ]);
        if (!cancelled) {
          setApplications(apps);
          setInterviews(rounds);
        }
      } catch (failure) {
        if (!cancelled) setError(failure.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reload]);
  useEffect(() => {
    setSearch("");
    setStatus("");
  }, [page]);
  const appById = new Map(
    applications.map((application) => [application.id, application]),
  );
  const userById = new Map(members.map((member) => [member.id, member]));
  const scopedApplications = applications.filter(
    (application) => !owner || application.user_id === Number(owner),
  );
  const scopedInterviews = interviews.filter(
    (interview) => !owner || interview.user_id === Number(owner),
  );
  const upcoming = scopedInterviews
    .filter(
      (interview) =>
        ["scheduled", "rescheduled"].includes(interview.status) &&
        new Date(interview.scheduled_at) >= now,
    )
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const applicationRows = scopedApplications.filter(
    (application) =>
      `${application.company_name} ${application.job_title} ${application.notes || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || application.application_status === status),
  );
  const interviewRows = scopedInterviews.filter((interview) => {
    const application = appById.get(interview.application_id);
    return (
      `${application?.company_name || "Standalone interview"} ${application?.job_title || ""} ${interview.round_name} ${interview.notes || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || interview.status === status)
    );
  });
  function openEditor(kind, record = null) {
    setFormError("");
    setEditor({ kind, record });
  }
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const form = new FormData(event.currentTarget);
    const isApplication = editor.kind === "application";
    const record = editor.record;
    const payload = isApplication
      ? {
          company_name: form.get("company_name").trim(),
          job_title: form.get("job_title").trim(),
          job_type: form.get("job_type"),
          application_status: form.get("application_status"),
          applied_at: form.get("applied_at") || null,
          notes: form.get("notes") || null,
          ...(admin && !record ? { user_id: Number(form.get("user_id")) } : {}),
        }
      : {
          application_id: form.get("application_id")
            ? Number(form.get("application_id"))
            : null,
          round_name: form.get("round_name").trim(),
          scheduled_at: new Date(form.get("scheduled_at")).toISOString(),
          meeting_link: form.get("meeting_link") || null,
          status: form.get("status"),
          notes: form.get("notes") || null,
        };
    try {
      const resource = isApplication ? "applications" : "interviews";
      const saved = await api(`/${resource}${record ? `/${record.id}` : ""}`, {
        method: record ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const update = (current) =>
        record
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      if (isApplication) setApplications(update);
      else setInterviews(update);
      setEditor(null);
      setNotice(
        `${isApplication ? "Application" : "Interview"} ${record ? "updated" : "added"}.`,
      );
    } catch (failure) {
      setFormError(failure.message);
    } finally {
      setSaving(false);
    }
  }
  function ownerName(application) {
    return (
      userById.get(application?.user_id)?.full_name ||
      `User #${application?.user_id}`
    );
  }
  function memberName(userId) {
    return userById.get(userId)?.full_name || `User #${userId}`;
  }
  async function deleteApplication(application) {
    if (
      !window.confirm(
        `Delete the ${application.company_name} application? Its interviews will remain in your tracker.`,
      )
    )
      return;
    setError("");
    try {
      await api(`/applications/${application.id}`, { method: "DELETE" });
      setApplications((current) =>
        current.filter((item) => item.id !== application.id),
      );
      setInterviews((current) =>
        current.map((item) =>
          item.application_id === application.id
            ? { ...item, application_id: null }
            : item,
        ),
      );
      setNotice("Application deleted. Its interviews were kept.");
    } catch (failure) {
      setError(failure.message);
    }
  }
  function interviewTable(rows) {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Interview round</th>
              <th>Application</th>
              {admin && <th>Member</th>}
              <th>Scheduled</th>
              <th>Status</th>
              <th>Meeting</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((interview) => {
              const application = appById.get(interview.application_id);
              let meetingUrl;
              try {
                const url = new URL(interview.meeting_link);
                if (["https:", "http:"].includes(url.protocol))
                  meetingUrl = url.href;
              } catch {
                /* An optional meeting link may be absent. */
              }
              return (
                <tr key={interview.id}>
                  <td>
                    <strong>{interview.round_name}</strong>
                    {interview.notes && (
                      <small className="record-notes">{interview.notes}</small>
                    )}
                  </td>
                  <td>
                    {application?.company_name || "Standalone interview"}
                    {application?.job_title && (
                      <small className="record-notes">
                        {application.job_title}
                      </small>
                    )}
                  </td>
                  {admin && <td>{memberName(interview.user_id)}</td>}
                  <td>{timeLabel(interview.scheduled_at)}</td>
                  <td>
                    <span className="role">{interview.status}</span>
                  </td>
                  <td>
                    {meetingUrl ? (
                      <a
                        className="text-action"
                        href={meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Join meeting &#8599;
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>
                    <button
                      className="text-action"
                      onClick={() => openEditor("interview", interview)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <p className="empty">No interviews to show.</p>}
      </div>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {admin ? "WORKSPACE OVERVIEW" : "YOUR CAREER, ORGANIZED"}
          </div>
          <h1>
            {page === "Overview"
              ? `Welcome, ${profile.full_name.split(" ")[0]}.`
              : page}
          </h1>
          <p>
            {page === "Applications"
              ? "Track opportunities, progress, and next steps."
              : page === "Interviews"
                ? "Keep every interview round and conversation in view."
                : "A clear view of applications and upcoming interviews."}
          </p>
        </div>
        <div className="heading-actions">
          {page !== "Interviews" && (
            <button
              className="primary"
              disabled={loading || !!error}
              onClick={() => openEditor("application")}
            >
              + Add application
            </button>
          )}
          {page !== "Applications" && (
            <button
              className={page === "Overview" ? "secondary" : "primary"}
              disabled={loading || !!error}
              onClick={() => openEditor("interview")}
            >
              + Add interview
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="form-error" role="alert">
          {error}{" "}
          <button
            className="text-action"
            onClick={() => setReload((current) => current + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {loading ? (
        <section className="panel empty" role="status">
          Loading your workspace...
        </section>
      ) : (
        !error && (
          <>
            {admin && (
              <label className="owner-filter">
                Member{" "}
                <select
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                >
                  <option value="">All accounts</option>
                  {members.map((member) => (
                    <option value={member.id} key={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {page === "Overview" ? (
              <>
                <section className="stats dashboard-stats">
                  {[
                    ["Total interviews", scopedInterviews.length],
                    [
                      "Ongoing interviews",
                      scopedInterviews.filter(
                        (interview) => interview.status === "in_progress",
                      ).length,
                    ],
                    [
                      "Past interviews",
                      scopedInterviews.filter(
                        (interview) =>
                          ["completed", "cancelled"].includes(interview.status) ||
                          (["scheduled", "rescheduled"].includes(interview.status) &&
                            new Date(interview.scheduled_at) < now),
                      ).length,
                    ],
                    ["Upcoming interviews", upcoming.length],
                    [
                      "Rejected",
                      scopedApplications.filter(
                        (application) =>
                          application.application_status === "rejected",
                      ).length,
                    ],
                    [
                      "Converted",
                      scopedApplications.filter(
                        (application) =>
                          application.application_status === "converted",
                      ).length,
                    ],
                  ].map(([title, count]) => (
                    <article className="stat" key={title}>
                      <div className="stat-top">{title}</div>
                      <strong>{count}</strong>
                    </article>
                  ))}
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <h2>Upcoming interviews</h2>
                    <button
                      className="text-action"
                      onClick={() => setPage("Interviews")}
                    >
                      View all &#8599;
                    </button>
                  </div>
                  {interviewTable(upcoming.slice(0, 5))}
                </section>
                <section className="access-note">
                  <div className="note-icon">&#8599;</div>
                  <div>
                    <h3>Keep your next step in view.</h3>
                    <p>
                      Schedule interviews with or without a linked application.
                    </p>
                  </div>
                  <button onClick={() => setPage("Applications")}>
                    View applications &#8599;
                  </button>
                </section>
              </>
            ) : (
              <section className="panel">
                <div className="panel-title">
                  <h2>
                    {page}
                    <span className="count">
                      {page === "Applications"
                        ? applicationRows.length
                        : interviewRows.length}
                    </span>
                  </h2>
                  <span className="subtle">
                    {admin ? "Workspace records" : "Your records"}
                  </span>
                </div>
                <div className="table-controls">
                  <label className="search">
                    <input
                      aria-label={`Search ${page}`}
                      placeholder="Search company, role, or notes..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filter status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    <option value="">All statuses</option>
                    <Options
                      values={
                        page === "Applications"
                          ? [
                              ...applicationStatuses,
                              ...applications.map(
                                (item) => item.application_status,
                              ),
                            ]
                          : [
                              ...interviewStatuses,
                              ...interviews.map((item) => item.status),
                            ]
                      }
                    />
                  </select>
                </div>
                {page === "Applications" ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Company / role</th>
                          {admin && <th>Member</th>}
                          <th>Job type</th>
                          <th>Status</th>
                          <th>Applied</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applicationRows.map((application) => (
                          <tr key={application.id}>
                            <td>
                              <strong>{application.company_name}</strong>
                              <small className="record-notes">
                                {application.job_title}
                              </small>
                              {application.notes && (
                                <small className="record-notes">
                                  {application.notes}
                                </small>
                              )}
                            </td>
                            {admin && <td>{ownerName(application)}</td>}
                            <td>{application.job_type}</td>
                            <td>
                              <span className="role">
                                {application.application_status}
                              </span>
                            </td>
                            <td>{dateLabel(application.applied_at)}</td>
                            <td>
                              <button
                                className="text-action"
                                onClick={() =>
                                  openEditor("application", application)
                                }
                              >
                                Edit
                              </button>
                              <button
                                className="text-action danger-action"
                                onClick={() => deleteApplication(application)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!applicationRows.length && (
                      <p className="empty">
                        No applications to show. Add an application to get
                        started.
                      </p>
                    )}
                  </div>
                ) : (
                  interviewTable(interviewRows)
                )}
              </section>
            )}
          </>
        )
      )}
      {editor && (
        <div className="modal-backdrop">
          <section
            className="modal tracking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracking-title"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !saving) setEditor(null);
              if (event.key !== "Tab") return;
              const controls = event.currentTarget.querySelectorAll(
                "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
              );
              const first = controls[0];
              const last = controls[controls.length - 1];
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <button
              className="close"
              aria-label="Close dialog"
              disabled={saving}
              onClick={() => setEditor(null)}
            >
              &times;
            </button>
            <h2 id="tracking-title">
              {editor.record ? "Edit" : "Add"} {editor.kind}
            </h2>
            <p>
              {editor.kind === "application"
                ? "Capture the details of your opportunity."
                : "Schedule an interview, with or without an application."}
            </p>
            <form onSubmit={save}>
              <fieldset disabled={saving}>
                {editor.kind === "application" ? (
                  <>
                    {admin && !editor.record && (
                      <label>
                        Account
                        <select
                          name="user_id"
                          defaultValue={profile.id}
                          required
                        >
                          {members
                            .filter((member) => member.is_active)
                            .map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.full_name}
                              </option>
                            ))}
                        </select>
                      </label>
                    )}
                    <label>
                      Company name
                      <input
                        autoFocus
                        name="company_name"
                        required
                        maxLength={150}
                        defaultValue={editor.record?.company_name || ""}
                      />
                    </label>
                    <label>
                      Job title
                      <input
                        name="job_title"
                        required
                        maxLength={150}
                        defaultValue={editor.record?.job_title || ""}
                      />
                    </label>
                    <div className="form-columns">
                      <label>
                        Job type
                        <select
                          name="job_type"
                          defaultValue={editor.record?.job_type || "remote"}
                        >
                          <Options
                            values={jobTypes}
                            current={editor.record?.job_type}
                          />
                        </select>
                      </label>
                      <label>
                        Status
                        <select
                          name="application_status"
                          defaultValue={
                            editor.record?.application_status || "applied"
                          }
                        >
                          <Options
                            values={applicationStatuses}
                            current={editor.record?.application_status}
                          />
                        </select>
                      </label>
                    </div>
                    <label>
                      Applied date
                      <input
                        type="date"
                        name="applied_at"
                        defaultValue={editor.record?.applied_at || ""}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      Application
                      <select
                        name="application_id"
                        defaultValue={editor.record?.application_id || ""}
                      >
                        <option value="">
                          No application
                        </option>
                        {applications.map((application) => (
                          <option key={application.id} value={application.id}>
                            {application.company_name} - {application.job_title}
                            {admin ? ` (${ownerName(application)})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Round name
                      <input
                        autoFocus
                        name="round_name"
                        required
                        maxLength={100}
                        placeholder="e.g. Technical interview"
                        defaultValue={editor.record?.round_name || ""}
                      />
                    </label>
                    <label>
                      Scheduled date and time
                      <input
                        name="scheduled_at"
                        type="datetime-local"
                        required
                        defaultValue={
                          editor.record
                            ? localTime(editor.record.scheduled_at)
                            : ""
                        }
                      />
                    </label>
                    <p className="password-hint">
                      Times use your device timezone (
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}).
                    </p>
                    <label>
                      Meeting link
                      <input
                        name="meeting_link"
                        type="url"
                        pattern="https?://.*"
                        placeholder="https://meet.google.com/..."
                        defaultValue={editor.record?.meeting_link || ""}
                      />
                    </label>
                    <label>
                      Status
                      <select
                        name="status"
                        defaultValue={editor.record?.status || "scheduled"}
                      >
                        <Options
                          values={interviewStatuses}
                          current={editor.record?.status}
                        />
                      </select>
                    </label>
                  </>
                )}
                <label>
                  Notes
                  <textarea
                    name="notes"
                    rows={3}
                    defaultValue={editor.record?.notes || ""}
                  />
                </label>
                {formError && (
                  <div className="form-error" role="alert">
                    {formError}
                  </div>
                )}
                <button className="primary" disabled={saving}>
                  {saving ? "Saving..." : "Save " + editor.kind}
                </button>
              </fieldset>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
