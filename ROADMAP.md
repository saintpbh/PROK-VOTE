# PROK Vote - Strategic Implementation Roadmap

This roadmap outlines the strategy for upgrading PROK Vote to a production-ready system, addressing Security, Scalability, UX, and Infrastructure.

## Phase 1: hardening Security (Critical priority) 🛡️
**Objective:** Secure the Admin panel and prevent vote manipulation/spam.

1.  **Rate Limiting (Throttling)**
    *   **Action:** Install `@nestjs/throttler`.
    *   **Detail:** Apply global limits, with stricter limits on specific endpoints like `/auth/complete` (login) and `/votes` (voting).
2.  **Admin Authentication**
    *   **Action:** Implement a `AdminAuthGuard`.
    *   **Detail:**
        *   Create an `Admin` entity (or simple Env-based password for v1).
        *   Create a Login Page (`/admin/login`).
        *   Protect all `/admin` routes and Admin API endpoints (`/sessions/*`, etc.).
3.  **Socket Security**
    *   **Action:** Enforce strict Token validation on Socket connection.

## Phase 2: Admin UX Enhancements (High Impact) ⚡
**Objective:** Improve the operational efficiency for election managers.

1.  **Export Results**
    *   **Action:** Add "Download Report" (CSV/Excel) in Admin Session Manager.
    *   **Detail:** Endpoint to generate CSV containing Vote Counts, Turnout, and individual anonymous vote records (for auditing).
2.  **Drag-and-Drop Ordering**
    *   **Action:** Implement `dnd-kit` or `react-beautiful-dnd` for Agenda List.
    *   **Detail:** Allow visual reordering of agendas instead of manual number entry.

## Phase 3: Performance & Scalability 🚀
**Objective:** Support concurrent users (1000+) without lag.

1.  **Frontend Data Layer Refactor**
    *   **Action:** Introduce `TanStack Query` (React Query).
    *   **Detail:** Replace `useEffect` fetch calls. Implement optimistic updates for voting buttons to make the UI feel instant.
2.  **Database Optimization**
    *   **Action:** Add Indexes to `Vote` and `Voter` tables.
    *   **Detail:** Analyze query performance and add compound indexes.

## Phase 4: Infrastructure & DevOps 🏗️
**Objective:** Simplify deployment and networking.

1.  **Stable Local Domain**
    *   **Action:** Setup `prok-vote.local` using mDNS or a local proxy (Caddy/Nginx).
    *   **Detail:** Remove reliance on constantly changing IP addresses.

---

**Execution Strategy:**
We will tackle these phases sequentially, starting with **Phase 1: Security**.
