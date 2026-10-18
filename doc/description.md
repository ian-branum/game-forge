# Game Forge: Purpose and Architecture

## Purpose

Game Forge is a browser-based platform for creating and playing small games from natural-language prompts. A signed-in user chooses a category, describes a game, and spends credits to have DeepSeek generate a structured game definition. The application stores that definition and passes it to a category-specific React game engine.

The repository currently supports AI-generated tactical, trivia, word, puzzle, card, and narrative games. It also includes hard-coded demos for those categories and an Othello demo. Users can manage generated scenarios in a dashboard, modify them to create versions, archive them, and configure visibility and proposed play/clone prices.

## Overall Architecture

The application is a single Next.js 16 App Router project using React 19 and TypeScript.

### Presentation and routing

- `app/` contains pages and route handlers.
- `app/page.tsx` is the landing and product-discovery page.
- `app/forge/page.tsx` collects a category and prompt and submits a generation request.
- `app/dashboard/page.tsx` provides scenario management, versioning, visibility, pricing, and archive controls.
- `app/play/[id]/page.tsx` is the server-side game dispatcher. It loads a database scenario or a built-in demo and selects the appropriate game component.
- `components/` contains the navigation and category-specific client game interfaces, including the tactical, trivia, word, puzzle, card, narrative, and Othello engines.

### Generation and gameplay

`POST /api/generate` authenticates the user, checks their credit balance, invokes one of the modules in `lib/generators/`, and writes the scenario, credit deduction, and credit transaction to PostgreSQL. Each generator calls DeepSeek and converts its JSON response into the payload expected by its game component.

Gameplay is data-driven: the dynamic play route reads a scenario's `category` and `payload`, then renders the matching component. The tactical category has the deepest domain layer. Its rules, line-of-sight logic, sound support, types, and scenario data live under `lib/squad-leader/`, while `components/TacticalGame.tsx` renders and controls that simulation.

### Persistence, identity, and credits

- Prisma 7 models users, NextAuth accounts and sessions, scenarios, game versions, and credit transactions in PostgreSQL.
- `lib/prisma.ts` creates the shared Prisma client with the Neon serverless adapter.
- NextAuth 5 uses the Prisma adapter and Google OAuth. `app/providers.tsx` supplies session state to client components.
- A scenario stores both its current payload and an optional active version reference. `GameVersion` stores generated revisions.
- Credits are held on `User.credits`; generation and modification routes record corresponding `CreditTransaction` rows.

### External services

- DeepSeek supplies generated game definitions.
- Neon/PostgreSQL supplies persistent storage.
- Google OAuth supplies sign-in.
- Stripe endpoints and the credit-purchase UI are placeholders; payment processing is not implemented.

## Architectural Flaws and Risks

### Confirmed flaws

1. **Private scenario access is not enforced.** The default `GET /api/scenarios` query can return other users' non-public scenarios because it does not restrict results to the owner or to `isPublic: true`. The play route also loads any scenario by ID without authentication, ownership, or visibility checks. CUIDs are difficult to guess but are not an authorization boundary.

2. **The sharing model is incomplete.** Every scenario has a unique `shareToken`, but the play route only looks up scenario IDs. Consequently, the token neither enables intentional private sharing nor protects private scenario URLs.

3. **Credit checks are race-prone.** Generation and modification read a balance before making the AI request, then decrement it later without a conditional balance check. Concurrent requests can all pass the initial check and drive a user's balance below zero. The database transaction keeps each write set internally atomic, but it does not make the earlier balance decision atomic.

4. **External generation and persistence do not form one reliable workflow.** The application pays for and completes the DeepSeek request before its database transaction. A later database failure loses the generated result without a durable operation record or recovery path. There is also no idempotency key to prevent duplicate charges or games when clients retry.

5. **Initial scenarios are missing an initial `GameVersion`.** The generation route creates only `Scenario`; versions are created only by the modification route. New games therefore have empty version history, and the first generated state cannot be selected or restored through the version model.

