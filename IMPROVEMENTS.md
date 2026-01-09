# PROK Vote - Improvement Analysis

This document outlines recommended improvements for the PROK Vote system, prioritized by impact on security, stability, and user experience.

## 1. Security (Critical) 🔒

*   **Implement Admin Authentication**:
    *   **Current State**: The `/admin` route is publicly accessible.
    *   **Recommendation**: Implement a guard for the admin panel. Even a simple session-password or proper User/Role management (Admin vs. Moderator) is essential to prevent unauthorized vote tampering.
*   **Rate Limiting (Throttling)**:
    *   **Current State**: No visible rate limiting on API endpoints.
    *   **Recommendation**: Integrate `@nestjs/throttler` to limit the number of requests a single IP can make, especially for the `/auth/complete` and `/votes` endpoints.
*   **Socket Authentication**:
    *   **Recommendation**: Ensure the WebSocket connection strictly validates the JWT token on handshake to prevent unauthorized socket connections.

## 2. Scalability & Performance 🚀

*   **Socket.IO Redis Adapter**:
    *   **Current State**: Uses the default in-memory adapter.
    *   **Recommendation**: If deploying to multiple instances/containers, use the Redis Adapter to allow broadcasting across different server nodes.
*   **Optimized Database Queries**:
    *   **Recommendation**: Ensure database indexes are created for frequent query fields: `votes.agendaId`, `votes.voterId`, and `sessions.accessCode`.
*   **Frontend Data Fetching**:
    *   **Current State**: Uses `useEffect` and raw `api` calls.
    *   **Recommendation**: Migrating to **TanStack Query (React Query)** or **SWR** would significantly improve performance by handling caching, deduping requests, and background re-validation.

## 3. User Experience (Admin) 🛠️

*   **Bulk Agenda Import**:
    *   **Recommendation**: Add a feature to upload a CSV/Excel file to populate agendas in bulk, rather than adding them one by one.
*   **Export Voting Results**:
    *   **Recommendation**: Add a "Download Report" button to export all voting data (counts, participation rates) for a session into a CSV/PDF format.
*   **Drag-and-Drop Reordering**:
    *   **Recommendation**: Implement a drag-and-drop interface for reordering agendas, replacing manual `displayOrder` input.

## 4. DevOps & Infrastructure 🏗️

*   **Robust Service Discovery**:
    *   **Current State**: Relies on `update-ip.js` to hardcode local IPs.
    *   **Recommendation**: For a production-like local setup, consider using mDNS (e.g., `prok-vote.local`) or a proper reverse proxy (Nginx) configuration to abstract IP changes.
*   **Automated Testing**:
    *   **Current State**: Minimal testing visibility.
    *   **Recommendation**: Add **Playwright** E2E tests to simulate a full voting cycle (Admin creates vote -> Voter joins -> Voter votes -> Results displayed) to prevent regression.

## 5. Code Quality 🧹

*   **Socket Hook Abstraction**:
    *   **Recommendation**: Create a custom React hook (e.g., `useSocketEvent`) to abstract the `socket.on` / `socket.off` cleanup logic, reducing boilerplate in components.
*   **Error Boundary**:
    *   **Recommendation**: Implement a global React Error Boundary to catch unexpected UI crashes gracefully, especially on the critical Voter and Stadium screens.
