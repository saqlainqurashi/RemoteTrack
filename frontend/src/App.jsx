import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./App.css";
import TrackingWorkspace from "./TrackingWorkspace";
import logo from "./assets/logo.jpg";

function LoginSquishy() {
  const holder = useRef(null);
  const drag = useRef(null);
  const fallFrame = useRef(null);
  useEffect(() => () => cancelAnimationFrame(fallFrame.current), []);
  const [position, setPosition] = useState(null);
  const [pressed, setPressed] = useState(false);
  const [squished, setSquished] = useState(false);

  useEffect(() => {
    if (!squished) return;
    const timer = setTimeout(() => setSquished(false), 550);
    return () => clearTimeout(timer);
  }, [squished]);

  function startDrag(event) {
    if (!event.isPrimary || event.button !== 0) return;
    cancelAnimationFrame(fallFrame.current);
    const rect = holder.current.getBoundingClientRect();
    drag.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed(true);
  }

  function moveDrag(event) {
    if (!drag.current) return;
    const rect = holder.current.getBoundingClientRect();
    setPosition({
      left: Math.max(0, Math.min(document.documentElement.clientWidth - rect.width, event.clientX - drag.current.x)),
      top: Math.max(0, Math.min(window.innerHeight - rect.height, event.clientY - drag.current.y)),
    });
  }

  useEffect(() => {
    function keepInView() {
      setPosition((current) => {
        if (!current || !holder.current) return current;
        const rect = holder.current.getBoundingClientRect();
        return {
          left: Math.max(0, Math.min(document.documentElement.clientWidth - rect.width, current.left)),
          top: drag.current ? Math.max(0, Math.min(window.innerHeight - rect.height, current.top)) : Math.max(0, window.innerHeight - rect.height),
        };
      });
    }
    window.addEventListener("resize", keepInView);
    return () => window.removeEventListener("resize", keepInView);
  }, []);

  function stopDrag() {
    if (!drag.current) return;
    drag.current = null;
    setPressed(false);
    const rect = holder.current.getBoundingClientRect();
    let top = rect.top;
    let velocity = 0;
    let previous;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function fall(time) {
      const elapsed = Math.min((time - (previous ?? time)) / 1000, 0.032);
      previous = time;
      const floor = Math.max(0, window.innerHeight - holder.current.offsetHeight);
      velocity += 2200 * elapsed;
      top = reducedMotion ? floor : Math.min(floor, top + velocity * elapsed);
      setPosition({ left: rect.left, top });
      if (top < floor) {
        fallFrame.current = requestAnimationFrame(fall);
      } else {
        setSquished(true);
      }
    }
    fallFrame.current = requestAnimationFrame(fall);
  }

  return createPortal(
    <div className="login-squishy" ref={holder} style={position ? { ...position, right: "auto", bottom: "auto" } : undefined}>
      <button
        type="button"
        className={`squishy-body${pressed ? " is-held" : ""}${squished ? " is-squished" : ""}`}
        aria-label="Squish me! Drag to move or press to squeeze"
        title="Drag me around or click to squish!"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onLostPointerCapture={stopDrag}
        onClick={() => setSquished(true)}
      >
        <span className="squishy-face">
          <span className="squishy-eyes"><i /><i /></span>
          <span className="squishy-smile" />
        </span>
      </button>
    </div>,
    document.body,
  );
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export default function App() {
  const [page, setPage] = useState("Overview");
  const [session, setSession] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("remotetrack-session"));
      return saved?.token && saved?.user ? saved : null;
    } catch {
      return null;
    }
  });
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All members");
  const [modal, setModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const profile = session?.user;
  const isSuperAdmin = profile?.role === "superadmin";

  useEffect(() => {
    try {
      if (session) {
        sessionStorage.setItem("remotetrack-session", JSON.stringify(session));
      } else {
        sessionStorage.removeItem("remotetrack-session");
      }
    } catch {}
  }, [session]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!isSuperAdmin || !session?.token) return;
    let active = true;
    fetch(`${API_URL}/api/members`, {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load members.");
        return response.json();
      })
      .then((users) => {
        if (active) setMembers(users);
      })
      .catch((failure) => {
        if (active) setNotice(failure.message);
      });
    return () => {
      active = false;
    };
  }, [isSuperAdmin, session?.token]);

  function signOut() {
    setSession(null);
    setPage("Overview");
    setMembers([]);
    setModal(false);
    setError("");
    setSearch("");
    setFilter("All members");
  }

  const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";
  
  async function api(path, options = {}, token = session?.token) {
    const response = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (response.status === 401 && session) signOut();
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(
        typeof body.detail === "string"
          ? body.detail
          : Array.isArray(body.detail)
            ? body.detail
                .map((issue) => `${issue.loc.slice(1).join(" ")}: ${issue.msg}`)
                .join(". ")
            : "The request could not be completed. Please try again.",
      );
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function signIn(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: new URLSearchParams({
          username: form.get("email"),
          password: form.get("password"),
        }),
      });
      const user = result.user;
      setSession({ user, token: result.access_token });
      setMembers([]);
      setPage("Overview");
    } catch (failure) {
      setError(
        failure instanceof TypeError
          ? "Unable to connect. Please check that the backend is running."
          : failure.message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function addMember(event) {
    event.preventDefault();
    if (!isSuperAdmin) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const member = await api("/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.get("full_name").trim(),
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      setMembers((current) => [...current, member]);
      setModal(false);
      setNotice("Member account created successfully.");
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  const visibleMembers = members.filter(
    (member) =>
      `${member.full_name} ${member.email}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === "All members" ||
        (filter === "Active" ? member.is_active : !member.is_active)),
  );

  if (!session)
    return (
      <div className="login-page">
        <section className="login-story" aria-label="About RemoteTrack">
          <a className="brand" href="/">
            <img className="brand-logo" src={logo} alt="" />
            RemoteTrack
            <span className="brand-dot">.</span>
          </a>
          <img
            className="login-artwork"
            src="/images/login-adventure.png"
            alt="An explorer in a red hat discovering a paper airplane among playful botanical shapes"
          />
        </section>
        <section className="login-form-side">
          <LoginSquishy />
          <div className="login-confetti confetti-top" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="login-confetti confetti-bottom" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="login-floating-extras" aria-hidden="true">
            <i className="floating-ring" />
            <i className="floating-diamond" />
            <i className="floating-sparkle" />
            <i className="floating-pill" />
            <i className="floating-dot" />
          </div>
          <main className="login-form-wrap">
            <h1>
              Hello again<span className="heading-dot">.</span>
            </h1>
            <p>Big plans? Let's pick up where you left off.</p>
            <form onSubmit={signIn} className="login-form">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="username"
                autoFocus
                required
                disabled={busy}
              />
              <div className="password-label">
                <label htmlFor="password">Password</label>
              </div>
              <div className="password-input">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary login-submit" disabled={busy}>
                {busy ? "Signing in..." : "Let's go"}
                <span aria-hidden="true">&#8599;</span>
              </button>
            </form>
            <div className="login-help">
              Need an account? <strong>Contact your super admin.</strong>
            </div>
            <div className="login-security">
              <span aria-hidden="true">&#9671;</span> Your workspace. Securely
              connected.
            </div>
          </main>
          <div className="login-bottom">
            &copy; {new Date().getFullYear()} RemoteTrack
            <span>Make room for what's next.</span>
          </div>
        </section>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <img className="brand-logo" src={logo} alt="" />
          RemoteTrack
          <span className="brand-dot">.</span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {[
            "Overview",
            "Applications",
            "Interviews",
            ...(isSuperAdmin ? ["Members"] : []),
            "My profile",
          ].map((tab) => (
            <button
              key={tab}
              className={`nav-item ${page === tab ? "selected" : ""}`}
              onClick={() => setPage(tab)}
              aria-current={page === tab ? "page" : undefined}
            >
              <span aria-hidden="true">
                {tab === "Interviews" ? "\u25f7" : "\u25c7"}
              </span>
              {tab}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <span className="avatar dark">{initials(profile.full_name)}</span>
            <div>
              <strong>{profile.full_name}</strong>
              <small>{isSuperAdmin ? "Super admin" : "Member"}</small>
            </div>
            <button aria-label="Sign out" onClick={signOut}>
              &#8618;
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            Workspace <span>/</span>
            <strong>{page}</strong>
          </div>
          <button className="signout" onClick={signOut}>
            Sign out &#8618;
          </button>
        </header>
        <main>
          {["Overview", "Applications", "Interviews"].includes(page) ? (
            <TrackingWorkspace
              api={api}
              profile={profile}
              members={members}
              page={page}
              setPage={setPage}
              setNotice={setNotice}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">YOUR WORKSPACE, CONNECTED</div>
                  <h1>
                    {page === "Members"
                      ? "People make it happen."
                      : `Welcome, ${profile.full_name}.`}
                  </h1>
                  <p>
                    {page === "Members"
                      ? "Manage the people in your RemoteTrack workspace."
                      : "Your RemoteTrack account details."}
                  </p>
                </div>
                {page === "Members" && isSuperAdmin && (
                  <button
                    className="primary"
                    onClick={() => {
                      setError("");
                      setModal(true);
                    }}
                  >
                    + Add member
                  </button>
                )}
              </div>
              {page === "Members" && isSuperAdmin ? (
                <>
                  <section className="stats">
                    {[
                      ["Total members", members.length],
                      [
                        "Active members",
                        members.filter((member) => member.is_active).length,
                      ],
                      ["Workspace roles", 2],
                    ].map(([title, count]) => (
                      <article className="stat" key={title}>
                        <div className="stat-top">
                          {title}
                          <span className="stat-icon">&#9671;</span>
                        </div>
                        <strong>{count}</strong>
                      </article>
                    ))}
                  </section>
                  <section className="panel">
                    <div className="panel-title">
                      <div>
                        <h2>
                          Workspace members{" "}
                          <span className="count">{members.length}</span>
                        </h2>
                        <p>Manage access to your workspace.</p>
                      </div>
                      <span className="subtle">Super admin access</span>
                    </div>
                    <div className="table-controls">
                      <label className="search">
                        <input
                          aria-label="Search members"
                          placeholder="Search by name or email..."
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </label>
                      <select
                        aria-label="Filter members"
                        value={filter}
                        onChange={(event) => setFilter(event.target.value)}
                      >
                        <option>All members</option>
                        <option>Active</option>
                        <option>Inactive</option>
                      </select>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Member</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Date added</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleMembers.map((member) => (
                            <tr key={member.id}>
                              <td>
                                <div className="member">
                                  <span className="avatar">
                                    {initials(member.full_name)}
                                  </span>
                                  <div>
                                    <strong>{member.full_name}</strong>
                                    <small>{member.email}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`role ${member.role === "superadmin" ? "admin" : ""}`}
                                >
                                  {member.role === "superadmin"
                                    ? "Super admin"
                                    : "Member"}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`status ${member.is_active ? "" : "inactive"}`}
                                >
                                  <i />
                                  {member.is_active ? "Active" : "Inactive"}
                                </span>
                              </td>
                              <td className="date">
                                {new Date(
                                  member.created_at,
                                ).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!visibleMembers.length && (
                        <p className="empty">No members match your search.</p>
                      )}
                    </div>
                    <div className="panel-footer">
                      Showing {visibleMembers.length} of {members.length}{" "}
                      members
                    </div>
                  </section>
                </>
              ) : (
                <section className="panel profile-card">
                  <span className="avatar">{initials(profile.full_name)}</span>
                  <h2>{profile.full_name}</h2>
                  <p>{profile.email}</p>
                  <span className="role">
                    {isSuperAdmin ? "Super admin" : "Member"}
                  </span>
                  <span className="status">
                    <i />
                    Active
                  </span>
                </section>
              )}
              <section className="access-note">
                <div className="note-icon">&#9671;</div>
                <div>
                  <h3>
                    {isSuperAdmin
                      ? "You're in control of workspace access."
                      : "Your account is managed by your super admin."}
                  </h3>
                  <p>Only super admins can create member accounts.</p>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {modal && isSuperAdmin && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onKeyDown={(event) => {
              if (event.key === "Escape" && !busy) setModal(false);
              if (event.key !== "Tab") return;
              const controls = event.currentTarget.querySelectorAll(
                "button:not(:disabled), input:not(:disabled)",
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
              disabled={busy}
              onClick={() => setModal(false)}
            >
              &times;
            </button>
            <span className="modal-icon">+</span>
            <h2 id="modal-title">Add a member</h2>
            <p>Create a member account for your workspace.</p>
            <form onSubmit={addMember}>
              <label>
                Full name
                <input
                  name="full_name"
                  autoFocus
                  required
                  minLength={2}
                  maxLength={100}
                  disabled={busy}
                />
              </label>
              <label>
                Email address
                <input name="email" type="email" required disabled={busy} />
              </label>
              <label>
                Temporary password
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  disabled={busy}
                />
              </label>
              <p className="password-hint">
                Use at least 12 characters. Share the credentials with your
                member.
              </p>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <button className="primary" disabled={busy}>
                {busy ? "Creating account..." : "Create member"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