6. **Displayed credits are not present in the session.** The auth callback adds only the user ID, while client UI reads a `credits` session property. Those screens can display an unknown balance even though the value exists in the database.

7. **Visibility and pricing are modeled ahead of enforcement.** The dashboard can set public/private status and play/clone prices, but gameplay does not enforce privacy or debit a play price, and no clone purchase flow exists. This creates misleading controls and an unsafe assumption that the model fields provide access control by themselves.

8. **Generation errors expose internal details.** API failures return stack traces and the submitted prompt to the browser. Stack traces should remain in server-side logs, and client responses should use stable, user-safe error messages.

9. **AI payloads cross a weak validation boundary.** Generators largely trust parsed model JSON and cast stored JSON to TypeScript types. Type assertions do not validate runtime data, so malformed output can reach game components or the tactical engine and cause crashes or invalid game states.

10. **Payment support is only stubbed.** Checkout always returns `503`, the Stripe webhook acknowledges requests without verification or processing, and credit packs cannot be purchased. This is an incomplete feature rather than a defect if payments remain intentionally out of scope.

11. **There is no automated test suite or test script.** Core rules, authorization, AI response handling, version transitions, and credit accounting can regress without detection.

12. **Documentation has drifted from the implementation.** `README.md` is still create-next-app boilerplate, while `TASK.md` describes an earlier phase and omits much of the current dashboard, versioning, and multi-engine implementation.

### Maintainability risks

- `components/TacticalGame.tsx` and `app/dashboard/page.tsx` combine many responsibilities in large client components.
- Six generator modules repeat external API transport and parsing concerns instead of sharing a hardened DeepSeek client and validation layer.
- Authentication and authorization checks are implemented independently in route handlers, making inconsistent policy more likely.
- Generation and modification have no apparent rate limiting, request size limits, timeout policy, or abuse controls.
- NextAuth is pinned to a beta release, increasing upgrade and compatibility risk.

## Obvious Next Steps

1. **Close the authorization gaps first.** Define one scenario-access policy and reuse it in list, play, modify, version, visibility, pricing, and archive operations. List only owned or public scenarios; require ownership for management; allow private play only for the owner or through a deliberately validated share token.

2. **Make credit spending concurrency-safe.** Reserve or conditionally decrement credits in the database before generation, reject the operation when the conditional update affects no rows, and represent generation as a durable pending/succeeded/failed operation. Add idempotency keys and a documented refund or retry policy.

3. **Unify scenario and version creation.** Create version 1 during the initial forge transaction, set it as active, and use one authoritative payload strategy so `Scenario.payload` and `activeVersionId` cannot silently diverge.

4. **Add runtime schemas at every AI boundary.** Validate category, prompt size, DeepSeek response shape, coordinates, ranges, and category-specific invariants before storing or rendering a payload. Return safe errors and keep diagnostic details in server logs.

5. **Fix session credit delivery.** Load or refresh the user's credit balance through the auth/session design, and update client state after any debit or purchase.

6. **Either complete or hide unfinished commerce.** Enforce play/clone prices and implement verified Stripe checkout/webhooks with idempotent credit transactions, or remove/label those controls until the full flow is ready.

7. **Establish automated coverage and CI.** Prioritize authorization tests, concurrent credit-spend tests, version lifecycle tests, generator validation tests, and deterministic tactical-engine unit tests. Run lint, type checking, tests, and the production build in CI.

8. **Extract shared services and smaller UI modules.** Centralize generator transport, timeouts, response parsing, logging, and error mapping. Split the dashboard and tactical UI by responsibility while keeping the pure tactical rules separate from rendering.

9. **Update operational documentation.** Replace the starter README with product context, local setup, required environment variables, database migration instructions, service dependencies, test commands, and deployment guidance. Keep `TASK.md` as historical scope or revise it to match the current roadmap.
